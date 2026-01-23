-- Drop all existing overloads of the function first to avoid conflicts
DROP FUNCTION IF EXISTS public.criar_ou_atualizar_producao_registro(uuid, uuid, uuid, text, date, boolean);
DROP FUNCTION IF EXISTS public.criar_ou_atualizar_producao_registro(uuid, uuid, uuid, text, date);
DROP FUNCTION IF EXISTS public.criar_ou_atualizar_producao_registro(uuid, text, uuid, uuid, text, date);
DROP FUNCTION IF EXISTS public.criar_ou_atualizar_producao_registro(uuid, text, uuid, uuid, text, date, boolean);

-- Recreate with fixed logic (no MAX on UUID)
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
    v_unidades_por_lote INTEGER;
    v_registro_id UUID;
    v_lote_producao_id UUID;
    v_lote_id_existente UUID;
    v_ultima_sequencia INTEGER;
    v_sequencia_atual INTEGER;
    v_cards_criados INTEGER := 0;
BEGIN
    -- Buscar informações do item
    SELECT id, nome, unidades_por_lote, organization_id
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

    v_unidades_por_lote := COALESCE(v_item.unidades_por_lote, 10);
    v_hoje := COALESCE(p_dia_operacional, CURRENT_DATE);

    -- =====================================================
    -- CALCULAR DEMANDA DAS CONTAGENS
    -- =====================================================
    SELECT COALESCE(SUM(
        CASE 
            WHEN cp.contagem_vitrine IS NOT NULL AND cp.contagem_estoque IS NOT NULL 
            THEN GREATEST(0, COALESCE(l.reserva_diaria, 0) - COALESCE(cp.contagem_vitrine, 0) - COALESCE(cp.contagem_estoque, 0))
            ELSE 0
        END
    ), 0)::INTEGER
    INTO v_demanda_contagem
    FROM lojas l
    LEFT JOIN contagem_porcionados cp ON cp.loja_id = l.id 
        AND cp.item_id = p_item_id 
        AND cp.data_contagem = v_hoje
    WHERE l.organization_id = p_organization_id
      AND l.ativa = true
      AND EXISTS (
          SELECT 1 FROM loja_itens_porcionados lip 
          WHERE lip.loja_id = l.id AND lip.item_id = p_item_id
      );

    -- =====================================================
    -- CALCULAR DEMANDA DOS INCREMENTOS (pendentes)
    -- =====================================================
    SELECT COALESCE(SUM(quantidade), 0)::INTEGER
    INTO v_demanda_incrementos
    FROM incrementos_producao
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id
      AND status = 'pendente';

    -- Demanda total = contagens + incrementos
    v_demanda_atual := v_demanda_contagem + v_demanda_incrementos;

    -- =====================================================
    -- CALCULAR PRODUÇÃO EXISTENTE
    -- =====================================================
    SELECT COALESCE(SUM(quantidade_total), 0)::INTEGER
    INTO v_producao_existente
    FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND organization_id = p_organization_id
      AND status IN ('a_produzir', 'em_preparo', 'em_porcionamento');

    SELECT COALESCE(SUM(quantidade_total), 0)::INTEGER
    INTO v_producao_finalizada
    FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND organization_id = p_organization_id
      AND status = 'finalizado';

    -- =====================================================
    -- MODO INCREMENTAL (Produção Extra)
    -- =====================================================
    IF p_is_incremental THEN
        -- Se não há incrementos pendentes, não faz nada
        IF v_demanda_incrementos <= 0 THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Nenhum incremento pendente para processar',
                'cards_criados', 0,
                'demanda_atual', v_demanda_atual,
                'producao_existente', v_producao_existente + v_producao_finalizada
            );
        END IF;

        -- Calcular déficit baseado apenas nos incrementos
        v_deficit := v_demanda_incrementos;
        v_lotes_necessarios := CEIL(v_deficit::NUMERIC / v_unidades_por_lote);

        IF v_lotes_necessarios <= 0 THEN
            v_lotes_necessarios := 1;
        END IF;

        -- Buscar última sequência (MAX funciona com INTEGER)
        SELECT MAX(sequencia_traco)
        INTO v_ultima_sequencia
        FROM producao_registros
        WHERE item_id = p_item_id
          AND data_referencia = v_hoje
          AND organization_id = p_organization_id;

        v_sequencia_atual := COALESCE(v_ultima_sequencia, 0);

        -- Buscar lote_producao_id do registro com maior sequência (evita MAX em UUID)
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

        -- Usar lote existente ou criar novo
        v_lote_producao_id := COALESCE(v_lote_id_existente, gen_random_uuid());

        -- Criar cards incrementais
        FOR i IN 1..v_lotes_necessarios LOOP
            v_sequencia_atual := v_sequencia_atual + 1;

            INSERT INTO producao_registros (
                item_id,
                item_nome,
                quantidade_total,
                status,
                data_referencia,
                organization_id,
                criado_por_id,
                criado_por_nome,
                sequencia_traco,
                lote_producao_id,
                is_incremental
            ) VALUES (
                p_item_id,
                v_item.nome,
                v_unidades_por_lote,
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

    -- =====================================================
    -- MODO NORMAL (Contagem padrão)
    -- =====================================================
    
    -- Se demanda é zero ou já coberta, não criar novos cards
    IF v_demanda_atual <= 0 OR (v_producao_existente + v_producao_finalizada) >= v_demanda_atual THEN
        -- Verificar se há cards "a_produzir" que devem ser removidos (demanda zerou)
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

    -- Calcular déficit real
    v_deficit := v_demanda_atual - (v_producao_existente + v_producao_finalizada);
    v_lotes_necessarios := CEIL(v_deficit::NUMERIC / v_unidades_por_lote);

    IF v_lotes_necessarios <= 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Sem lotes necessários',
            'cards_criados', 0,
            'demanda_atual', v_demanda_atual
        );
    END IF;

    -- Deletar cards "a_produzir" não incrementais para substituir
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND organization_id = p_organization_id
      AND status = 'a_produzir'
      AND is_incremental = false;

    -- Buscar última sequência existente
    SELECT MAX(sequencia_traco)
    INTO v_ultima_sequencia
    FROM producao_registros
    WHERE item_id = p_item_id
      AND data_referencia = v_hoje
      AND organization_id = p_organization_id;

    v_sequencia_atual := COALESCE(v_ultima_sequencia, 0);

    -- Buscar lote_producao_id existente (evita MAX em UUID)
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

    -- Criar os lotes necessários
    FOR i IN 1..v_lotes_necessarios LOOP
        v_sequencia_atual := v_sequencia_atual + 1;

        INSERT INTO producao_registros (
            item_id,
            item_nome,
            quantidade_total,
            status,
            data_referencia,
            organization_id,
            criado_por_id,
            criado_por_nome,
            sequencia_traco,
            lote_producao_id,
            is_incremental
        ) VALUES (
            p_item_id,
            v_item.nome,
            v_unidades_por_lote,
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

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.criar_ou_atualizar_producao_registro(uuid, uuid, uuid, text, date, boolean) TO authenticated;