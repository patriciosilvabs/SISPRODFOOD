CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
    p_item_id uuid,
    p_organization_id uuid,
    p_usuario_id uuid,
    p_usuario_nome text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_id uuid;
    v_demanda_total integer;
    v_total_tracos_lote integer;
    v_data_referencia date;
    v_resultado uuid;
    v_item_nome text;
BEGIN
    -- Buscar nome e quantidade_por_lote do item
    SELECT nome, COALESCE(quantidade_por_lote, 1) 
    INTO v_item_nome, v_total_tracos_lote
    FROM itens_porcionados
    WHERE id = p_item_id;
    
    IF v_item_nome IS NULL THEN
        RETURN NULL;
    END IF;

    -- Buscar a data de referência mais recente das contagens
    SELECT MAX(dia_operacional::date) INTO v_data_referencia
    FROM contagem_porcionados
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id;
    
    IF v_data_referencia IS NULL THEN
        v_data_referencia := CURRENT_DATE;
    END IF;
    
    -- Calcular demanda total
    SELECT COALESCE(SUM(GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))), 0)
    INTO v_demanda_total
    FROM contagem_porcionados
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id
      AND dia_operacional::date = v_data_referencia;
    
    IF v_demanda_total <= 0 THEN
        DELETE FROM producao_registros
        WHERE item_id = p_item_id
          AND organization_id = p_organization_id
          AND data_referencia = v_data_referencia
          AND status IN ('pendente', 'aguardando', 'a_produzir');
        RETURN NULL;
    END IF;
    
    SELECT id INTO v_existing_id
    FROM producao_registros
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id
      AND data_referencia = v_data_referencia
      AND status IN ('pendente', 'aguardando', 'a_produzir')
    ORDER BY id DESC
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
        -- CORREÇÃO: Remover updated_at = now() pois a coluna não existe
        UPDATE producao_registros
        SET unidades_programadas = v_demanda_total,
            total_tracos_lote = v_total_tracos_lote
        WHERE id = v_existing_id;
        v_resultado := v_existing_id;
    ELSE
        INSERT INTO producao_registros (
            item_id, item_nome, organization_id, unidades_programadas,
            total_tracos_lote, status, data_referencia,
            usuario_id, usuario_nome
        ) VALUES (
            p_item_id, v_item_nome, p_organization_id, v_demanda_total,
            v_total_tracos_lote, 'pendente', v_data_referencia,
            p_usuario_id, p_usuario_nome
        )
        RETURNING id INTO v_resultado;
    END IF;
    
    RETURN v_resultado;
END;
$$;