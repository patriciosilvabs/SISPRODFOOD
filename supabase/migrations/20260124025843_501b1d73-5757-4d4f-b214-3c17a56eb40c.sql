-- =========================================================================
-- MIGRAÇÃO: Unificar função RPC para desmembramento correto de lotes
-- 
-- PROBLEMA: Os registros estão sendo criados com lotes_masseira=null e 
-- detalhes_lojas=[], fazendo o modal mostrar consumo total (45kg) ao invés
-- do consumo por lote (15kg).
--
-- SOLUÇÃO: Atualizar a função para:
-- 1. Sempre setar lotes_masseira=1 em cada card individual
-- 2. Popular detalhes_lojas corretamente no primeiro card
-- 3. Propagar demanda total em demanda_lojas para todos os cards
-- =========================================================================

-- Dropar versões antigas da função (com diferentes assinaturas)
DROP FUNCTION IF EXISTS public.criar_ou_atualizar_producao_registro(uuid, uuid, uuid, text);

-- Criar função unificada com lógica de desmembramento correta
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
    v_item RECORD;
    v_demanda_total INTEGER := 0;
    v_detalhes_lojas JSONB := '[]'::jsonb;
    v_unidades_por_lote INTEGER;
    v_num_lotes INTEGER;
    v_lote_producao_id UUID;
    v_seq INTEGER;
    v_unidades_este_lote INTEGER;
    v_unidades_restantes INTEGER;
    v_first_id UUID;
    v_existing_id UUID;
    v_registro_existente RECORD;
    v_reserva_dia INTEGER := 0;
    v_data_hoje DATE;
BEGIN
    v_data_hoje := CURRENT_DATE;
    
    -- 1. Buscar dados completos do item
    SELECT 
        id, nome, unidade_medida, 
        massa_gerada_por_lote_kg, 
        COALESCE(peso_medio_operacional_bolinha_g, peso_alvo_bolinha_g, peso_unitario_g) as peso_bolinha_g,
        farinha_por_lote_kg,
        equivalencia_traco,
        margem_lote_percentual
    INTO v_item
    FROM itens_porcionados 
    WHERE id = p_item_id AND organization_id = p_organization_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item não encontrado: %', p_item_id;
    END IF;
    
    -- 2. Calcular demanda total das contagens
    SELECT COALESCE(SUM(GREATEST(0, ideal_amanha - final_sobra)), 0)
    INTO v_demanda_total
    FROM contagem_porcionados
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id
      AND dia_operacional = v_data_hoje;
    
    -- 3. Buscar reserva do dia (se configurada)
    SELECT COALESCE(
        CASE EXTRACT(DOW FROM v_data_hoje)
            WHEN 0 THEN domingo
            WHEN 1 THEN segunda
            WHEN 2 THEN terca
            WHEN 3 THEN quarta
            WHEN 4 THEN quinta
            WHEN 5 THEN sexta
            WHEN 6 THEN sabado
        END, 0
    )
    INTO v_reserva_dia
    FROM itens_reserva_diaria
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id;
    
    -- 4. Montar detalhes_lojas (composição por loja)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'loja_id', cp.loja_id,
            'loja_nome', l.nome,
            'quantidade', GREATEST(0, cp.ideal_amanha - cp.final_sobra)
        )
        ORDER BY l.nome
    ), '[]'::jsonb)
    INTO v_detalhes_lojas
    FROM contagem_porcionados cp
    JOIN lojas l ON l.id = cp.loja_id
    WHERE cp.item_porcionado_id = p_item_id
      AND cp.organization_id = p_organization_id
      AND cp.dia_operacional = v_data_hoje
      AND (cp.ideal_amanha - cp.final_sobra) > 0;
    
    -- ===== TRATAMENTO PARA ITENS LOTE_MASSEIRA =====
    IF v_item.unidade_medida = 'lote_masseira' THEN
        -- Validar dados necessários para cálculo
        IF v_item.massa_gerada_por_lote_kg IS NULL OR v_item.peso_bolinha_g IS NULL THEN
            RAISE EXCEPTION 'Item lote_masseira sem configuração de massa/peso: %', v_item.nome;
        END IF;
        
        -- Calcular unidades por lote
        v_unidades_por_lote := FLOOR((v_item.massa_gerada_por_lote_kg * 1000) / v_item.peso_bolinha_g);
        
        IF v_unidades_por_lote <= 0 THEN
            RAISE EXCEPTION 'Cálculo de unidades por lote inválido: %', v_unidades_por_lote;
        END IF;
        
        -- Calcular número de lotes necessários
        -- Considerar margem de flexibilização se configurada
        IF v_demanda_total <= 0 THEN
            v_num_lotes := 0;
        ELSE
            v_num_lotes := CEIL(v_demanda_total::numeric / v_unidades_por_lote::numeric);
        END IF;
        
        -- Se não há demanda, não criar registros
        IF v_num_lotes = 0 THEN
            RETURN NULL;
        END IF;
        
        -- Gerar ID único para agrupar os lotes
        v_lote_producao_id := gen_random_uuid();
        
        -- Deletar cards pendentes/a_produzir antigos para este item no dia
        DELETE FROM producao_registros 
        WHERE item_id = p_item_id 
          AND organization_id = p_organization_id
          AND data_referencia = v_data_hoje 
          AND status IN ('pendente', 'a_produzir');
        
        -- Criar N cards (1 por lote)
        v_unidades_restantes := v_demanda_total;
        
        FOR v_seq IN 1..v_num_lotes LOOP
            -- Distribuir unidades: cada lote recebe no máximo v_unidades_por_lote
            v_unidades_este_lote := LEAST(v_unidades_por_lote, v_unidades_restantes);
            
            INSERT INTO producao_registros (
                item_id, 
                item_nome, 
                status,
                -- IMPORTANTE: cada card = 1 lote
                unidades_programadas, 
                lotes_masseira,
                -- Consumo por lote individual
                farinha_consumida_kg, 
                massa_total_gerada_kg,
                -- Composição de lojas (só no primeiro card, ou em todos se preferir)
                detalhes_lojas, 
                demanda_lojas,
                demanda_base_snapshot,
                -- Controle de sequência
                sequencia_traco, 
                total_tracos_lote, 
                lote_producao_id,
                producao_lote_id,
                -- Bloqueio de cards subsequentes
                bloqueado_por_traco_anterior,
                -- Reserva
                reserva_configurada,
                -- Metadata
                usuario_id, 
                usuario_nome, 
                organization_id, 
                data_referencia
            ) VALUES (
                p_item_id, 
                v_item.nome, 
                'a_produzir',
                -- Unidades deste lote específico
                v_unidades_este_lote,
                1,  -- SEMPRE 1 lote por card!
                -- Consumo de farinha deste lote (individual)
                COALESCE(v_item.farinha_por_lote_kg, 0), 
                COALESCE(v_item.massa_gerada_por_lote_kg, 0),
                -- detalhes_lojas: mostra em todos os cards para referência
                v_detalhes_lojas,
                -- demanda_lojas: total de demanda para referência
                v_demanda_total,
                v_demanda_total,
                -- Sequência
                v_seq, 
                v_num_lotes, 
                v_lote_producao_id,
                v_lote_producao_id,
                -- Bloqueado se não for o primeiro
                v_seq > 1,
                -- Reserva só no primeiro
                CASE WHEN v_seq = 1 THEN v_reserva_dia ELSE 0 END,
                -- Metadata
                p_usuario_id, 
                p_usuario_nome, 
                p_organization_id, 
                v_data_hoje
            )
            RETURNING id INTO v_first_id;
            
            v_unidades_restantes := v_unidades_restantes - v_unidades_este_lote;
        END LOOP;
        
        RETURN v_first_id;
    END IF;
    
    -- ===== TRATAMENTO PARA OUTROS TIPOS DE UNIDADE =====
    
    -- Verificar se já existe registro pendente/a_produzir para este item hoje
    SELECT id INTO v_existing_id
    FROM producao_registros
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id
      AND data_referencia = v_data_hoje
      AND status IN ('pendente', 'a_produzir')
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
        -- Atualizar registro existente
        UPDATE producao_registros
        SET 
            unidades_programadas = v_demanda_total,
            detalhes_lojas = v_detalhes_lojas,
            demanda_lojas = v_demanda_total,
            demanda_base_snapshot = v_demanda_total,
            reserva_configurada = v_reserva_dia,
            usuario_id = p_usuario_id,
            usuario_nome = p_usuario_nome
        WHERE id = v_existing_id
        RETURNING id INTO v_first_id;
    ELSE
        -- Criar novo registro
        INSERT INTO producao_registros (
            item_id, 
            item_nome, 
            status,
            unidades_programadas,
            detalhes_lojas,
            demanda_lojas,
            demanda_base_snapshot,
            reserva_configurada,
            usuario_id, 
            usuario_nome, 
            organization_id, 
            data_referencia
        ) VALUES (
            p_item_id, 
            v_item.nome, 
            'a_produzir',
            v_demanda_total,
            v_detalhes_lojas,
            v_demanda_total,
            v_demanda_total,
            v_reserva_dia,
            p_usuario_id, 
            p_usuario_nome, 
            p_organization_id, 
            v_data_hoje
        )
        RETURNING id INTO v_first_id;
    END IF;
    
    RETURN v_first_id;
END;
$$;