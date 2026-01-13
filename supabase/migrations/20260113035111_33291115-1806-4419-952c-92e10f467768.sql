-- Add columns for production status-based blocking
ALTER TABLE producao_registros
ADD COLUMN IF NOT EXISTS demanda_base_snapshot INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_incremental BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN producao_registros.demanda_base_snapshot IS 
'Snapshot da demanda total no momento que este lote iniciou preparo';

COMMENT ON COLUMN producao_registros.is_incremental IS 
'Indica se este lote foi gerado apos inicio da producao (lote extra)';

-- Add origem_lote column to audit table
ALTER TABLE contagem_porcionados_audit
ADD COLUMN IF NOT EXISTS origem_lote TEXT DEFAULT NULL;

COMMENT ON COLUMN contagem_porcionados_audit.origem_lote IS 
'Indica se a contagem gerou lote inicial ou incremental';

-- Rewrite criar_ou_atualizar_producao_registro to use production status-based blocking
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
  p_item_id UUID, 
  p_organization_id UUID, 
  p_usuario_id UUID, 
  p_usuario_nome TEXT, 
  p_dia_operacional DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item_data record;
  v_demanda_atual INTEGER := 0;
  v_demanda_planejada INTEGER := 0;
  v_tem_producao_ativa BOOLEAN := false;
  v_reserva_dia INTEGER := 0;
  v_necessidade_total INTEGER;
  v_unidades_programadas INTEGER;
  v_peso_programado_total NUMERIC;
  v_peso_base NUMERIC;
  v_perda_adicional NUMERIC;
  v_sobra_reserva INTEGER := 0;
  v_detalhes_lojas JSONB := '[]'::JSONB;
  v_dia_semana TEXT;
  v_hoje DATE;
  v_tracos_necessarios INTEGER;
  v_lote_id UUID;
  v_seq INTEGER;
  v_registro_existente UUID;
  -- LOTE_MASSEIRA variables
  v_peso_medio_g NUMERIC;
  v_peso_medio_anterior NUMERIC;
  v_unidades_por_lote INTEGER;
  v_lotes_necessarios INTEGER;
  v_farinha_necessaria NUMERIC;
  v_massa_total_kg NUMERIC;
  v_peso_corrigido BOOLEAN := false;
  -- MARGEM
  v_margem NUMERIC;
  v_capacidade_com_margem NUMERIC;
  -- Incremental calculation
  v_quantidade_incremental INTEGER;
BEGIN
  -- USE PROVIDED OR CALCULATE OPERATIONAL DAY
  IF p_dia_operacional IS NOT NULL THEN
    v_hoje := p_dia_operacional;
  ELSE
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  END IF;

  -- 1. Fetch item data
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
  
  -- 2. Check if there's active production (em_preparo, em_porcionamento, finalizado)
  SELECT EXISTS (
    SELECT 1 FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND status IN ('em_preparo', 'em_porcionamento', 'finalizado')
      AND organization_id = p_organization_id
  ) INTO v_tem_producao_ativa;
  
  -- 3. Calculate current demand from all stores
  SELECT COALESCE(SUM(GREATEST(0, ideal_amanha - final_sobra)), 0)::INTEGER
  INTO v_demanda_atual
  FROM contagem_porcionados
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND dia_operacional = v_hoje
    AND GREATEST(0, ideal_amanha - final_sobra) > 0;
  
  -- 4. Determine weekday for tomorrow's reserve
  v_dia_semana := CASE EXTRACT(DOW FROM v_hoje + INTERVAL '1 day')
    WHEN 0 THEN 'domingo'
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END;
  
  -- 5. Fetch configured reserve for the day
  EXECUTE format(
    'SELECT COALESCE(%I, 0) FROM itens_reserva_diaria WHERE item_porcionado_id = $1 AND organization_id = $2',
    v_dia_semana
  ) INTO v_reserva_dia USING p_item_id, p_organization_id;
  
  v_reserva_dia := COALESCE(v_reserva_dia, 0);
  v_perda_adicional := COALESCE(v_item_data.perda_percentual_adicional, 0);
  
  -- 6. Build store details
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
  
  v_detalhes_lojas := COALESCE(v_detalhes_lojas, '[]'::JSONB);
  
  -- ========== SCENARIO B: PRODUCTION ACTIVE - CALCULATE INCREMENTAL ==========
  IF v_tem_producao_ativa THEN
    -- Get already planned demand (all batches for today except cancelled)
    SELECT COALESCE(SUM(unidades_programadas), 0)::INTEGER
    INTO v_demanda_planejada
    FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND status != 'cancelado'
      AND organization_id = p_organization_id;
    
    -- Calculate incremental amount
    v_quantidade_incremental := GREATEST(0, (v_demanda_atual + v_reserva_dia) - v_demanda_planejada);
    
    -- If no incremental needed, just return
    IF v_quantidade_incremental <= 0 THEN
      RETURN jsonb_build_object(
        'success', true,
        'type', 'no_incremental_needed',
        'message', 'Demanda atual já coberta pelos lotes existentes',
        'demanda_atual', v_demanda_atual,
        'demanda_planejada', v_demanda_planejada,
        'producao_ativa', true,
        'dia_operacional_usado', v_hoje
      );
    END IF;
    
    -- Create INCREMENTAL batch for the extra demand
    v_necessidade_total := v_quantidade_incremental;
    
    -- Calculate based on item type
    IF v_item_data.unidade_medida = 'lote_masseira' THEN
      -- LOTE_MASSEIRA incremental
      IF v_item_data.massa_gerada_por_lote_kg IS NULL OR v_item_data.farinha_por_lote_kg IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Campos industriais não configurados');
      END IF;
      
      v_peso_medio_g := COALESCE(v_item_data.peso_medio_operacional_bolinha_g, 
        COALESCE(v_item_data.peso_alvo_bolinha_g, 
          (COALESCE(v_item_data.peso_minimo_bolinha_g, 400) + COALESCE(v_item_data.peso_maximo_bolinha_g, 450)) / 2
        )
      );
      
      v_unidades_por_lote := FLOOR((v_item_data.massa_gerada_por_lote_kg * 1000) / v_peso_medio_g);
      v_margem := COALESCE(v_item_data.margem_lote_percentual, 0);
      v_capacidade_com_margem := v_unidades_por_lote * (1 + v_margem / 100);
      v_lotes_necessarios := CEIL(v_necessidade_total::NUMERIC / v_capacidade_com_margem);
      
      v_farinha_necessaria := v_lotes_necessarios * v_item_data.farinha_por_lote_kg;
      v_unidades_programadas := v_lotes_necessarios * v_unidades_por_lote;
      v_massa_total_kg := v_lotes_necessarios * v_item_data.massa_gerada_por_lote_kg;
      v_peso_programado_total := v_massa_total_kg;
      
      INSERT INTO producao_registros (
        item_id, item_nome, status, unidades_programadas, peso_programado_kg,
        demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
        usuario_id, usuario_nome, organization_id, data_referencia,
        lotes_masseira, farinha_consumida_kg, massa_total_gerada_kg,
        is_incremental, timer_status
      ) VALUES (
        p_item_id,
        v_item_data.nome,
        'a_produzir',
        v_unidades_programadas,
        v_peso_programado_total,
        v_demanda_atual,
        v_reserva_dia,
        v_unidades_programadas - v_necessidade_total,
        v_detalhes_lojas,
        p_usuario_id,
        p_usuario_nome,
        p_organization_id,
        v_hoje,
        v_lotes_necessarios,
        v_farinha_necessaria,
        v_massa_total_kg,
        true,
        'aguardando'
      )
      RETURNING id INTO v_registro_existente;
      
    ELSIF v_item_data.unidade_medida IN ('traco', 'lote') AND v_item_data.equivalencia_traco IS NOT NULL THEN
      -- TRAÇO/LOTE incremental
      v_tracos_necessarios := CEIL(v_necessidade_total::NUMERIC / v_item_data.equivalencia_traco);
      v_unidades_programadas := v_tracos_necessarios * v_item_data.equivalencia_traco;
      v_sobra_reserva := v_unidades_programadas - v_necessidade_total;
      v_peso_base := COALESCE(v_item_data.consumo_por_traco_g, 0) * v_tracos_necessarios / 1000.0;
      v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
      
      v_lote_id := gen_random_uuid();
      
      FOR v_seq IN 1..v_tracos_necessarios LOOP
        INSERT INTO producao_registros (
          item_id, item_nome, status, unidades_programadas, peso_programado_kg,
          demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
          usuario_id, usuario_nome, organization_id,
          sequencia_traco, lote_producao_id, bloqueado_por_traco_anterior,
          timer_status, data_referencia, is_incremental
        ) VALUES (
          p_item_id,
          v_item_data.nome,
          'a_produzir',
          v_item_data.equivalencia_traco,
          COALESCE(v_item_data.consumo_por_traco_g, 0) / 1000.0 * (1 + v_perda_adicional / 100.0),
          CASE WHEN v_seq = 1 THEN v_demanda_atual ELSE NULL END,
          CASE WHEN v_seq = 1 THEN v_reserva_dia ELSE NULL END,
          CASE WHEN v_seq = v_tracos_necessarios THEN v_sobra_reserva ELSE 0 END,
          CASE WHEN v_seq = 1 THEN v_detalhes_lojas ELSE '[]'::JSONB END,
          p_usuario_id,
          p_usuario_nome,
          p_organization_id,
          v_seq,
          v_lote_id,
          v_seq > 1,
          'aguardando',
          v_hoje,
          true
        );
      END LOOP;
      
    ELSE
      -- Simple unit incremental
      v_unidades_programadas := v_necessidade_total;
      v_peso_base := (v_unidades_programadas * COALESCE(v_item_data.peso_unitario_g, 0)) / 1000.0;
      v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
      
      INSERT INTO producao_registros (
        item_id, item_nome, status, unidades_programadas, peso_programado_kg,
        demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
        usuario_id, usuario_nome, organization_id, data_referencia, is_incremental
      ) VALUES (
        p_item_id,
        v_item_data.nome,
        'a_produzir',
        v_unidades_programadas,
        v_peso_programado_total,
        v_demanda_atual,
        v_reserva_dia,
        0,
        v_detalhes_lojas,
        p_usuario_id,
        p_usuario_nome,
        p_organization_id,
        v_hoje,
        true
      )
      RETURNING id INTO v_registro_existente;
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'type', 'incremental_created',
      'quantidade_incremental', v_quantidade_incremental,
      'demanda_atual', v_demanda_atual,
      'demanda_planejada', v_demanda_planejada,
      'producao_ativa', true,
      'dia_operacional_usado', v_hoje
    );
  END IF;
  
  -- ========== SCENARIO A: NO ACTIVE PRODUCTION - RECALCULATE FREELY ==========
  
  -- If no demand and no reserve, no need to create
  IF v_demanda_atual = 0 AND v_reserva_dia = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Sem demanda para produção', 'dia_operacional_usado', v_hoje);
  END IF;
  
  v_necessidade_total := v_demanda_atual + v_reserva_dia;
  
  -- Calculate based on item type
  IF v_item_data.unidade_medida = 'lote_masseira' THEN
    -- ===== LOTE_MASSEIRA =====
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
      SET peso_medio_operacional_bolinha_g = v_peso_medio_g, updated_at = NOW()
      WHERE id = p_item_id AND organization_id = p_organization_id;
      
      v_peso_corrigido := true;
    END IF;
    
    IF v_peso_medio_g IS NULL OR v_peso_medio_g <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Peso médio operacional não definido ou inválido');
    END IF;
    
    v_unidades_por_lote := FLOOR((v_item_data.massa_gerada_por_lote_kg * 1000) / v_peso_medio_g);
    
    IF v_unidades_por_lote <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cálculo de unidades por lote inválido');
    END IF;
    
    v_margem := COALESCE(v_item_data.margem_lote_percentual, 0);
    v_capacidade_com_margem := v_unidades_por_lote * (1 + v_margem / 100);
    v_lotes_necessarios := CEIL(v_necessidade_total::NUMERIC / v_capacidade_com_margem);
    
    v_farinha_necessaria := v_lotes_necessarios * v_item_data.farinha_por_lote_kg;
    v_unidades_programadas := v_lotes_necessarios * v_unidades_por_lote;
    v_sobra_reserva := v_unidades_programadas - v_necessidade_total;
    v_massa_total_kg := v_lotes_necessarios * v_item_data.massa_gerada_por_lote_kg;
    v_peso_programado_total := v_massa_total_kg;
    
    -- Delete existing a_produzir batches
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
          timer_status, is_incremental
        ) VALUES (
          p_item_id, v_item_data.nome, 'a_produzir',
          v_unidades_por_lote, v_item_data.massa_gerada_por_lote_kg,
          CASE WHEN v_seq = 1 THEN v_demanda_atual ELSE NULL END,
          CASE WHEN v_seq = 1 THEN v_reserva_dia ELSE NULL END,
          CASE WHEN v_seq = v_lotes_necessarios THEN v_sobra_reserva ELSE 0 END,
          CASE WHEN v_seq = 1 THEN v_detalhes_lojas ELSE '[]'::JSONB END,
          p_usuario_id, p_usuario_nome, p_organization_id, v_hoje,
          1, v_item_data.farinha_por_lote_kg, v_item_data.massa_gerada_por_lote_kg,
          v_seq, v_lote_id, v_seq > 1,
          'aguardando', false
        );
      END LOOP;
      
      RETURN jsonb_build_object(
        'success', true, 'type', 'lote_masseira_queue',
        'lotes_criados', v_lotes_necessarios,
        'unidades_por_lote', v_unidades_por_lote,
        'peso_medio_usado', v_peso_medio_g,
        'dia_operacional_usado', v_hoje,
        'producao_ativa', false
      );
    ELSE
      INSERT INTO producao_registros (
        item_id, item_nome, status, unidades_programadas, peso_programado_kg,
        demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
        usuario_id, usuario_nome, organization_id, data_referencia,
        lotes_masseira, farinha_consumida_kg, massa_total_gerada_kg, is_incremental
      ) VALUES (
        p_item_id, v_item_data.nome, 'a_produzir',
        v_unidades_programadas, v_peso_programado_total,
        v_demanda_atual, v_reserva_dia, v_sobra_reserva, v_detalhes_lojas,
        p_usuario_id, p_usuario_nome, p_organization_id, v_hoje,
        v_lotes_necessarios, v_farinha_necessaria, v_massa_total_kg, false
      )
      RETURNING id INTO v_registro_existente;
      
      RETURN jsonb_build_object(
        'success', true, 'type', 'lote_masseira_created',
        'registro_id', v_registro_existente,
        'dia_operacional_usado', v_hoje,
        'producao_ativa', false
      );
    END IF;
  
  ELSIF v_item_data.unidade_medida IN ('traco', 'lote') AND v_item_data.equivalencia_traco IS NOT NULL AND v_item_data.consumo_por_traco_g IS NOT NULL THEN
    -- ===== TRAÇO/LOTE =====
    v_tracos_necessarios := CEIL(v_necessidade_total::NUMERIC / v_item_data.equivalencia_traco);
    v_unidades_programadas := v_tracos_necessarios * v_item_data.equivalencia_traco;
    v_sobra_reserva := v_unidades_programadas - v_necessidade_total;
    v_peso_base := (v_tracos_necessarios * v_item_data.consumo_por_traco_g) / 1000.0;
    v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
  ELSE
    -- ===== SIMPLE UNITS =====
    v_unidades_programadas := v_necessidade_total;
    v_peso_base := (v_unidades_programadas * COALESCE(v_item_data.peso_unitario_g, 0)) / 1000.0;
    v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
  END IF;
  
  -- Handle TRAÇO queue
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
        timer_status, data_referencia, is_incremental
      ) VALUES (
        p_item_id, v_item_data.nome, 'a_produzir',
        v_item_data.equivalencia_traco, v_peso_programado_total,
        CASE WHEN v_seq = 1 THEN v_demanda_atual ELSE NULL END,
        CASE WHEN v_seq = 1 THEN v_reserva_dia ELSE NULL END,
        CASE WHEN v_seq = v_tracos_necessarios THEN v_sobra_reserva ELSE 0 END,
        CASE WHEN v_seq = 1 THEN v_detalhes_lojas ELSE '[]'::JSONB END,
        p_usuario_id, p_usuario_nome, p_organization_id,
        v_seq, v_lote_id, v_seq > 1,
        'aguardando', v_hoje, false
      );
    END LOOP;
    
    RETURN jsonb_build_object(
      'success', true, 'type', 'traco_queue',
      'tracos_criados', v_tracos_necessarios,
      'dia_operacional_usado', v_hoje,
      'producao_ativa', false
    );
  ELSE
    -- Simple batch creation
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND status = 'a_produzir'
      AND organization_id = p_organization_id
      AND data_referencia = v_hoje;
    
    INSERT INTO producao_registros (
      item_id, item_nome, status, unidades_programadas, peso_programado_kg,
      demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
      usuario_id, usuario_nome, organization_id, data_referencia, is_incremental
    ) VALUES (
      p_item_id, v_item_data.nome, 'a_produzir',
      v_unidades_programadas, v_peso_programado_total,
      v_demanda_atual, v_reserva_dia, v_sobra_reserva, v_detalhes_lojas,
      p_usuario_id, p_usuario_nome, p_organization_id, v_hoje, false
    )
    RETURNING id INTO v_registro_existente;
    
    RETURN jsonb_build_object(
      'success', true, 'type', 'created',
      'registro_id', v_registro_existente,
      'dia_operacional_usado', v_hoje,
      'producao_ativa', false
    );
  END IF;
END;
$function$;