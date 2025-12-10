-- CORREÇÃO URGENTE: peso_medio_operacional_bolinha_g corrupto (2.577.885g → 422g)

-- 1. Corrigir o item específico com peso absurdamente alto
UPDATE itens_porcionados
SET peso_medio_operacional_bolinha_g = COALESCE(peso_alvo_bolinha_g, 422)
WHERE id = 'ea8ac740-9336-4324-ab4b-6c50d3ce4ff0'
  AND peso_medio_operacional_bolinha_g > 10000;

-- 2. Corrigir qualquer outro item lote_masseira com peso fora da faixa válida (100g - 5000g)
UPDATE itens_porcionados
SET peso_medio_operacional_bolinha_g = COALESCE(
  peso_alvo_bolinha_g,
  (peso_minimo_bolinha_g + peso_maximo_bolinha_g) / 2,
  422
)
WHERE unidade_medida = 'lote_masseira'
  AND (peso_medio_operacional_bolinha_g IS NULL 
       OR peso_medio_operacional_bolinha_g < 100 
       OR peso_medio_operacional_bolinha_g > 5000);

-- 3. Atualizar função com proteção contra peso inválido
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(p_item_id uuid, p_organization_id uuid, p_usuario_id uuid, p_usuario_nome text, p_dia_operacional date DEFAULT NULL::date)
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
  v_peso_base numeric;
  v_perda_adicional numeric;
  v_sobra_reserva integer := 0;
  v_detalhes_lojas jsonb := '[]'::jsonb;
  v_dia_semana text;
  v_hoje date;
  v_tracos_necessarios integer;
  v_lote_id uuid;
  v_seq integer;
  v_registro_existente uuid;
  -- Variáveis LOTE_MASSEIRA
  v_peso_medio_g numeric;
  v_unidades_por_lote integer;
  v_lotes_necessarios integer;
  v_farinha_necessaria numeric;
  v_massa_total_kg numeric;
BEGIN
  -- USAR DIA OPERACIONAL DO PARÂMETRO OU CALCULAR SE NÃO FORNECIDO
  IF p_dia_operacional IS NOT NULL THEN
    v_hoje := p_dia_operacional;
  ELSE
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;

  -- 1. Buscar dados do item (INCLUINDO campos LOTE_MASSEIRA)
  SELECT 
    nome, peso_unitario_g, unidade_medida, equivalencia_traco, 
    consumo_por_traco_g, usa_traco_massa,
    perda_percentual_adicional,
    farinha_por_lote_kg, massa_gerada_por_lote_kg,
    peso_minimo_bolinha_g, peso_maximo_bolinha_g, peso_alvo_bolinha_g,
    peso_medio_operacional_bolinha_g
  INTO v_item_data
  FROM itens_porcionados
  WHERE id = p_item_id AND organization_id = p_organization_id;
  
  IF v_item_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item não encontrado');
  END IF;
  
  -- 2. Calcular demanda total de todas as lojas usando dia_operacional
  SELECT 
    COALESCE(SUM(GREATEST(0, ideal_amanha - final_sobra)), 0)::integer
  INTO v_demanda_lojas
  FROM contagem_porcionados
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND dia_operacional = v_hoje
    AND GREATEST(0, ideal_amanha - final_sobra) > 0;
  
  -- Se não há demanda, não criar registro
  IF v_demanda_lojas = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Sem demanda para produção', 'dia_operacional_usado', v_hoje);
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
    AND c.dia_operacional = v_hoje
    AND GREATEST(0, c.ideal_amanha - c.final_sobra) > 0;
  
  v_detalhes_lojas := COALESCE(v_detalhes_lojas, '[]'::jsonb);
  
  v_perda_adicional := COALESCE(v_item_data.perda_percentual_adicional, 0);
  
  -- 7. Calcular unidades programadas e peso baseado no tipo de unidade
  
  -- ===== LOTE_MASSEIRA: Cálculo Industrial =====
  IF v_item_data.unidade_medida = 'lote_masseira' THEN
    -- Validar campos obrigatórios
    IF v_item_data.massa_gerada_por_lote_kg IS NULL OR v_item_data.farinha_por_lote_kg IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Campos industriais (massa/farinha por lote) não configurados');
    END IF;
    
    -- PROTEÇÃO: Peso médio operacional com fallback seguro
    -- Se peso_medio_operacional estiver fora da faixa válida (100g-5000g), usar peso_alvo ou média
    v_peso_medio_g := v_item_data.peso_medio_operacional_bolinha_g;
    
    IF v_peso_medio_g IS NULL OR v_peso_medio_g < 100 OR v_peso_medio_g > 5000 THEN
      v_peso_medio_g := COALESCE(
        v_item_data.peso_alvo_bolinha_g,
        (COALESCE(v_item_data.peso_minimo_bolinha_g, 400) + COALESCE(v_item_data.peso_maximo_bolinha_g, 450)) / 2
      );
    END IF;
    
    IF v_peso_medio_g IS NULL OR v_peso_medio_g <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Peso médio operacional não definido ou inválido');
    END IF;
    
    -- Unidades por lote = (massa gerada em kg * 1000) / peso médio em g
    v_unidades_por_lote := FLOOR((v_item_data.massa_gerada_por_lote_kg * 1000) / v_peso_medio_g);
    
    IF v_unidades_por_lote <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cálculo de unidades por lote inválido');
    END IF;
    
    -- Lotes necessários (arredondando para cima)
    v_lotes_necessarios := CEIL(v_necessidade_total::numeric / v_unidades_por_lote);
    
    -- Farinha necessária
    v_farinha_necessaria := v_lotes_necessarios * v_item_data.farinha_por_lote_kg;
    
    -- Unidades estimadas (será produzido mais devido ao arredondamento)
    v_unidades_programadas := v_lotes_necessarios * v_unidades_por_lote;
    v_sobra_reserva := v_unidades_programadas - v_necessidade_total;
    
    -- Massa total que será gerada
    v_massa_total_kg := v_lotes_necessarios * v_item_data.massa_gerada_por_lote_kg;
    v_peso_programado_total := v_massa_total_kg;
    
    -- Criar/atualizar registro único para LOTE_MASSEIRA
    SELECT id INTO v_registro_existente
    FROM producao_registros
    WHERE item_id = p_item_id
      AND status = 'a_produzir'
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
        usuario_nome = p_usuario_nome,
        data_referencia = v_hoje,
        lotes_masseira = v_lotes_necessarios,
        farinha_consumida_kg = v_farinha_necessaria,
        massa_total_gerada_kg = v_massa_total_kg
      WHERE id = v_registro_existente;
      
      RETURN jsonb_build_object(
        'success', true,
        'type', 'lote_masseira_updated',
        'registro_id', v_registro_existente,
        'lotes', v_lotes_necessarios,
        'farinha_kg', v_farinha_necessaria,
        'unidades_estimadas', v_unidades_programadas,
        'peso_medio_usado', v_peso_medio_g,
        'dia_operacional_usado', v_hoje
      );
    ELSE
      INSERT INTO producao_registros (
        item_id, item_nome, status, unidades_programadas, peso_programado_kg,
        demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
        usuario_id, usuario_nome, organization_id, data_referencia,
        lotes_masseira, farinha_consumida_kg, massa_total_gerada_kg
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
        p_organization_id,
        v_hoje,
        v_lotes_necessarios,
        v_farinha_necessaria,
        v_massa_total_kg
      )
      RETURNING id INTO v_registro_existente;
      
      RETURN jsonb_build_object(
        'success', true,
        'type', 'lote_masseira_created',
        'registro_id', v_registro_existente,
        'lotes', v_lotes_necessarios,
        'farinha_kg', v_farinha_necessaria,
        'unidades_estimadas', v_unidades_programadas,
        'peso_medio_usado', v_peso_medio_g,
        'dia_operacional_usado', v_hoje
      );
    END IF;
  
  -- ===== TRAÇO/LOTE: Produção em Lotes =====
  ELSIF v_item_data.unidade_medida IN ('traco', 'lote') AND v_item_data.equivalencia_traco IS NOT NULL AND v_item_data.consumo_por_traco_g IS NOT NULL THEN
    v_tracos_necessarios := CEIL(v_necessidade_total::numeric / v_item_data.equivalencia_traco);
    v_unidades_programadas := v_tracos_necessarios * v_item_data.equivalencia_traco;
    v_sobra_reserva := v_unidades_programadas - v_necessidade_total;
    -- Peso base do traço
    v_peso_base := (v_tracos_necessarios * v_item_data.consumo_por_traco_g) / 1000.0;
    -- Aplicar perda adicional
    v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
  ELSE
    -- Unidades simples
    v_unidades_programadas := v_necessidade_total;
    -- Peso base das unidades
    v_peso_base := (v_unidades_programadas * COALESCE(v_item_data.peso_unitario_g, 0)) / 1000.0;
    -- Aplicar perda adicional
    v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
  END IF;
  
  -- 8. Criar/atualizar registros de produção para TRAÇO/LOTE
  IF v_item_data.usa_traco_massa = true AND v_item_data.unidade_medida IN ('traco', 'lote') AND v_item_data.equivalencia_traco IS NOT NULL THEN
    v_lote_id := gen_random_uuid();
    
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND status = 'a_produzir'
      AND organization_id = p_organization_id;
    
    FOR v_seq IN 1..v_tracos_necessarios LOOP
      -- Peso por traço individual com perda
      v_peso_base := v_item_data.consumo_por_traco_g / 1000.0;
      v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
      
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
        v_peso_programado_total,
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
      'tracos_criados', v_tracos_necessarios,
      'dia_operacional_usado', v_hoje
    );
  ELSE
    -- Unidades simples (não traço, não lote_masseira)
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
        usuario_nome = p_usuario_nome,
        data_referencia = v_hoje
      WHERE id = v_registro_existente;
      
      RETURN jsonb_build_object(
        'success', true,
        'type', 'updated',
        'registro_id', v_registro_existente,
        'dia_operacional_usado', v_hoje
      );
    ELSE
      INSERT INTO producao_registros (
        item_id, item_nome, status, unidades_programadas, peso_programado_kg,
        demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
        usuario_id, usuario_nome, organization_id, data_referencia
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
        p_organization_id,
        v_hoje
      )
      RETURNING id INTO v_registro_existente;
      
      RETURN jsonb_build_object(
        'success', true,
        'type', 'created',
        'registro_id', v_registro_existente,
        'dia_operacional_usado', v_hoje
      );
    END IF;
  END IF;
END;
$function$;