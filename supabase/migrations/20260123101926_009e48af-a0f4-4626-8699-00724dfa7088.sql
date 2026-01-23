-- Fix: Use correct column name unidades_programadas instead of quantidade_total
DROP FUNCTION IF EXISTS public.criar_ou_atualizar_producao_registro(uuid, uuid, uuid, text, date, boolean);

CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
    p_item_id uuid,
    p_organization_id uuid,
    p_usuario_id uuid,
    p_usuario_nome text,
    p_dia_operacional date,
    p_is_incremental boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_hoje DATE;
    v_demanda_contagem INTEGER := 0;
    v_demanda_incrementos INTEGER := 0;
    v_demanda_atual INTEGER := 0;
    v_producao_existente INTEGER := 0;
    v_producao_finalizada INTEGER := 0;
    v_deficit INTEGER := 0;
    v_lotes_necessarios INTEGER := 0;
    v_quantidade_por_lote INTEGER;
    v_registro_id UUID;
    v_lote_producao_id UUID;
    v_lote_id_existente UUID;
    v_ultima_sequencia INTEGER;
    v_sequencia_atual INTEGER;
    v_cards_criados INTEGER := 0;
BEGIN
    -- Buscar informações do item
    SELECT id, nome, quantidade_por_lote, organization_id
    INTO v_item
    FROM itens_porcionados
    WHERE id = p_item_id AND organization_id = p_organization_id;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Item não encontrado',
            'cards_criados', 0
        );
    END IF;

    v_quantidade_por_lote := COALESCE(v_item.quantidade_por_lote, 10);
    v_hoje := COALESCE(p_dia_operacional, CURRENT_DATE);

    -- CALCULAR DEMANDA DAS CONTAGENS
    SELECT COALESCE(SUM(
        GREATEST(0, COALESCE(cp.ideal_amanha, 0) - COALESCE(cp.final_sobra, 0))
    ), 0)::INTEGER
    INTO v_demanda_contagem
    FROM contagem_porcionados cp
    WHERE cp.item_porcionado_id = p_item_id
      AND cp.organization_id = p_organization_id
      AND cp.dia_operacional = v_hoje;

    -- CALCULAR DEMANDA DOS INCREMENTOS (pendentes)
    SELECT COALESCE(SUM(quantidade), 0)::INTEGER
    INTO v_demanda_incrementos
    FROM incrementos_producao
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id
      AND status = 'pendente';

    v_demanda_atual := v_demanda_contagem + v_demanda_incrementos;

    -- CALCULAR PRODUÇÃO EXISTENTE (usando unidades_programadas)
    SELECT COALESCE(SUM(unidades_programadas), 0)::INTEGER
    INTO v_producao_existente
    FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND organization_id = p_organization_id
      AND status IN ('a_produzir', 'em_preparo', 'em_porcionamento');

    SELECT COALESCE(SUM(unidades_programadas), 0)::INTEGER
    INTO v_producao_finalizada
    FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND organization_id = p_organization_id
      AND status = 'finalizado';

    -- MODO INCREMENTAL (Produção Extra)
    IF p_is_incremental THEN
        IF v_demanda_incrementos <= 0 THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Nenhum incremento pendente para processar',
                'cards_criados', 0,
                'demanda_atual', v_demanda_atual,
                'producao_existente', v_producao_existente + v_producao_finalizada
            );
        END IF;

        v_deficit := v_demanda_incrementos;
        v_lotes_necessarios := CEIL(v_deficit::NUMERIC / v_quantidade_por_lote);

        IF v_lotes_necessarios <= 0 THEN
            v_lotes_necessarios := 1;
        END IF;

        SELECT MAX(sequencia_traco)
        INTO v_ultima_sequencia
        FROM producao_registros
        WHERE item_id = p_item_id
          AND data_referencia = v_hoje
          AND organization_id = p_organization_id;

        v_sequencia_atual := COALESCE(v_ultima_sequencia, 0);

        IF v_sequencia_atual > 0 THEN
            SELECT lote_producao_id
            INTO v_lote_id_existente
            FROM producao_registros
            WHERE item_id = p_item_id
              AND data_referencia = v_hoje
              AND organization_id = p_organization_id
              AND sequencia_traco = v_sequencia_atual
            LIMIT 1;
        END IF;

        v_lote_producao_id := COALESCE(v_lote_id_existente, gen_random_uuid());

        -- Criar cards incrementais (usando unidades_programadas)
        FOR i IN 1..v_lotes_necessarios LOOP
            v_sequencia_atual := v_sequencia_atual + 1;

            INSERT INTO producao_registros (
                item_id,
                item_nome,
                unidades_programadas,
                status,
                data_referencia,
                organization_id,
                usuario_id,
                usuario_nome,
                sequencia_traco,
                lote_producao_id,
                is_incremental
            ) VALUES (
                p_item_id,
                v_item.nome,
                v_quantidade_por_lote,
                'a_produzir',
                v_hoje,
                p_organization_id,
                p_usuario_id,
                p_usuario_nome,
                v_sequencia_atual,
                v_lote_producao_id,
                true
            )
            RETURNING id INTO v_registro_id;

            v_cards_criados := v_cards_criados + 1;
        END LOOP;

        -- Marcar incrementos como em produção
        UPDATE incrementos_producao
        SET status = 'em_producao'
        WHERE item_porcionado_id = p_item_id
          AND organization_id = p_organization_id
          AND status = 'pendente';

        RETURN jsonb_build_object(
            'success', true,
            'message', format('Criados %s cards incrementais', v_cards_criados),
            'cards_criados', v_cards_criados,
            'demanda_incrementos', v_demanda_incrementos,
            'lote_producao_id', v_lote_producao_id,
            'is_incremental', true
        );
    END IF;

    -- MODO NORMAL (Contagem padrão)
    IF v_demanda_atual <= 0 OR (v_producao_existente + v_producao_finalizada) >= v_demanda_atual THEN
        IF v_demanda_atual <= 0 THEN
            DELETE FROM producao_registros
            WHERE item_id = p_item_id
              AND data_referencia = v_hoje
              AND organization_id = p_organization_id
              AND status = 'a_produzir'
              AND is_incremental = false;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Produção já atende demanda atual',
            'cards_criados', 0,
            'demanda_atual', v_demanda_atual,
            'producao_existente', v_producao_existente + v_producao_finalizada
        );
    END IF;

    v_deficit := v_demanda_atual - (v_producao_existente + v_producao_finalizada);
    v_lotes_necessarios := CEIL(v_deficit::NUMERIC / v_quantidade_por_lote);

    IF v_lotes_necessarios <= 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Sem lotes necessários',
            'cards_criados', 0,
            'demanda_atual', v_demanda_atual
        );
    END IF;

    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND organization_id = p_organization_id
      AND status = 'a_produzir'
      AND is_incremental = false;

    SELECT MAX(sequencia_traco)
    INTO v_ultima_sequencia
    FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND organization_id = p_organization_id;

    v_sequencia_atual := COALESCE(v_ultima_sequencia, 0);

    IF v_sequencia_atual > 0 THEN
        SELECT lote_producao_id
        INTO v_lote_id_existente
        FROM producao_registros
        WHERE item_id = p_item_id
          AND data_referencia = v_hoje
          AND organization_id = p_organization_id
          AND sequencia_traco = v_sequencia_atual
        LIMIT 1;
    END IF;

    v_lote_producao_id := COALESCE(v_lote_id_existente, gen_random_uuid());

    FOR i IN 1..v_lotes_necessarios LOOP
        v_sequencia_atual := v_sequencia_atual + 1;

        INSERT INTO producao_registros (
            item_id,
            item_nome,
            unidades_programadas,
            status,
            data_referencia,
            organization_id,
            usuario_id,
            usuario_nome,
            sequencia_traco,
            lote_producao_id,
            is_incremental
        ) VALUES (
            p_item_id,
            v_item.nome,
            v_quantidade_por_lote,
            'a_produzir',
            v_hoje,
            p_organization_id,
            p_usuario_id,
            p_usuario_nome,
            v_sequencia_atual,
            v_lote_producao_id,
            false
        )
        RETURNING id INTO v_registro_id;

        v_cards_criados := v_cards_criados + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Criados %s cards de produção', v_cards_criados),
        'cards_criados', v_cards_criados,
        'demanda_atual', v_demanda_atual,
        'deficit', v_deficit,
        'lotes_necessarios', v_lotes_necessarios,
        'lote_producao_id', v_lote_producao_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'cards_criados', 0
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_ou_atualizar_producao_registro(uuid, uuid, uuid, text, date, boolean) TO authenticated;