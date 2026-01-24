-- Função para criar ou atualizar registros de produção com desmembramento de lotes masseira
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
  p_organization_id UUID,
  p_item_id UUID,
  p_item_nome TEXT,
  p_loja_id UUID,
  p_loja_nome TEXT,
  p_data_referencia DATE,
  p_demanda_unidades INTEGER,
  p_ideal_configurado INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_unidades_por_lote INTEGER;
  v_num_lotes INTEGER;
  v_lote_producao_id UUID;
  v_existing_lotes INTEGER;
  v_existing_pending RECORD;
  v_lotes_a_criar INTEGER;
  v_unidades_restantes INTEGER;
  v_unidades_este_lote INTEGER;
  v_i INTEGER;
  v_result JSONB := '[]'::JSONB;
  v_new_id UUID;
BEGIN
  -- Buscar dados do item
  SELECT 
    unidade_medida,
    massa_gerada_por_lote_kg,
    peso_medio_operacional_bolinha_g,
    farinha_por_lote_kg,
    tempo_preparo_minutos
  INTO v_item
  FROM itens_porcionados
  WHERE id = p_item_id;

  -- Se não for lote_masseira, criar registro único (comportamento antigo)
  IF v_item.unidade_medida IS DISTINCT FROM 'lote_masseira' THEN
    -- Verificar se já existe registro para este item/loja/data
    SELECT id INTO v_new_id
    FROM producao_registros
    WHERE organization_id = p_organization_id
      AND item_id = p_item_id
      AND loja_id = p_loja_id
      AND data_referencia = p_data_referencia
      AND status NOT IN ('finalizado', 'perda')
    LIMIT 1;

    IF v_new_id IS NOT NULL THEN
      -- Atualizar registro existente
      UPDATE producao_registros
      SET unidades_programadas = p_demanda_unidades,
          ideal_configurado = p_ideal_configurado,
          updated_at = NOW()
      WHERE id = v_new_id;
    ELSE
      -- Criar novo registro
      INSERT INTO producao_registros (
        organization_id, item_id, item_nome, loja_id, loja_nome,
        data_referencia, unidades_programadas, ideal_configurado,
        status, lotes_masseira
      ) VALUES (
        p_organization_id, p_item_id, p_item_nome, p_loja_id, p_loja_nome,
        p_data_referencia, p_demanda_unidades, p_ideal_configurado,
        'a_produzir', 1
      )
      RETURNING id INTO v_new_id;
    END IF;

    RETURN jsonb_build_object('created', 1, 'ids', jsonb_build_array(v_new_id));
  END IF;

  -- === LÓGICA PARA LOTE_MASSEIRA ===
  
  -- Calcular unidades por lote
  v_unidades_por_lote := FLOOR(
    COALESCE(v_item.massa_gerada_por_lote_kg, 25) * 1000 / 
    COALESCE(v_item.peso_medio_operacional_bolinha_g, 435)
  );
  
  IF v_unidades_por_lote <= 0 THEN
    v_unidades_por_lote := 57; -- fallback
  END IF;

  -- Calcular número de lotes necessários
  IF p_demanda_unidades <= 0 THEN
    v_num_lotes := 0;
  ELSE
    v_num_lotes := CEIL(p_demanda_unidades::NUMERIC / v_unidades_por_lote);
  END IF;

  -- Verificar registros existentes para este item/data (não por loja, consolidado)
  SELECT 
    lote_producao_id,
    COUNT(*) as total_lotes,
    COUNT(*) FILTER (WHERE status = 'a_produzir') as lotes_pendentes
  INTO v_existing_pending
  FROM producao_registros
  WHERE organization_id = p_organization_id
    AND item_id = p_item_id
    AND data_referencia = p_data_referencia
    AND status NOT IN ('finalizado', 'perda')
  GROUP BY lote_producao_id
  LIMIT 1;

  -- Se não há demanda, deletar registros pendentes
  IF v_num_lotes = 0 THEN
    DELETE FROM producao_registros
    WHERE organization_id = p_organization_id
      AND item_id = p_item_id
      AND data_referencia = p_data_referencia
      AND status = 'a_produzir';
    
    RETURN jsonb_build_object('created', 0, 'deleted', TRUE);
  END IF;

  -- Determinar lote_producao_id (usar existente ou criar novo)
  IF v_existing_pending.lote_producao_id IS NOT NULL THEN
    v_lote_producao_id := v_existing_pending.lote_producao_id;
    v_existing_lotes := COALESCE(v_existing_pending.total_lotes, 0);
  ELSE
    v_lote_producao_id := gen_random_uuid();
    v_existing_lotes := 0;
  END IF;

  -- Calcular quantos lotes precisam ser criados
  v_lotes_a_criar := v_num_lotes - v_existing_lotes;

  -- Se precisamos de MENOS lotes, remover os excedentes (apenas pendentes)
  IF v_lotes_a_criar < 0 THEN
    DELETE FROM producao_registros
    WHERE id IN (
      SELECT id FROM producao_registros
      WHERE organization_id = p_organization_id
        AND item_id = p_item_id
        AND data_referencia = p_data_referencia
        AND status = 'a_produzir'
      ORDER BY sequencia_traco DESC
      LIMIT ABS(v_lotes_a_criar)
    );
    v_lotes_a_criar := 0;
  END IF;

  -- Atualizar total_tracos_lote em todos os registros existentes
  UPDATE producao_registros
  SET total_tracos_lote = v_num_lotes,
      updated_at = NOW()
  WHERE organization_id = p_organization_id
    AND item_id = p_item_id
    AND data_referencia = p_data_referencia
    AND lote_producao_id = v_lote_producao_id;

  -- Criar novos lotes se necessário
  IF v_lotes_a_criar > 0 THEN
    v_unidades_restantes := p_demanda_unidades - (v_existing_lotes * v_unidades_por_lote);
    
    FOR v_i IN (v_existing_lotes + 1)..v_num_lotes LOOP
      -- Calcular unidades para este lote
      IF v_unidades_restantes >= v_unidades_por_lote THEN
        v_unidades_este_lote := v_unidades_por_lote;
      ELSE
        v_unidades_este_lote := v_unidades_restantes;
      END IF;
      v_unidades_restantes := v_unidades_restantes - v_unidades_este_lote;

      INSERT INTO producao_registros (
        organization_id,
        item_id,
        item_nome,
        loja_id,
        loja_nome,
        data_referencia,
        status,
        unidades_programadas,
        ideal_configurado,
        lotes_masseira,
        lote_producao_id,
        sequencia_traco,
        total_tracos_lote,
        bloqueado_por_traco_anterior,
        farinha_consumida_kg,
        massa_total_gerada_kg,
        tempo_preparo_minutos
      ) VALUES (
        p_organization_id,
        p_item_id,
        p_item_nome,
        p_loja_id,
        p_loja_nome,
        p_data_referencia,
        'a_produzir',
        v_unidades_este_lote,
        p_ideal_configurado,
        1, -- cada card representa 1 lote
        v_lote_producao_id,
        v_i,
        v_num_lotes,
        v_i > 1, -- lotes após o primeiro ficam bloqueados
        COALESCE(v_item.farinha_por_lote_kg, 15),
        COALESCE(v_item.massa_gerada_por_lote_kg, 25),
        COALESCE(v_item.tempo_preparo_minutos, 45)
      )
      RETURNING id INTO v_new_id;

      v_result := v_result || jsonb_build_array(v_new_id);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'created', v_lotes_a_criar,
    'total_lotes', v_num_lotes,
    'unidades_por_lote', v_unidades_por_lote,
    'lote_producao_id', v_lote_producao_id,
    'ids', v_result
  );
END;
$$;