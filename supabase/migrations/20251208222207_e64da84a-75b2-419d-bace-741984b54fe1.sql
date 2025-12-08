-- 1. Adicionar campos de configuração na tabela lojas
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS fuso_horario TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS cutoff_operacional TIME NOT NULL DEFAULT '03:00:00';

-- 2. Adicionar campo dia_operacional na tabela contagem_porcionados
ALTER TABLE contagem_porcionados ADD COLUMN IF NOT EXISTS dia_operacional DATE;

-- 3. Criar função para calcular dia operacional baseado no fuso horário e cutoff da loja
CREATE OR REPLACE FUNCTION public.calcular_dia_operacional(
  p_loja_id UUID,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fuso_horario TEXT;
  v_cutoff TIME;
  v_hora_local TIME;
  v_data_local DATE;
  v_dia_operacional DATE;
BEGIN
  -- Buscar configuração da loja
  SELECT fuso_horario, cutoff_operacional 
  INTO v_fuso_horario, v_cutoff
  FROM lojas WHERE id = p_loja_id;
  
  -- Se loja não encontrada, usar defaults
  IF v_fuso_horario IS NULL THEN
    v_fuso_horario := 'America/Sao_Paulo';
  END IF;
  IF v_cutoff IS NULL THEN
    v_cutoff := '03:00:00'::TIME;
  END IF;
  
  -- Converter timestamp para timezone da loja
  v_hora_local := (p_timestamp AT TIME ZONE v_fuso_horario)::TIME;
  v_data_local := (p_timestamp AT TIME ZONE v_fuso_horario)::DATE;
  
  -- Aplicar regra de cutoff: se hora < cutoff, ainda é dia anterior
  IF v_hora_local < v_cutoff THEN
    v_dia_operacional := v_data_local - INTERVAL '1 day';
  ELSE
    v_dia_operacional := v_data_local;
  END IF;
  
  RETURN v_dia_operacional;
END;
$$;

-- 4. Preencher dia_operacional para registros existentes (baseado no updated_at e loja)
UPDATE contagem_porcionados cp
SET dia_operacional = calcular_dia_operacional(cp.loja_id, cp.updated_at)
WHERE dia_operacional IS NULL;

-- 5. Tornar dia_operacional obrigatório após preencher existentes
ALTER TABLE contagem_porcionados ALTER COLUMN dia_operacional SET NOT NULL;

-- 6. Adicionar constraint UNIQUE correta: uma contagem por loja/item/dia operacional
-- Primeiro remover constraint antiga se existir
ALTER TABLE contagem_porcionados DROP CONSTRAINT IF EXISTS contagem_porcionados_loja_id_item_porcionado_id_key;

-- Criar nova constraint com dia_operacional
ALTER TABLE contagem_porcionados 
ADD CONSTRAINT contagem_porcionados_unica_por_dia_operacional 
UNIQUE (loja_id, item_porcionado_id, dia_operacional);

-- 7. Atualizar função criar_ou_atualizar_producao_registro para usar dia_operacional
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(p_item_id uuid, p_organization_id uuid, p_usuario_id uuid, p_usuario_nome text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item_data record;
  v_contagens record;
  v_demanda_lojas integer := 0;
  v_reserva_dia integer := 0;
  v_necessidade_total integer;
  v_unidades_programadas integer;
  v_peso_programado_total numeric;
  v_sobra_reserva integer := 0;
  v_detalhes_lojas jsonb := '[]'::jsonb;
  v_dia_semana text;
  v_hoje date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_tracos_necessarios integer;
  v_lote_id uuid;
  v_seq integer;
  v_registro_existente uuid;
BEGIN
  -- 1. Buscar dados do item
  SELECT 
    nome, peso_unitario_g, unidade_medida, equivalencia_traco, 
    consumo_por_traco_g, usa_traco_massa
  INTO v_item_data
  FROM itens_porcionados
  WHERE id = p_item_id AND organization_id = p_organization_id;
  
  IF v_item_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item não encontrado');
  END IF;
  
  -- 2. Calcular demanda total de todas as lojas usando dia_operacional (NÃO updated_at)
  SELECT 
    COALESCE(SUM(GREATEST(0, ideal_amanha - final_sobra)), 0)::integer
  INTO v_demanda_lojas
  FROM contagem_porcionados
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND dia_operacional = v_hoje  -- USAR DIA OPERACIONAL
    AND GREATEST(0, ideal_amanha - final_sobra) > 0;
  
  -- Se não há demanda, não criar registro
  IF v_demanda_lojas = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Sem demanda para produção');
  END IF;
  
  -- 3. Determinar dia da semana de amanhã
  v_dia_semana := CASE EXTRACT(DOW FROM v_hoje + interval '1 day')
    WHEN 0 THEN 'domingo'
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END;
  
  -- 4. Buscar reserva configurada para o dia
  EXECUTE format(
    'SELECT COALESCE(%I, 0) FROM itens_reserva_diaria WHERE item_porcionado_id = $1 AND organization_id = $2',
    v_dia_semana
  ) INTO v_reserva_dia USING p_item_id, p_organization_id;
  
  v_reserva_dia := COALESCE(v_reserva_dia, 0);
  
  -- 5. Calcular necessidade total
  v_necessidade_total := v_demanda_lojas + v_reserva_dia;
  
  -- 6. Construir detalhes por loja usando dia_operacional
  SELECT jsonb_agg(
    jsonb_build_object(
      'loja_id', c.loja_id,
      'loja_nome', l.nome,
      'quantidade', GREATEST(0, c.ideal_amanha - c.final_sobra)
    )
  )
  INTO v_detalhes_lojas
  FROM contagem_porcionados c
  JOIN lojas l ON l.id = c.loja_id
  WHERE c.item_porcionado_id = p_item_id
    AND c.organization_id = p_organization_id
    AND c.dia_operacional = v_hoje  -- USAR DIA OPERACIONAL
    AND GREATEST(0, c.ideal_amanha - c.final_sobra) > 0;
  
  v_detalhes_lojas := COALESCE(v_detalhes_lojas, '[]'::jsonb);
  
  -- 7. Calcular unidades programadas e peso
  IF v_item_data.unidade_medida = 'traco' AND v_item_data.equivalencia_traco IS NOT NULL AND v_item_data.consumo_por_traco_g IS NOT NULL THEN
    v_tracos_necessarios := CEIL(v_necessidade_total::numeric / v_item_data.equivalencia_traco);
    v_unidades_programadas := v_tracos_necessarios * v_item_data.equivalencia_traco;
    v_sobra_reserva := v_unidades_programadas - v_necessidade_total;
    v_peso_programado_total := (v_tracos_necessarios * v_item_data.consumo_por_traco_g) / 1000.0;
  ELSE
    v_unidades_programadas := v_necessidade_total;
    v_peso_programado_total := (v_unidades_programadas * COALESCE(v_item_data.peso_unitario_g, 0)) / 1000.0;
  END IF;
  
  -- 8. Criar/atualizar registros de produção
  IF v_item_data.usa_traco_massa = true AND v_item_data.unidade_medida = 'traco' AND v_item_data.equivalencia_traco IS NOT NULL THEN
    v_lote_id := gen_random_uuid();
    
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND status = 'a_produzir'
      AND organization_id = p_organization_id;
    
    FOR v_seq IN 1..v_tracos_necessarios LOOP
      INSERT INTO producao_registros (
        item_id, item_nome, status, unidades_programadas, peso_programado_kg,
        demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
        usuario_id, usuario_nome, organization_id,
        sequencia_traco, lote_producao_id, bloqueado_por_traco_anterior,
        timer_status, data_referencia
      ) VALUES (
        p_item_id,
        v_item_data.nome,
        'a_produzir',
        v_item_data.equivalencia_traco,
        v_item_data.consumo_por_traco_g / 1000.0,
        CASE WHEN v_seq = 1 THEN v_demanda_lojas ELSE NULL END,
        CASE WHEN v_seq = 1 THEN v_reserva_dia ELSE NULL END,
        CASE WHEN v_seq = v_tracos_necessarios THEN v_sobra_reserva ELSE 0 END,
        CASE WHEN v_seq = 1 THEN v_detalhes_lojas ELSE '[]'::jsonb END,
        p_usuario_id,
        p_usuario_nome,
        p_organization_id,
        v_seq,
        v_lote_id,
        v_seq > 1,
        'aguardando',
        v_hoje
      );
    END LOOP;
    
    RETURN jsonb_build_object(
      'success', true,
      'type', 'traco_queue',
      'tracos_criados', v_tracos_necessarios
    );
  ELSE
    SELECT id INTO v_registro_existente
    FROM producao_registros
    WHERE item_id = p_item_id
      AND status = 'a_produzir'
      AND lote_producao_id IS NULL
      AND organization_id = p_organization_id
    LIMIT 1;
    
    IF v_registro_existente IS NOT NULL THEN
      UPDATE producao_registros
      SET 
        unidades_programadas = v_unidades_programadas,
        peso_programado_kg = v_peso_programado_total,
        demanda_lojas = v_demanda_lojas,
        reserva_configurada = v_reserva_dia,
        sobra_reserva = v_sobra_reserva,
        detalhes_lojas = v_detalhes_lojas,
        usuario_id = p_usuario_id,
        usuario_nome = p_usuario_nome
      WHERE id = v_registro_existente;
      
      RETURN jsonb_build_object(
        'success', true,
        'type', 'updated',
        'registro_id', v_registro_existente
      );
    ELSE
      INSERT INTO producao_registros (
        item_id, item_nome, status, unidades_programadas, peso_programado_kg,
        demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
        usuario_id, usuario_nome, organization_id
      ) VALUES (
        p_item_id,
        v_item_data.nome,
        'a_produzir',
        v_unidades_programadas,
        v_peso_programado_total,
        v_demanda_lojas,
        v_reserva_dia,
        v_sobra_reserva,
        v_detalhes_lojas,
        p_usuario_id,
        p_usuario_nome,
        p_organization_id
      )
      RETURNING id INTO v_registro_existente;
      
      RETURN jsonb_build_object(
        'success', true,
        'type', 'created',
        'registro_id', v_registro_existente
      );
    END IF;
  END IF;
END;
$function$;