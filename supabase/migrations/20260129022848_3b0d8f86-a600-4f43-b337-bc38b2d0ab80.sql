-- ============================================================
-- Separar Produção por Loja: criar UM card para CADA LOJA
-- Isso permite visualizar quais lojas já enviaram contagem
-- e priorizar produção por loja com maior demanda
-- ============================================================

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
AS $$
DECLARE
    v_item record;
    v_reserva_dia integer := 0;
    v_data_hoje date;
    v_dia_semana integer;
    v_usuario_id uuid := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000');
    v_usuario_nome_final text := COALESCE(p_usuario_nome, 'Sistema');
    -- Variáveis para loop por loja
    v_contagem record;
    v_num_lotes integer;
    v_unidades_por_lote integer;
    v_unidades_restantes integer;
    v_unidades_este_lote integer;
    v_seq integer;
    v_lote_producao_id uuid;
    v_registro_id uuid;
    v_detalhes_loja jsonb;
    v_ultimo_id uuid;
BEGIN
    -- Data de referência local (São Paulo)
    v_data_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_dia_semana := EXTRACT(DOW FROM v_data_hoje)::integer;

    -- Buscar item com dados necessários
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
      AND ip.organization_id = p_organization_id
      AND ip.ativo = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item não encontrado ou inativo: %', p_item_id;
    END IF;

    -- Buscar reserva diária configurada
    SELECT COALESCE(
        CASE v_dia_semana
            WHEN 0 THEN ird.domingo
            WHEN 1 THEN ird.segunda
            WHEN 2 THEN ird.terca
            WHEN 3 THEN ird.quarta
            WHEN 4 THEN ird.quinta
            WHEN 5 THEN ird.sexta
            WHEN 6 THEN ird.sabado
        END, 0
    )::integer
    INTO v_reserva_dia
    FROM itens_reserva_diaria ird
    WHERE ird.item_porcionado_id = p_item_id
      AND ird.organization_id = p_organization_id;

    v_reserva_dia := COALESCE(v_reserva_dia, 0);

    -- Deletar registros existentes para este item/data que estão "a_produzir"
    -- IMPORTANTE: NÃO deleta cards que já estão em andamento ou finalizados
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id
      AND data_referencia = v_data_hoje
      AND status = 'a_produzir';

    -- ============================================================
    -- NOVA LÓGICA: Loop por CADA LOJA com demanda > 0
    -- Cria cards SEPARADOS para cada loja
    -- ============================================================
    FOR v_contagem IN 
        SELECT 
            cp.loja_id,
            l.nome as loja_nome,
            GREATEST(cp.a_produzir, 0)::integer as demanda
        FROM contagem_porcionados cp
        JOIN lojas l ON l.id = cp.loja_id
        WHERE cp.item_porcionado_id = p_item_id
          AND cp.organization_id = p_organization_id
          AND cp.dia_operacional = v_data_hoje
          AND cp.a_produzir > 0
        ORDER BY cp.a_produzir DESC  -- Maior demanda primeiro
    LOOP
        -- Criar detalhes_lojas com apenas ESTA loja
        v_detalhes_loja := jsonb_build_array(
            jsonb_build_object(
                'loja_id', v_contagem.loja_id,
                'loja_nome', v_contagem.loja_nome,
                'quantidade', v_contagem.demanda
            )
        );

        -- Determinar número de lotes necessários para ESTA loja
        IF v_item.unidade_medida = 'lote_masseira' THEN
            v_unidades_por_lote := FLOOR(
                COALESCE(v_item.massa_gerada_por_lote_kg, 25)::numeric * 1000 / 
                GREATEST(COALESCE(v_item.peso_medio_operacional_bolinha_g, 435)::numeric, 1)
            )::integer;
            
            IF v_unidades_por_lote <= 0 THEN
                v_unidades_por_lote := 57;
            END IF;
            
            v_num_lotes := CEIL(v_contagem.demanda::numeric / v_unidades_por_lote)::integer;
            
        ELSIF v_item.usa_traco_massa = true AND COALESCE(v_item.quantidade_por_lote, 0) > 0 THEN
            v_num_lotes := CEIL(v_contagem.demanda::numeric / v_item.quantidade_por_lote)::integer;
            v_unidades_por_lote := v_item.quantidade_por_lote;
        ELSE
            -- Itens simples: 1 card por loja
            v_num_lotes := 1;
            v_unidades_por_lote := v_contagem.demanda;
        END IF;

        -- Gerar ID único para agrupar traços DESTA loja
        v_lote_producao_id := gen_random_uuid();
        v_unidades_restantes := v_contagem.demanda;

        -- Criar N registros (1 por lote/traço) para ESTA loja
        FOR v_seq IN 1..v_num_lotes LOOP
            IF v_seq = v_num_lotes THEN
                v_unidades_este_lote := v_unidades_restantes;
            ELSE
                v_unidades_este_lote := v_unidades_por_lote;
            END IF;
            
            v_unidades_restantes := v_unidades_restantes - v_unidades_este_lote;

            INSERT INTO producao_registros (
                item_id, 
                item_nome, 
                status,
                unidades_programadas, 
                lotes_masseira,
                farinha_consumida_kg, 
                massa_total_gerada_kg,
                detalhes_lojas, 
                demanda_lojas,
                reserva_configurada,
                sobra_reserva,
                organization_id,
                usuario_id,
                usuario_nome,
                data_referencia,
                sequencia_traco,
                total_tracos_lote,
                bloqueado_por_traco_anterior,
                lote_producao_id
            ) VALUES (
                p_item_id,
                v_item.nome,
                'a_produzir',
                v_unidades_este_lote,
                CASE WHEN v_item.unidade_medida = 'lote_masseira' OR v_item.usa_traco_massa THEN 1 ELSE NULL END,
                CASE WHEN v_item.unidade_medida = 'lote_masseira' OR v_item.usa_traco_massa 
                     THEN COALESCE(v_item.farinha_por_lote_kg, 15) 
                     ELSE NULL 
                END,
                CASE WHEN v_item.unidade_medida = 'lote_masseira' 
                     THEN COALESCE(v_item.massa_gerada_por_lote_kg, 25) 
                     ELSE NULL 
                END,
                v_detalhes_loja,  -- Agora contém apenas 1 loja
                v_contagem.demanda,  -- Demanda desta loja específica
                v_reserva_dia,
                CASE WHEN v_reserva_dia > 0 THEN v_reserva_dia ELSE NULL END,
                p_organization_id,
                v_usuario_id,
                v_usuario_nome_final,
                v_data_hoje,
                v_seq,
                v_num_lotes,
                v_seq > 1,
                v_lote_producao_id
            )
            RETURNING id INTO v_registro_id;
            
            v_ultimo_id := v_registro_id;
        END LOOP;
    END LOOP;

    RETURN v_ultimo_id;
END;
$$;

-- Garantir que a função pode ser chamada por usuários autenticados
GRANT EXECUTE ON FUNCTION public.criar_ou_atualizar_producao_registro(uuid, uuid, uuid, text) TO authenticated;