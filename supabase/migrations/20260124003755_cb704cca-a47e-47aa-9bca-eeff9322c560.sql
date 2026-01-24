CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(p_item_id uuid, p_organization_id uuid, p_usuario_id uuid, p_usuario_nome text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_item RECORD;
    v_demanda_total INTEGER;
    v_registro_id UUID;
    v_status TEXT;
    v_detalhes_lojas JSONB;
    v_lote_producao_id UUID;
    v_lotes_necessarios INTEGER;
    v_unidades_por_lote INTEGER;
    v_capacidade_com_margem NUMERIC;
    v_farinha_por_lote NUMERIC;
    v_massa_por_lote NUMERIC;
    v_peso_medio_operacional NUMERIC;
    v_margem_percentual NUMERIC;
    i INTEGER;
BEGIN
    -- Buscar dados completos do item (CORRIGIDO: margem_lote_percentual)
    SELECT 
        id,
        nome,
        unidade_medida,
        farinha_por_lote_kg,
        massa_gerada_por_lote_kg,
        peso_medio_operacional_bolinha_g,
        peso_alvo_bolinha_g,
        margem_lote_percentual
    INTO v_item
    FROM itens_porcionados
    WHERE id = p_item_id;

    IF v_item IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calcular demanda total de HOJE
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

    -- Construir detalhes por loja
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

    -- ============================================
    -- TRATAMENTO ESPECIAL PARA LOTE_MASSEIRA
    -- ============================================
    IF v_item.unidade_medida = 'lote_masseira' THEN
        -- Verificar se já existem registros para hoje (não pendentes)
        IF EXISTS (
            SELECT 1 FROM producao_registros
            WHERE item_id = p_item_id
              AND organization_id = p_organization_id
              AND data_referencia = CURRENT_DATE
              AND status NOT IN ('pendente', 'aguardando')
        ) THEN
            -- Já existe produção em andamento, retornar o primeiro registro
            SELECT id INTO v_registro_id
            FROM producao_registros
            WHERE item_id = p_item_id
              AND organization_id = p_organization_id
              AND data_referencia = CURRENT_DATE
            ORDER BY sequencia_traco ASC
            LIMIT 1;
            RETURN v_registro_id;
        END IF;

        -- Excluir registros pendentes antigos para recalcular
        DELETE FROM producao_registros
        WHERE item_id = p_item_id
          AND organization_id = p_organization_id
          AND data_referencia = CURRENT_DATE
          AND status IN ('pendente', 'aguardando');

        -- Calcular parâmetros industriais
        v_farinha_por_lote := COALESCE(v_item.farinha_por_lote_kg, 15);
        v_massa_por_lote := COALESCE(v_item.massa_gerada_por_lote_kg, 25);
        v_peso_medio_operacional := COALESCE(
            v_item.peso_medio_operacional_bolinha_g,
            v_item.peso_alvo_bolinha_g,
            400
        );
        -- CORRIGIDO: usar margem_lote_percentual
        v_margem_percentual := COALESCE(v_item.margem_lote_percentual, 0);

        -- Calcular unidades por lote: massa_gerada_kg * 1000 / peso_medio_g
        v_unidades_por_lote := FLOOR((v_massa_por_lote * 1000) / v_peso_medio_operacional);
        
        IF v_unidades_por_lote <= 0 THEN
            v_unidades_por_lote := 1;
        END IF;

        -- Aplicar margem de flexibilização
        v_capacidade_com_margem := v_unidades_por_lote * (1 + v_margem_percentual / 100.0);

        -- Calcular número de lotes necessários (arredondar para cima)
        v_lotes_necessarios := CEIL(v_demanda_total::NUMERIC / v_capacidade_com_margem);
        
        IF v_lotes_necessarios <= 0 THEN
            v_lotes_necessarios := 1;
        END IF;

        -- Gerar um ID único para agrupar os lotes desta produção
        v_lote_producao_id := gen_random_uuid();

        -- Criar um registro para cada lote (traço)
        FOR i IN 1..v_lotes_necessarios LOOP
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
                organization_id,
                lotes_masseira,
                farinha_consumida_kg,
                massa_total_gerada_kg,
                sequencia_traco,
                total_tracos_lote,
                lote_producao_id,
                bloqueado_por_traco_anterior
            ) VALUES (
                p_item_id,
                v_item.nome,
                v_unidades_por_lote,  -- Cada lote produz X unidades
                CASE WHEN i = 1 THEN v_demanda_total ELSE 0 END,  -- Demanda só no primeiro
                CASE WHEN i = 1 THEN v_detalhes_lojas ELSE '[]'::jsonb END,  -- Detalhes só no primeiro
                'a_produzir',
                CURRENT_DATE,
                p_usuario_id,
                p_usuario_nome,
                p_organization_id,
                1,  -- Cada registro representa 1 lote
                v_farinha_por_lote,
                v_massa_por_lote,
                i,  -- Sequência: 1, 2, 3...
                v_lotes_necessarios,  -- Total de lotes
                v_lote_producao_id,
                CASE WHEN i > 1 THEN TRUE ELSE FALSE END  -- Bloquear lotes 2, 3, etc
            )
            RETURNING id INTO v_registro_id;
        END LOOP;

        RETURN v_registro_id;
    END IF;

    -- ============================================
    -- TRATAMENTO PADRÃO (outros tipos de unidade)
    -- ============================================
    
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
            v_item.nome,
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