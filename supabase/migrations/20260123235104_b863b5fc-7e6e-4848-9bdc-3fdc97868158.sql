-- Atualizar função para popular detalhes_lojas com demanda por loja
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
    p_item_id uuid,
    p_organization_id uuid,
    p_usuario_id uuid,
    p_usuario_nome text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_item_nome TEXT;
    v_demanda_total INTEGER;
    v_registro_id UUID;
    v_status TEXT;
    v_detalhes_lojas JSONB;
BEGIN
    -- Buscar nome do item
    SELECT nome INTO v_item_nome
    FROM itens_porcionados
    WHERE id = p_item_id;

    IF v_item_nome IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calcular demanda total de HOJE (somando a_produzir de todas as lojas)
    SELECT COALESCE(SUM(GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))), 0)::INTEGER
    INTO v_demanda_total
    FROM contagem_porcionados
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id
      AND dia_operacional = CURRENT_DATE;

    -- Se não há demanda, não criar card
    IF v_demanda_total <= 0 THEN
        RETURN NULL;
    END IF;

    -- Construir detalhes por loja (NOVO!)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'loja_id', cp.loja_id::text,
            'loja_nome', l.nome,
            'quantidade', GREATEST(0, COALESCE(cp.ideal_amanha, 0) - COALESCE(cp.final_sobra, 0))
        )
        ORDER BY l.nome
    ), '[]'::jsonb)
    INTO v_detalhes_lojas
    FROM contagem_porcionados cp
    JOIN lojas l ON cp.loja_id = l.id
    WHERE cp.item_porcionado_id = p_item_id
      AND cp.organization_id = p_organization_id
      AND cp.dia_operacional = CURRENT_DATE
      AND GREATEST(0, COALESCE(cp.ideal_amanha, 0) - COALESCE(cp.final_sobra, 0)) > 0;

    -- Verificar se já existe registro para hoje
    SELECT id, status INTO v_registro_id, v_status
    FROM producao_registros
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id
      AND data_referencia = CURRENT_DATE
    LIMIT 1;

    -- Se já existe e não está pendente, não atualizar
    IF v_registro_id IS NOT NULL AND v_status NOT IN ('pendente', 'aguardando') THEN
        RETURN v_registro_id;
    END IF;

    -- Criar ou atualizar registro
    IF v_registro_id IS NULL THEN
        INSERT INTO producao_registros (
            item_id,
            item_nome,
            unidades_programadas,
            demanda_lojas,
            detalhes_lojas,
            status,
            data_referencia,
            usuario_id,
            usuario_nome,
            organization_id
        ) VALUES (
            p_item_id,
            v_item_nome,
            v_demanda_total,
            v_demanda_total,
            v_detalhes_lojas,
            'pendente',
            CURRENT_DATE,
            p_usuario_id,
            p_usuario_nome,
            p_organization_id
        )
        RETURNING id INTO v_registro_id;
    ELSE
        UPDATE producao_registros
        SET unidades_programadas = v_demanda_total,
            demanda_lojas = v_demanda_total,
            detalhes_lojas = v_detalhes_lojas
        WHERE id = v_registro_id;
    END IF;

    RETURN v_registro_id;
END;
$function$;