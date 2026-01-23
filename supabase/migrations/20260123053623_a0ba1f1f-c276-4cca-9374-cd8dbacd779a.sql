-- Corrigir função criar_ou_atualizar_producao_registro para considerar incrementos_producao
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
  p_item_id uuid, 
  p_organization_id uuid, 
  p_usuario_id uuid, 
  p_usuario_nome text, 
  p_dia_operacional date DEFAULT NULL::date, 
  p_is_incremental boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item_data record;
  v_demanda_contagem INTEGER := 0;
  v_demanda_incrementos INTEGER := 0;
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
  -- NOVAS VARIÁVEIS para lotes incrementais com traço/lote
  v_lotes_ativos INTEGER := 0;
  v_unidades_ativas INTEGER := 0;
  v_unidades_a_produzir INTEGER := 0;
  v_total_programado INTEGER := 0;
  v_ultima_sequencia INTEGER := 0;
  v_lote_id_existente UUID;
  v_lotes_adicionais INTEGER := 0;
  v_seq_inicial INTEGER := 1;
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
  
  -- 3. Calculate demand from contagem_porcionados
  SELECT COALESCE(SUM(GREATEST(0, ideal_amanha - final_sobra)), 0)::INTEGER
  INTO v_demanda_contagem
  FROM contagem_porcionados
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND dia_operacional = v_hoje
    AND GREATEST(0, ideal_amanha - final_sobra) > 0;
  
  -- 3.1 NOVO: Calculate demand from incrementos_producao (pendentes)
  SELECT COALESCE(SUM(quantidade), 0)::INTEGER
  INTO v_demanda_incrementos
  FROM incrementos_producao
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND dia_operacional = v_hoje
    AND status = 'pendente';
  
  -- 3.2 Demanda total = contagem + incrementos
  v_demanda_atual := v_demanda_contagem + v_demanda_incrementos;
  
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
  
  -- Calcular necessidade total
  v_necessidade_total := v_demanda_atual + v_reserva_dia;
  
  -- ========== CENÁRIO: p_is_incremental = true (Solicitação Extra) ==========
  IF p_is_incremental = true AND v_demanda_incrementos > 0 THEN
    -- Para solicitação extra, sempre criar card adicional se houver incrementos pendentes
    
    -- Buscar última sequência e lote_id existente
    SELECT MAX(sequencia_traco), MAX(lote_producao_id)
    INTO v_ultima_sequencia, v_lote_id_existente
    FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND organization_id = p_organization_id;
    
    v_lote_id := COALESCE(v_lote_id_existente, gen_random_uuid());
    v_seq_inicial := COALESCE(v_ultima_sequencia, 0) + 1;
    
    -- Calcular baseado no tipo de item
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
      v_lotes_necessarios := CEIL(v_demanda_incrementos::NUMERIC / v_capacidade_com_margem);
      
      v_farinha_necessaria := v_lotes_necessarios * v_item_data.farinha_por_lote_kg;
      v_unidades_programadas := v_lotes_necessarios * v_unidades_por_lote;
      v_massa_total_kg := v_lotes_necessarios * v_item_data.massa_gerada_por_lote_kg;
      v_peso_programado_total := v_massa_total_kg;
      
      -- Criar lote(s) incremental(is)
      FOR v_seq IN v_seq_inicial..(v_seq_inicial + v_lotes_necessarios - 1) LOOP
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
          CASE WHEN v_seq = v_seq_inicial THEN v_demanda_incrementos ELSE NULL END,
          0,
          CASE WHEN v_seq = (v_seq_inicial + v_lotes_necessarios - 1) THEN 
            v_unidades_programadas - v_demanda_incrementos 
          ELSE 0 END,
          '[]'::JSONB,
          p_usuario_id, p_usuario_nome, p_organization_id, v_hoje,
          1, v_item_data.farinha_por_lote_kg, v_item_data.massa_gerada_por_lote_kg,
          v_seq, v_lote_id, v_seq > 1,
          'aguardando', true
        );
      END LOOP;
      
    ELSIF v_item_data.unidade_medida IN ('traco', 'lote') AND v_item_data.equivalencia_traco IS NOT NULL THEN
      -- TRAÇO/LOTE incremental
      v_tracos_necessarios := CEIL(v_demanda_incrementos::NUMERIC / v_item_data.equivalencia_traco);
      v_unidades_programadas := v_tracos_necessarios * v_item_data.equivalencia_traco;
      v_sobra_reserva := v_unidades_programadas - v_demanda_incrementos;
      v_peso_base := COALESCE(v_item_data.consumo_por_traco_g, 0) / 1000.0;
      v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
      
      FOR v_seq IN v_seq_inicial..(v_seq_inicial + v_tracos_necessarios - 1) LOOP
        INSERT INTO producao_registros (
          item_id, item_nome, status, unidades_programadas, peso_programado_kg,
          demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
          usuario_id, usuario_nome, organization_id,
          sequencia_traco, total_tracos_lote, lote_producao_id, bloqueado_por_traco_anterior,
          timer_status, data_referencia, is_incremental
        ) VALUES (
          p_item_id, v_item_data.nome, 'a_produzir',
          v_item_data.equivalencia_traco, v_peso_programado_total,
          CASE WHEN v_seq = v_seq_inicial THEN v_demanda_incrementos ELSE NULL END,
          0,
          CASE WHEN v_seq = (v_seq_inicial + v_tracos_necessarios - 1) THEN v_sobra_reserva ELSE 0 END,
          '[]'::JSONB,
          p_usuario_id, p_usuario_nome, p_organization_id,
          v_seq, v_seq_inicial + v_tracos_necessarios - 1, v_lote_id, v_seq > 1,
          'aguardando', v_hoje, true
        );
      END LOOP;
      
    ELSE
      -- UNIDADES simples incremental
      v_unidades_programadas := v_demanda_incrementos;
      v_peso_base := (v_unidades_programadas * COALESCE(v_item_data.peso_unitario_g, 0)) / 1000.0;
      v_peso_programado_total := v_peso_base * (1 + v_perda_adicional / 100.0);
      
      INSERT INTO producao_registros (
        item_id, item_nome, status, unidades_programadas, peso_programado_kg,
        demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
        usuario_id, usuario_nome, organization_id, data_referencia, is_incremental,
        sequencia_traco, lote_producao_id
      ) VALUES (
        p_item_id, v_item_data.nome, 'a_produzir',
        v_unidades_programadas, v_peso_programado_total,
        v_demanda_incrementos, 0, 0, '[]'::JSONB,
        p_usuario_id, p_usuario_nome, p_organization_id, v_hoje, true,
        v_seq_inicial, v_lote_id
      );
    END IF;
    
    -- IMPORTANTE: Marcar incrementos como em_producao
    UPDATE incrementos_producao
    SET status = 'em_producao'
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id
      AND dia_operacional = v_hoje
      AND status = 'pendente';
    
    RETURN jsonb_build_object(
      'success', true,
      'type', 'incremental_created',
      'quantidade_incremental', v_demanda_incrementos,
      'demanda_contagem', v_demanda_contagem,
      'demanda_incrementos', v_demanda_incrementos,
      'producao_ativa', v_tem_producao_ativa,
      'dia_operacional_usado', v_hoje
    );
  END IF;
  
  -- ========== SCENARIO B: PRODUCTION ACTIVE - CALCULATE INCREMENTAL ==========
  IF v_tem_producao_ativa THEN
    
    -- ===== TRATAMENTO ESPECIAL PARA TRAÇO/LOTE COM PRODUÇÃO ATIVA =====
    IF v_item_data.usa_traco_massa = true AND v_item_data.unidade_medida IN ('traco', 'lote') AND v_item_data.equivalencia_traco IS NOT NULL THEN
      
      -- Buscar dados da produção ativa
      SELECT 
        COUNT(*)::INTEGER,
        COALESCE(SUM(unidades_programadas), 0)::INTEGER,
        MAX(sequencia_traco)::INTEGER,
        MAX(lote_producao_id)
      INTO v_lotes_ativos, v_unidades_ativas, v_ultima_sequencia, v_lote_id_existente
      FROM producao_registros
      WHERE item_id = p_item_id
        AND data_referencia = v_hoje
        AND status IN ('em_preparo', 'em_porcionamento', 'finalizado')
        AND organization_id = p_organization_id;
      
      -- Buscar unidades ainda a_produzir
      SELECT COALESCE(SUM(unidades_programadas), 0)::INTEGER
      INTO v_unidades_a_produzir
      FROM producao_registros
      WHERE item_id = p_item_id
        AND data_referencia = v_hoje
        AND status = 'a_produzir'
        AND organization_id = p_organization_id;
      
      -- Também pegar a maior sequência dos a_produzir
      SELECT GREATEST(v_ultima_sequencia, COALESCE(MAX(sequencia_traco), 0))
      INTO v_ultima_sequencia
      FROM producao_registros
      WHERE item_id = p_item_id
        AND data_referencia = v_hoje
        AND organization_id = p_organization_id;
      
      v_total_programado := v_unidades_ativas + v_unidades_a_produzir;
      
      -- Se necessidade > programado, criar lotes adicionais
      IF v_necessidade_total > v_total_programado THEN
        v_quantidade_incremental := v_necessidade_total - v_total_programado;
        v_lotes_adicionais := CEIL(v_quantidade_incremental::NUMERIC / v_item_data.equivalencia_traco);
        
        -- Usar o mesmo lote_id existente ou criar novo
        v_lote_id := COALESCE(v_lote_id_existente, gen_random_uuid());
        v_seq_inicial := COALESCE(v_ultima_sequencia, 0) + 1;
        
        -- Criar apenas os lotes ADICIONAIS
        FOR v_seq IN v_seq_inicial..(v_seq_inicial + v_lotes_adicionais - 1) LOOP
          INSERT INTO producao_registros (
            item_id, item_nome, status, unidades_programadas, peso_programado_kg,
            demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
            usuario_id, usuario_nome, organization_id,
            sequencia_traco, total_tracos_lote, lote_producao_id, 
            bloqueado_por_traco_anterior, timer_status, data_referencia, is_incremental
          ) VALUES (
            p_item_id, 
            v_item_data.nome, 
            'a_produzir',
            v_item_data.equivalencia_traco,
            COALESCE(v_item_data.consumo_por_traco_g, 0) / 1000.0 * (1 + v_perda_adicional / 100.0),
            CASE WHEN v_seq = v_seq_inicial THEN v_quantidade_incremental ELSE NULL END,
            0, 
            CASE WHEN v_seq = (v_seq_inicial + v_lotes_adicionais - 1) THEN 
              (v_lotes_adicionais * v_item_data.equivalencia_traco) - v_quantidade_incremental 
            ELSE 0 END,
            CASE WHEN v_seq = v_seq_inicial THEN v_detalhes_lojas ELSE '[]'::JSONB END,
            p_usuario_id, 
            p_usuario_nome, 
            p_organization_id,
            v_seq, 
            v_seq_inicial + v_lotes_adicionais - 1,
            v_lote_id,
            true,
            'aguardando',
            v_hoje,
            true
          );
        END LOOP;
        
        -- Atualizar total_tracos_lote em TODOS os registros do lote
        UPDATE producao_registros
        SET total_tracos_lote = v_seq_inicial + v_lotes_adicionais - 1
        WHERE lote_producao_id = v_lote_id
          AND organization_id = p_organization_id
          AND data_referencia = v_hoje;
        
        -- Marcar incrementos como em_producao
        UPDATE incrementos_producao
        SET status = 'em_producao'
        WHERE item_porcionado_id = p_item_id
          AND organization_id = p_organization_id
          AND dia_operacional = v_hoje
          AND status = 'pendente';
        
        RETURN jsonb_build_object(
          'success', true,
          'type', 'incremental_traco',
          'lotes_adicionais', v_lotes_adicionais,
          'quantidade_incremental', v_quantidade_incremental,
          'sequencia_inicial', v_seq_inicial,
          'demanda_atual', v_demanda_atual,
          'total_programado_anterior', v_total_programado,
          'producao_ativa', true,
          'dia_operacional_usado', v_hoje
        );
      ELSE
        -- Demanda ainda coberta pelo programado
        RETURN jsonb_build_object(
          'success', true,
          'type', 'no_incremental_needed',
          'message', 'Demanda atual já coberta pelos lotes existentes',
          'demanda_atual', v_demanda_atual,
          'total_programado', v_total_programado,
          'producao_ativa', true,
          'dia_operacional_usado', v_hoje
        );
      END IF;
    END IF;
    
    -- ===== LÓGICA ORIGINAL PARA LOTE_MASSEIRA E OUTROS =====
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
      
      -- Buscar última sequência e lote_id existente
      SELECT MAX(sequencia_traco), MAX(lote_producao_id)
      INTO v_ultima_sequencia, v_lote_id_existente
      FROM producao_registros
      WHERE item_id = p_item_id
        AND data_referencia = v_hoje
        AND organization_id = p_organization_id;
      
      v_lote_id := COALESCE(v_lote_id_existente, gen_random_uuid());
      v_seq_inicial := COALESCE(v_ultima_sequencia, 0) + 1;
      
      IF v_lotes_necessarios > 1 THEN
        -- Criar múltiplos lotes incrementais
        FOR v_seq IN v_seq_inicial..(v_seq_inicial + v_lotes_necessarios - 1) LOOP
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
            CASE WHEN v_seq = v_seq_inicial THEN v_demanda_atual ELSE NULL END,
            CASE WHEN v_seq = v_seq_inicial THEN v_reserva_dia ELSE NULL END,
            CASE WHEN v_seq = (v_seq_inicial + v_lotes_necessarios - 1) THEN 
              v_unidades_programadas - v_necessidade_total 
            ELSE 0 END,
            CASE WHEN v_seq = v_seq_inicial THEN v_detalhes_lojas ELSE '[]'::JSONB END,
            p_usuario_id, p_usuario_nome, p_organization_id, v_hoje,
            1, v_item_data.farinha_por_lote_kg, v_item_data.massa_gerada_por_lote_kg,
            v_seq, v_lote_id, true,
            'aguardando', true
          );
        END LOOP;
        
        -- Atualizar total em todos os registros do lote
        UPDATE producao_registros
        SET total_tracos_lote = v_seq_inicial + v_lotes_necessarios - 1
        WHERE lote_producao_id = v_lote_id
          AND organization_id = p_organization_id;
      ELSE
        INSERT INTO producao_registros (
          item_id, item_nome, status, unidades_programadas, peso_programado_kg,
          demanda_lojas, reserva_configurada, sobra_reserva, detalhes_lojas,
          usuario_id, usuario_nome, organization_id, data_referencia,
          lotes_masseira, farinha_consumida_kg, massa_total_gerada_kg,
          is_incremental, timer_status, sequencia_traco, lote_producao_id, bloqueado_por_traco_anterior
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
          'aguardando',
          v_seq_inicial,
          v_lote_id,
          true
        )
        RETURNING id INTO v_registro_existente;
      END IF;
      
      -- Marcar incrementos como em_producao
      UPDATE incrementos_producao
      SET status = 'em_producao'
      WHERE item_porcionado_id = p_item_id
        AND organization_id = p_organization_id
        AND dia_operacional = v_hoje
        AND status = 'pendente';
      
      RETURN jsonb_build_object(
        'success', true,
        'type', 'incremental_lote_masseira',
        'lotes_adicionais', v_lotes_necessarios,
        'quantidade_incremental', v_quantidade_incremental,
        'demanda_atual', v_demanda_atual,
        'demanda_planejada', v_demanda_planejada,
        'producao_ativa', true,
        'dia_operacional_usado', v_hoje
      );
      
    ELSIF v_item_data.unidade_medida IN ('traco', 'lote') AND v_item_data.equivalencia_traco IS NOT NULL THEN
      -- TRAÇO/LOTE incremental (sem usa_traco_massa)
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
      
      -- Marcar incrementos como em_producao
      UPDATE incrementos_producao
      SET status = 'em_producao'
      WHERE item_porcionado_id = p_item_id
        AND organization_id = p_organization_id
        AND dia_operacional = v_hoje
        AND status = 'pendente';
      
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
      
      -- Marcar incrementos como em_producao
      UPDATE incrementos_producao
      SET status = 'em_producao'
      WHERE item_porcionado_id = p_item_id
        AND organization_id = p_organization_id
        AND dia_operacional = v_hoje
        AND status = 'pendente';
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
      
      -- Marcar incrementos como em_producao
      UPDATE incrementos_producao
      SET status = 'em_producao'
      WHERE item_porcionado_id = p_item_id
        AND organization_id = p_organization_id
        AND dia_operacional = v_hoje
        AND status = 'pendente';
      
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
      
      -- Marcar incrementos como em_producao
      UPDATE incrementos_producao
      SET status = 'em_producao'
      WHERE item_porcionado_id = p_item_id
        AND organization_id = p_organization_id
        AND dia_operacional = v_hoje
        AND status = 'pendente';
      
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
        sequencia_traco, total_tracos_lote, lote_producao_id, bloqueado_por_traco_anterior,
        timer_status, data_referencia, is_incremental
      ) VALUES (
        p_item_id, v_item_data.nome, 'a_produzir',
        v_item_data.equivalencia_traco, v_peso_programado_total,
        CASE WHEN v_seq = 1 THEN v_demanda_atual ELSE NULL END,
        CASE WHEN v_seq = 1 THEN v_reserva_dia ELSE NULL END,
        CASE WHEN v_seq = v_tracos_necessarios THEN v_sobra_reserva ELSE 0 END,
        CASE WHEN v_seq = 1 THEN v_detalhes_lojas ELSE '[]'::JSONB END,
        p_usuario_id, p_usuario_nome, p_organization_id,
        v_seq, v_tracos_necessarios, v_lote_id, v_seq > 1,
        'aguardando', v_hoje, false
      );
    END LOOP;
    
    -- Marcar incrementos como em_producao
    UPDATE incrementos_producao
    SET status = 'em_producao'
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id
      AND dia_operacional = v_hoje
      AND status = 'pendente';
    
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
    
    -- Marcar incrementos como em_producao
    UPDATE incrementos_producao
    SET status = 'em_producao'
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id
      AND dia_operacional = v_hoje
      AND status = 'pendente';
    
    RETURN jsonb_build_object(
      'success', true, 'type', 'created',
      'registro_id', v_registro_existente,
      'dia_operacional_usado', v_hoje,
      'producao_ativa', false
    );
  END IF;
END;
$function$;