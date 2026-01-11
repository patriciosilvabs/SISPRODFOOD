-- =============================================================================
-- MIGRAÇÃO: Implementar Lógica de Cutoff para Demanda Incremental
-- =============================================================================

-- 1. Criar tabela para armazenar demanda congelada no cutoff
CREATE TABLE IF NOT EXISTS public.demanda_congelada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_porcionado_id UUID NOT NULL REFERENCES public.itens_porcionados(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dia_producao DATE NOT NULL,
  demanda_total INTEGER NOT NULL,
  detalhes_lojas JSONB DEFAULT '[]'::jsonb,
  congelado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_porcionado_id, organization_id, dia_producao)
);

-- Habilitar RLS
ALTER TABLE public.demanda_congelada ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver demanda congelada da sua organização"
  ON public.demanda_congelada FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Usuários podem inserir demanda congelada da sua organização"
  ON public.demanda_congelada FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Usuários podem atualizar demanda congelada da sua organização"
  ON public.demanda_congelada FOR UPDATE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_demanda_congelada_item_dia 
  ON public.demanda_congelada(item_porcionado_id, dia_producao);
CREATE INDEX IF NOT EXISTS idx_demanda_congelada_org_dia 
  ON public.demanda_congelada(organization_id, dia_producao);

-- =============================================================================
-- 2. Função para congelar demanda no cutoff
-- =============================================================================
CREATE OR REPLACE FUNCTION public.congelar_demanda_cutoff(
  p_organization_id UUID,
  p_dia_producao DATE DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dia DATE;
  v_item RECORD;
  v_demanda_total INTEGER;
  v_detalhes JSONB;
  v_itens_congelados INTEGER := 0;
BEGIN
  v_dia := COALESCE(p_dia_producao, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date);
  
  -- Para cada item com demanda no dia
  FOR v_item IN 
    SELECT DISTINCT item_porcionado_id
    FROM contagem_porcionados
    WHERE organization_id = p_organization_id
      AND dia_operacional = v_dia
  LOOP
    -- Calcular demanda total do item
    SELECT 
      COALESCE(SUM(GREATEST(0, ideal_amanha - final_sobra)), 0)::integer,
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'loja_id', c.loja_id,
          'loja_nome', l.nome,
          'quantidade', GREATEST(0, c.ideal_amanha - c.final_sobra)
        )
      ) FILTER (WHERE GREATEST(0, c.ideal_amanha - c.final_sobra) > 0), '[]'::jsonb)
    INTO v_demanda_total, v_detalhes
    FROM contagem_porcionados c
    JOIN lojas l ON l.id = c.loja_id
    WHERE c.item_porcionado_id = v_item.item_porcionado_id
      AND c.organization_id = p_organization_id
      AND c.dia_operacional = v_dia;
    
    -- Inserir ou atualizar demanda congelada
    INSERT INTO demanda_congelada (
      item_porcionado_id, organization_id, dia_producao, 
      demanda_total, detalhes_lojas, congelado_em
    ) VALUES (
      v_item.item_porcionado_id, p_organization_id, v_dia,
      v_demanda_total, v_detalhes, NOW()
    )
    ON CONFLICT (item_porcionado_id, organization_id, dia_producao)
    DO UPDATE SET
      demanda_total = v_demanda_total,
      detalhes_lojas = v_detalhes,
      congelado_em = NOW();
    
    v_itens_congelados := v_itens_congelados + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'dia_producao', v_dia,
    'itens_congelados', v_itens_congelados
  );
END;
$$;

-- =============================================================================
-- 3. Atualizar função criar_ou_atualizar_producao_registro com lógica de cutoff
-- =============================================================================
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
  p_item_id uuid, 
  p_organization_id uuid, 
  p_usuario_id uuid, 
  p_usuario_nome text, 
  p_dia_operacional date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item_data record;
  v_contagens record;
  v_demanda_lojas integer := 0;
  v_demanda_congelada integer := NULL;
  v_demanda_incremental integer := 0;
  v_demanda_base integer := 0;
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
  v_peso_medio_anterior numeric;
  v_unidades_por_lote integer;
  v_lotes_necessarios integer;
  v_farinha_necessaria numeric;
  v_massa_total_kg numeric;
  v_peso_corrigido boolean := false;
  -- Variável para MARGEM
  v_margem numeric;
  v_capacidade_com_margem numeric;
  -- Variáveis de produção em andamento
  v_unidades_em_andamento integer := 0;
  v_demanda_ajustada integer;
BEGIN
  -- USAR DIA OPERACIONAL DO PARÂMETRO OU CALCULAR SE NÃO FORNECIDO
  IF p_dia_operacional IS NOT NULL THEN
    v_hoje := p_dia_operacional;
  ELSE
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;

  -- 1. Buscar dados do item
  SELECT 
    nome, peso_unitario_g, unidade_medida, equivalencia_traco, 
    consumo_por_traco_g, usa_traco_massa,
    perda_percentual_adicional,
    farinha_por_lote_kg, massa_gerada_por_lote_kg,
    peso_minimo_bolinha_g, peso_maximo_bolinha_g, peso_alvo_bolinha_g,
    peso_medio_operacional_bolinha_g,
    margem_lote_percentual
  INTO v_item_data
  FROM itens_porcionados
  WHERE id = p_item_id AND organization_id = p_organization_id;
  
  IF v_item_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item não encontrado');
  END IF;
  
  -- 2. Calcular demanda ATUAL de todas as lojas
  SELECT 
    COALESCE(SUM(GREATEST(0, ideal_amanha - final_sobra)), 0)::integer
  INTO v_demanda_lojas
  FROM contagem_porcionados
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND dia_operacional = v_hoje
    AND GREATEST(0, ideal_amanha - final_sobra) > 0;
  
  -- 3. Buscar demanda CONGELADA (se existir)
  SELECT demanda_total INTO v_demanda_congelada
  FROM demanda_congelada
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND dia_producao = v_hoje;
  
  -- 4. Calcular demanda base considerando cutoff
  IF v_demanda_congelada IS NULL THEN
    -- Antes do cutoff: usar demanda atual
    v_demanda_base := v_demanda_lojas;
  ELSE
    -- Depois do cutoff: calcular incremental
    v_demanda_incremental := GREATEST(0, v_demanda_lojas - v_demanda_congelada);
    v_demanda_base := v_demanda_congelada + v_demanda_incremental;
  END IF;
  
  -- 5. Calcular unidades em andamento (em_preparo + em_porcionamento)
  SELECT COALESCE(SUM(unidades_programadas), 0)::integer
  INTO v_unidades_em_andamento
  FROM producao_registros
  WHERE item_id = p_item_id
    AND status IN ('em_preparo', 'em_porcionamento')
    AND organization_id = p_organization_id
    AND data_referencia = v_hoje;

  -- 6. Calcular demanda ajustada (NÃO subtrai finalizados!)
  v_demanda_ajustada := GREATEST(0, v_demanda_base - v_unidades_em_andamento);
  
  -- Se demanda ajustada for zero e já há produção em andamento
  IF v_demanda_ajustada <= 0 AND v_unidades_em_andamento > 0 THEN
    -- Deletar lotes pendentes (produção em andamento já cobre)
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND status = 'a_produzir'
      AND organization_id = p_organization_id
      AND data_referencia = v_hoje;
    
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Produção em andamento já atende demanda',
      'type', 'demanda_atendida',
      'demanda_lojas', v_demanda_lojas,
      'demanda_congelada', v_demanda_congelada,
      'demanda_incremental', v_demanda_incremental,
      'unidades_em_andamento', v_unidades_em_andamento,
      'dia_operacional_usado', v_hoje
    );
  END IF;
  
  -- Se não há demanda base, não criar registro
  IF v_demanda_base = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Sem demanda para produção', 'dia_operacional_usado', v_hoje);
  END IF;
  
  -- 7. Determinar dia da semana de amanhã
  v_dia_semana := CASE EXTRACT(DOW FROM v_hoje + interval '1 day')
    WHEN 0 THEN 'domingo'
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END;
  
  -- 8. Buscar reserva configurada para o dia
  EXECUTE format(
    'SELECT COALESCE(%I, 0) FROM itens_reserva_diaria WHERE item_porcionado_id = $1 AND organization_id = $2',
    v_dia_semana
  ) INTO v_reserva_dia USING p_item_id, p_organization_id;
  
  v_reserva_dia := COALESCE(v_reserva_dia, 0);
  
  -- 9. Calcular necessidade total (demanda ajustada + reserva)
  v_necessidade_total := v_demanda_ajustada + v_reserva_dia;
  
  -- 10. Construir detalhes por loja
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
  
  -- 11. Calcular unidades programadas e peso baseado no tipo de unidade
  
  -- ===== LOTE_MASSEIRA: Cálculo Industrial =====
  IF v_item_data.unidade_medida = 'lote_masseira' THEN
    IF v_item_data.massa_gerada_por_lote_kg IS NULL OR v_item_data.farinha_por_lote_kg IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Campos industriais (massa/farinha por lote) não configurados');
    END IF;
    
    v_peso_medio_anterior := v_item_data.peso_medio_operacional_bolinha_g;
    v_peso_medio_g := v_item_data.peso_medio_operacional_bolinha_g;
    
    IF v_peso_medio_g IS NULL 
       OR v_peso_medio_g <= 0
       OR (v_item_data.peso_minimo_bolinha_g IS NOT NULL AND v_peso_medio_g < v_item_data.peso_minimo_bolinha_g)
       OR (v_item_data.peso_maximo_bolinha_g IS NOT NULL AND v_peso_medio_g > v_item_data.peso_maximo_bolinha_g) THEN
      
      v_peso_medio_g := COALESCE(
        v_item_data.peso_alvo_bolinha_g,
        (COALESCE(v_item_data.peso_minimo_bolinha_g, 400) + COALESCE(v_item_data.peso_maximo_bolinha_g, 450)) / 2
      );
      
      UPDATE itens_porcionados
      SET peso_medio_operacional_bolinha_g = v_peso_medio_g,
          updated_at = NOW()
      WHERE id = p_item_id AND organization_id = p_organization_id;
      
      v_peso_corrigido := true;
      
      INSERT INTO movimentacoes_estoque_log (
        entidade_tipo, entidade_id, entidade_nome,
        tipo_movimentacao, quantidade,
        estoque_anterior, estoque_resultante,
        usuario_id, usuario_nome,
        unidade_origem, observacao, organization_id
      ) VALUES (
        'porcionado', p_item_id, v_item_data.nome,
        'ajuste_positivo', 0,
        COALESCE(v_peso_medio_anterior, 0), v_peso_medio_g,
        p_usuario_id, p_usuario_nome,
        'sistema', 
        format('Auto-correção peso_medio_operacional: %s → %s g (faixa válida: %s-%s g)', 
          COALESCE(v_peso_medio_anterior::text, 'NULL'),
          v_peso_medio_g,
          COALESCE(v_item_data.peso_minimo_bolinha_g::text, 'não definido'),
          COALESCE(v_item_data.peso_maximo_bolinha_g::text, 'não definido')
        ),
        p_organization_id
      );
    END IF;
    
    IF v_peso_medio_g IS NULL OR v_peso_medio_g <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Peso médio operacional não definido ou inválido após correção');
    END IF;
    
    v_unidades_por_lote := FLOOR((v_item_data.massa_gerada_por_lote_kg * 1000) / v_peso_medio_g);
    
    IF v_unidades_por_lote <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cálculo de unidades por lote inválido');
    END IF;
    
    v_margem := COALESCE(v_item_data.margem_lote_percentual, 0);
    v_capacidade_com_margem := v_unidades_por_lote * (1 + v_margem / 100);
    
    v_lotes_necessarios := CEIL(v_necessidade_total::numeric / v_capacidade_com_margem);
    
    v_farinha_necessaria := v_lotes_necessarios * v_item_data.farinha_por_lote_kg;
    v_unidades_programadas := v_lotes_necessarios * v_unidades_por_lote;
    v_sobra_reserva := v_unidades_programadas - v_necessidade_total;
    v_massa_total_kg := v_lotes_necessarios * v_item_data.massa_gerada_por_lote_kg;
    v_peso_programado_total := v_massa_total_kg;
    
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND status = 'a_produzir'
      AND organization_id = p_organization_id
      AND data_referencia = v_hoje;
    
    IF v_lotes_necessarios > 1 THEN
      v_lote_id := gen_random_uuid();
      
      FOR v_seq IN 1..v_lotes_necessarios LOOP
        INSERT INTO producao_registros (
          item_id, item_nome, status, 
          unidades_programadas, peso_programado_kg,
          demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
          usuario_id, usuario_nome, organization_id, data_referencia,
          lotes_masseira, farinha_consumida_kg, massa_total_gerada_kg,
          sequencia_traco, lote_producao_id, bloqueado_por_traco_anterior,
          timer_status
        ) VALUES (
          p_item_id,
          v_item_data.nome,
          'a_produzir',
          v_unidades_por_lote,
          v_item_data.massa_gerada_por_lote_kg,
          CASE WHEN v_seq = 1 THEN v_demanda_base ELSE NULL END,
          CASE WHEN v_seq = 1 THEN v_reserva_dia ELSE NULL END,
          CASE WHEN v_seq = v_lotes_necessarios THEN v_sobra_reserva ELSE 0 END,
          CASE WHEN v_seq = 1 THEN v_detalhes_lojas ELSE '[]'::jsonb END,
          p_usuario_id,
          p_usuario_nome,
          p_organization_id,
          v_hoje,
          1,
          v_item_data.farinha_por_lote_kg,
          v_item_data.massa_gerada_por_lote_kg,
          v_seq,
          v_lote_id,
          v_seq > 1,
          'aguardando'
        );
      END LOOP;
      
      RETURN jsonb_build_object(
        'success', true,
        'type', 'lote_masseira_queue',
        'lotes_criados', v_lotes_necessarios,
        'unidades_por_lote', v_unidades_por_lote,
        'peso_medio_usado', v_peso_medio_g,
        'peso_corrigido', v_peso_corrigido,
        'margem_aplicada', v_margem,
        'capacidade_com_margem', v_capacidade_com_margem,
        'dia_operacional_usado', v_hoje,
        'demanda_lojas', v_demanda_lojas,
        'demanda_congelada', v_demanda_congelada,
        'demanda_incremental', v_demanda_incremental,
        'demanda_base', v_demanda_base,
        'unidades_em_andamento', v_unidades_em_andamento
      );
    ELSE
      INSERT INTO producao_registros (
        item_id, item_nome, status, unidades_programadas, peso_programado_kg,
        demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
        usuario_id, usuario_nome, organization_id, data_referencia,
        lotes_masseira, farinha_consumida_kg, massa_total_gerada_kg,
        sequencia_traco
      ) VALUES (
        p_item_id,
        v_item_data.nome,
        'a_produzir',
        v_unidades_programadas,
        v_peso_programado_total,
        v_demanda_base,
        v_reserva_dia,
        v_sobra_reserva,
        v_detalhes_lojas,
        p_usuario_id,
        p_usuario_nome,
        p_organization_id,
        v_hoje,
        v_lotes_necessarios,
        v_farinha_necessaria,
        v_massa_total_kg,
        1
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
        'peso_corrigido', v_peso_corrigido,
        'margem_aplicada', v_margem,
        'capacidade_com_margem', v_capacidade_com_margem,
        'dia_operacional_usado', v_hoje,
        'demanda_lojas', v_demanda_lojas,
        'demanda_congelada', v_demanda_congelada,
        'demanda_incremental', v_demanda_incremental,
        'demanda_base', v_demanda_base,
        'unidades_em_andamento', v_unidades_em_andamento
      );
    END IF;
  
  -- ===== TRAÇO/LOTE: Produção em Lotes =====
  ELSIF v_item_data.unidade_medida IN ('traco', 'lote') AND v_item_data.equivalencia_traco IS NOT NULL AND v_item_data.consumo_por_traco_g IS NOT NULL THEN
    v_tracos_necessarios := CEIL(v_necessidade_total::numeric / v_item_data.equivalencia_traco);
    v_unidades_programadas := v_tracos_necessarios * v_item_data.equivalencia_traco;
    v_sobra_reserva := v_unidades_programadas - v_necessidade_total;
    v_peso_base := (v_tracos_necessarios * v_item_data.consumo_por_traco_g) / 1000.0;
    v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
  ELSE
    v_unidades_programadas := v_necessidade_total;
    v_peso_base := (v_unidades_programadas * COALESCE(v_item_data.peso_unitario_g, 0)) / 1000.0;
    v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
  END IF;
  
  -- 12. Criar/atualizar registros de produção para TRAÇO/LOTE
  IF v_item_data.usa_traco_massa = true AND v_item_data.unidade_medida IN ('traco', 'lote') AND v_item_data.equivalencia_traco IS NOT NULL THEN
    v_lote_id := gen_random_uuid();
    
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND status = 'a_produzir'
      AND organization_id = p_organization_id
      AND data_referencia = v_hoje;
    
    FOR v_seq IN 1..v_tracos_necessarios LOOP
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
        CASE WHEN v_seq = 1 THEN v_demanda_base ELSE NULL END,
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
      'dia_operacional_usado', v_hoje,
      'demanda_lojas', v_demanda_lojas,
      'demanda_congelada', v_demanda_congelada,
      'demanda_incremental', v_demanda_incremental,
      'demanda_base', v_demanda_base,
      'unidades_em_andamento', v_unidades_em_andamento
    );
  ELSE
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND status = 'a_produzir'
      AND organization_id = p_organization_id
      AND data_referencia = v_hoje;
    
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
      v_demanda_base,
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
      'dia_operacional_usado', v_hoje,
      'demanda_lojas', v_demanda_lojas,
      'demanda_congelada', v_demanda_congelada,
      'demanda_incremental', v_demanda_incremental,
      'demanda_base', v_demanda_base,
      'unidades_em_andamento', v_unidades_em_andamento
    );
  END IF;
END;
$function$;