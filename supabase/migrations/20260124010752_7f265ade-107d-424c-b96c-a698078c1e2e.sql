-- =============================================
-- FIX: Usar data de referência das contagens para deleção
-- Corrige o problema de cards órfãos de dias anteriores
-- =============================================

-- Atualizar a função para usar a data dinâmica das contagens
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
    p_item_id uuid, 
    p_organization_id uuid, 
    p_usuario_id uuid, 
    p_usuario_nome text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_id uuid;
    v_demanda_total integer;
    v_total_tracos_lote integer;
    v_data_referencia date;
    v_resultado uuid;
BEGIN
    -- Buscar a data de referência mais recente das contagens
    SELECT MAX(dia_operacional::date) INTO v_data_referencia
    FROM contagem_porcionados
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id;
    
    -- Se não há contagens, usar a data atual
    IF v_data_referencia IS NULL THEN
        v_data_referencia := CURRENT_DATE;
    END IF;
    
    -- Calcular demanda total (ideal_amanha - final_sobra de todas as lojas)
    SELECT COALESCE(SUM(GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))), 0)
    INTO v_demanda_total
    FROM contagem_porcionados
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id
      AND dia_operacional::date = v_data_referencia;
    
    -- Se demanda é zero ou negativa, deletar cards pendentes DESSA DATA e retornar NULL
    IF v_demanda_total <= 0 THEN
        DELETE FROM producao_registros
        WHERE item_id = p_item_id
          AND organization_id = p_organization_id
          AND data_referencia = v_data_referencia
          AND status IN ('pendente', 'aguardando', 'a_produzir');
        
        RETURN NULL;
    END IF;
    
    -- Verificar se já existe registro pendente/aguardando/a_produzir para hoje
    SELECT id INTO v_existing_id
    FROM producao_registros
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id
      AND data_referencia = v_data_referencia
      AND status IN ('pendente', 'aguardando', 'a_produzir')
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Buscar total de traços do lote
    SELECT COALESCE(total_tracos_lote, 1) INTO v_total_tracos_lote
    FROM itens_porcionados
    WHERE id = p_item_id;
    
    IF v_existing_id IS NOT NULL THEN
        -- Atualizar registro existente
        UPDATE producao_registros
        SET unidades_programadas = v_demanda_total,
            total_tracos_lote = v_total_tracos_lote,
            updated_at = now()
        WHERE id = v_existing_id;
        
        v_resultado := v_existing_id;
    ELSE
        -- Criar novo registro
        INSERT INTO producao_registros (
            item_id,
            organization_id,
            unidades_programadas,
            total_tracos_lote,
            status,
            data_referencia,
            usuario_criacao_id,
            usuario_criacao_nome
        ) VALUES (
            p_item_id,
            p_organization_id,
            v_demanda_total,
            v_total_tracos_lote,
            'pendente',
            v_data_referencia,
            p_usuario_id,
            p_usuario_nome
        )
        RETURNING id INTO v_resultado;
    END IF;
    
    RETURN v_resultado;
END;
$$;

-- Limpar cards órfãos de 2026-01-23 que estão aparecendo indevidamente
DELETE FROM producao_registros
WHERE data_referencia = '2026-01-23'
  AND status IN ('pendente', 'aguardando', 'a_produzir')
  AND organization_id = 'a769f8a7-8933-4650-84c5-627a2364471d';