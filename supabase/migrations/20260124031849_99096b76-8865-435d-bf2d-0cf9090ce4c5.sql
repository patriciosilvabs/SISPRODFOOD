
-- Corrigir a função criar_ou_atualizar_producao_registro (4 parâmetros)
-- para desmembrar corretamente itens lote_masseira usando massa_gerada_por_lote_kg

CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
    p_organization_id uuid,
    p_item_id uuid,
    p_data_producao date,
    p_demanda_total integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_registro_id uuid;
    v_num_lotes integer;
    v_unidades_por_lote integer;
    v_unidades_restantes integer;
    v_unidades_este_lote integer;
    v_lote_producao_id uuid;
    v_i integer;
    v_detalhes_lojas jsonb;
    v_primeiro_registro_id uuid;
BEGIN
    -- Buscar informações do item incluindo campos para cálculo de lote_masseira
    SELECT 
        ip.id,
        ip.nome,
        ip.usa_traco_massa,
        ip.quantidade_por_lote,
        ip.farinha_por_lote_kg,
        ip.massa_gerada_por_lote_kg,
        ip.unidade_medida,
        ip.peso_medio_operacional_bolinha_g
    INTO v_item
    FROM itens_porcionados ip
    WHERE ip.id = p_item_id 
    AND ip.organization_id = p_organization_id;

    IF v_item IS NULL THEN
        RAISE EXCEPTION 'Item não encontrado: %', p_item_id;
    END IF;

    -- Deletar registros existentes para este item/data
    DELETE FROM producao_registros
    WHERE organization_id = p_organization_id
    AND item_porcionado_id = p_item_id
    AND data_producao = p_data_producao;

    -- Se demanda é zero ou negativa, não criar registros
    IF p_demanda_total <= 0 THEN
        RETURN NULL;
    END IF;

    -- Buscar detalhes das lojas (necessidade por loja)
    SELECT jsonb_agg(
        jsonb_build_object(
            'loja_id', l.id,
            'loja_nome', l.nome,
            'necessidade', COALESCE(
                (SELECT cp.ideal_amanha 
                 FROM contagem_porcionados cp 
                 WHERE cp.loja_id = l.id 
                 AND cp.item_id = p_item_id 
                 AND cp.data_contagem = p_data_producao
                ), 0
            )
        )
    )
    INTO v_detalhes_lojas
    FROM lojas l
    WHERE l.organization_id = p_organization_id
    AND l.ativa = true;

    -- Determinar número de lotes e unidades por lote
    IF v_item.unidade_medida = 'lote_masseira' THEN
        -- Calcular unidades por lote baseado na massa gerada e peso por bolinha
        v_unidades_por_lote := FLOOR(
            COALESCE(v_item.massa_gerada_por_lote_kg, 25)::numeric * 1000 / 
            GREATEST(COALESCE(v_item.peso_medio_operacional_bolinha_g, 435)::numeric, 1)
        )::integer;
        
        -- Fallback se cálculo resultar em zero
        IF v_unidades_por_lote <= 0 THEN
            v_unidades_por_lote := 57;
        END IF;
        
        v_num_lotes := CEIL(p_demanda_total::numeric / v_unidades_por_lote)::integer;
        
    ELSIF v_item.usa_traco_massa = true AND COALESCE(v_item.quantidade_por_lote, 0) > 0 THEN
        -- Lógica para outros itens com traço de massa
        v_num_lotes := CEIL(p_demanda_total::numeric / v_item.quantidade_por_lote)::integer;
        v_unidades_por_lote := v_item.quantidade_por_lote;
    ELSE
        -- Item simples, sem desmembramento
        v_num_lotes := 1;
        v_unidades_por_lote := p_demanda_total;
    END IF;

    -- Gerar UUID único para agrupar todos os lotes deste item
    v_lote_producao_id := gen_random_uuid();
    v_unidades_restantes := p_demanda_total;

    -- Criar registros para cada lote
    FOR v_i IN 1..v_num_lotes LOOP
        -- Calcular unidades deste lote
        IF v_i = v_num_lotes THEN
            v_unidades_este_lote := v_unidades_restantes;
        ELSE
            v_unidades_este_lote := LEAST(v_unidades_por_lote, v_unidades_restantes);
        END IF;
        
        v_unidades_restantes := v_unidades_restantes - v_unidades_este_lote;

        INSERT INTO producao_registros (
            organization_id,
            item_porcionado_id,
            data_producao,
            quantidade_planejada,
            status,
            lotes_masseira,
            farinha_consumida_kg,
            lote_producao_id,
            sequencia_traco,
            total_tracos_lote,
            bloqueado_por_traco_anterior,
            detalhes_lojas
        ) VALUES (
            p_organization_id,
            p_item_id,
            p_data_producao,
            v_unidades_este_lote,
            'a_produzir',
            CASE WHEN v_item.unidade_medida = 'lote_masseira' OR v_item.usa_traco_massa THEN 1 ELSE NULL END,
            CASE WHEN v_item.unidade_medida = 'lote_masseira' OR v_item.usa_traco_massa 
                 THEN COALESCE(v_item.farinha_por_lote_kg, 15) 
                 ELSE NULL 
            END,
            v_lote_producao_id,
            v_i,
            v_num_lotes,
            v_i > 1,  -- Primeiro lote desbloqueado, demais bloqueados
            v_detalhes_lojas
        )
        RETURNING id INTO v_registro_id;

        -- Guardar o ID do primeiro registro para retornar
        IF v_i = 1 THEN
            v_primeiro_registro_id := v_registro_id;
        END IF;
    END LOOP;

    RETURN v_primeiro_registro_id;
END;
$$;
