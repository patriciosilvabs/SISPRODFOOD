-- Atualizar a função que é REALMENTE chamada pelo frontend
-- Parâmetros: (p_item_id, p_organization_id, p_usuario_id, p_usuario_nome)
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
    v_item record;
    v_demanda_total integer := 0;
    v_reserva_dia integer := 0;
    v_num_lotes integer := 1;
    v_unidades_por_lote integer;
    v_unidades_restantes integer;
    v_unidades_este_lote integer;
    v_seq integer;
    v_lote_producao_id uuid;
    v_registro_id uuid;
    v_data_hoje date;
    v_dia_semana integer;
    v_detalhes_lojas jsonb;
    v_contagem record;
BEGIN
    -- Data de referência local (São Paulo)
    v_data_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_dia_semana := EXTRACT(DOW FROM v_data_hoje)::integer;

    -- Buscar item com dados necessários - INCLUINDO unidade_medida e peso_medio_operacional_bolinha_g
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

    -- Calcular demanda total das lojas (contagem_porcionados)
    SELECT COALESCE(SUM(GREATEST(cp.a_produzir, 0)), 0)::integer
    INTO v_demanda_total
    FROM contagem_porcionados cp
    WHERE cp.item_porcionado_id = p_item_id
      AND cp.organization_id = p_organization_id
      AND cp.dia_operacional = v_data_hoje;

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

    -- Se não há demanda, não criar registros
    IF v_demanda_total <= 0 THEN
        RETURN NULL;
    END IF;

    -- Construir detalhes_lojas a partir das contagens
    SELECT jsonb_agg(
        jsonb_build_object(
            'loja_id', cp.loja_id,
            'loja_nome', l.nome,
            'quantidade', GREATEST(cp.a_produzir, 0)
        )
    )
    INTO v_detalhes_lojas
    FROM contagem_porcionados cp
    JOIN lojas l ON l.id = cp.loja_id
    WHERE cp.item_porcionado_id = p_item_id
      AND cp.organization_id = p_organization_id
      AND cp.dia_operacional = v_data_hoje
      AND cp.a_produzir > 0;

    v_detalhes_lojas := COALESCE(v_detalhes_lojas, '[]'::jsonb);

    -- Deletar registros existentes para este item/data
    DELETE FROM producao_registros
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id
      AND data_referencia = v_data_hoje
      AND status = 'a_produzir';

    -- ==========================================
    -- LÓGICA CORRIGIDA: Determinar número de lotes
    -- ==========================================
    IF v_item.unidade_medida = 'lote_masseira' THEN
        -- NOVO: Calcular unidades por lote baseado na massa e peso por bolinha
        v_unidades_por_lote := FLOOR(
            COALESCE(v_item.massa_gerada_por_lote_kg, 25)::numeric * 1000 / 
            GREATEST(COALESCE(v_item.peso_medio_operacional_bolinha_g, 435)::numeric, 1)
        )::integer;
        
        -- Fallback se cálculo resultar em zero
        IF v_unidades_por_lote <= 0 THEN
            v_unidades_por_lote := 57;
        END IF;
        
        v_num_lotes := CEIL(v_demanda_total::numeric / v_unidades_por_lote)::integer;
        
    ELSIF v_item.usa_traco_massa = true AND COALESCE(v_item.quantidade_por_lote, 0) > 0 THEN
        -- Lógica para outros itens com traço de massa
        v_num_lotes := CEIL(v_demanda_total::numeric / v_item.quantidade_por_lote)::integer;
        v_unidades_por_lote := v_item.quantidade_por_lote;
    ELSE
        -- Item simples, sem desmembramento
        v_num_lotes := 1;
        v_unidades_por_lote := v_demanda_total;
    END IF;

    -- Gerar ID único para agrupar traços do mesmo lote
    v_lote_producao_id := gen_random_uuid();
    v_unidades_restantes := v_demanda_total;

    -- Criar N registros (1 por lote/traço)
    FOR v_seq IN 1..v_num_lotes LOOP
        -- Último lote pega o restante
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
            v_detalhes_lojas,
            v_demanda_total,
            v_reserva_dia,
            CASE WHEN v_reserva_dia > 0 THEN v_reserva_dia ELSE NULL END,
            p_organization_id,
            p_usuario_id,
            p_usuario_nome,
            v_data_hoje,
            v_seq,
            v_num_lotes,
            v_seq > 1,  -- Primeiro lote desbloqueado, demais bloqueados
            v_lote_producao_id
        )
        RETURNING id INTO v_registro_id;
    END LOOP;

    RETURN v_registro_id;
END;
$function$;