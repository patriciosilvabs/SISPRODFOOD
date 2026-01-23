-- =====================================================
-- ETAPA 0: Limpar dados duplicados (manter apenas o mais recente)
-- =====================================================

-- Deletar registros duplicados, mantendo apenas o mais recente por loja+item
DELETE FROM contagem_porcionados
WHERE id NOT IN (
    SELECT DISTINCT ON (loja_id, item_porcionado_id) id
    FROM contagem_porcionados
    ORDER BY loja_id, item_porcionado_id, updated_at DESC
);

-- =====================================================
-- ETAPA 1: Remover dia_operacional e sessões
-- =====================================================

-- 1.1 Remover constraint unique que usa dia_operacional (se existir)
ALTER TABLE contagem_porcionados 
DROP CONSTRAINT IF EXISTS contagem_porcionados_unica_por_dia_operacional;

-- 1.2 Dropar índices que usam dia_operacional
DROP INDEX IF EXISTS idx_contagem_porcionados_dia_operacional;
DROP INDEX IF EXISTS idx_contagem_loja_dia;

-- 1.3 Remover coluna dia_operacional da tabela contagem_porcionados (se existir)
ALTER TABLE contagem_porcionados DROP COLUMN IF EXISTS dia_operacional;

-- 1.4 Criar nova constraint unique (apenas loja + item)
ALTER TABLE contagem_porcionados 
ADD CONSTRAINT contagem_porcionados_unica_loja_item 
UNIQUE (loja_id, item_porcionado_id);

-- 1.5 Deletar tabela sessoes_contagem (não há mais sessões)
DROP TABLE IF EXISTS sessoes_contagem CASCADE;

-- 1.6 Deletar função calcular_dia_operacional (todas as variantes)
DROP FUNCTION IF EXISTS calcular_dia_operacional(uuid, timestamp with time zone);
DROP FUNCTION IF EXISTS calcular_dia_operacional(uuid);

-- =====================================================
-- ETAPA 2: Simplificar producao_registros
-- =====================================================

-- 2.1 Remover constraint que usa data_referencia para unique
DROP INDEX IF EXISTS idx_producao_item_data;

-- 2.2 Criar índice simples para item_id e status
CREATE INDEX IF NOT EXISTS idx_producao_item_status 
ON producao_registros (item_id, status);

-- =====================================================
-- ETAPA 3: Reescrever função criar_ou_atualizar_producao_registro
-- Nova regra: 
--   - Se item está em "a_produzir" → ATUALIZA quantidade
--   - Se item está em "em_preparo/em_porcionamento" → CRIA EXTRA
-- =====================================================

CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
    p_item_id uuid,
    p_organization_id uuid,
    p_usuario_id uuid,
    p_usuario_nome text,
    p_dia_operacional date DEFAULT NULL, -- Mantido para compatibilidade, mas ignorado
    p_is_incremental boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_item RECORD;
    v_demanda_total INTEGER := 0;
    v_card_a_produzir RECORD;
    v_card_em_andamento RECORD;
    v_registro_id UUID;
    v_quantidade_por_lote INTEGER;
    v_usa_traco_massa BOOLEAN := false;
    v_proxima_sequencia INTEGER;
    v_lote_producao_id UUID;
BEGIN
    -- 1. Buscar informações do item
    SELECT id, nome, quantidade_por_lote, COALESCE(usa_traco_massa, false) as usa_traco_massa
    INTO v_item
    FROM itens_porcionados
    WHERE id = p_item_id AND organization_id = p_organization_id;

    IF v_item IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item não encontrado');
    END IF;

    v_usa_traco_massa := v_item.usa_traco_massa;
    v_quantidade_por_lote := COALESCE(v_item.quantidade_por_lote, 10);

    -- 2. Calcular demanda total de TODAS as lojas (soma de ideal_amanha - final_sobra)
    SELECT COALESCE(SUM(GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))), 0)::INTEGER
    INTO v_demanda_total
    FROM contagem_porcionados
    WHERE item_porcionado_id = p_item_id
      AND organization_id = p_organization_id;

    -- 3. Verificar se existe card "a_produzir" para este item
    SELECT id, unidades_programadas, sequencia_traco, lote_producao_id
    INTO v_card_a_produzir
    FROM producao_registros
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id
      AND status = 'a_produzir'
    ORDER BY created_at DESC
    LIMIT 1;

    -- 4. Verificar se existe card "em_preparo" ou "em_porcionamento"
    SELECT id, status
    INTO v_card_em_andamento
    FROM producao_registros
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id
      AND status IN ('em_preparo', 'em_porcionamento')
    LIMIT 1;

    -- =====================================================
    -- REGRA PRINCIPAL
    -- =====================================================
    
    -- CASO 1: Existe card "a_produzir" → ATUALIZAR quantidade
    IF v_card_a_produzir.id IS NOT NULL THEN
        UPDATE producao_registros
        SET 
            unidades_programadas = v_demanda_total,
            demanda_lojas = v_demanda_total,
            updated_at = NOW()
        WHERE id = v_card_a_produzir.id;
        
        RETURN jsonb_build_object(
            'success', true,
            'action', 'updated',
            'registro_id', v_card_a_produzir.id,
            'demanda_total', v_demanda_total
        );
    END IF;

    -- CASO 2: Existe card em andamento → CRIAR EXTRA
    IF v_card_em_andamento.id IS NOT NULL AND v_demanda_total > 0 THEN
        -- Buscar próxima sequência
        SELECT COALESCE(MAX(sequencia_traco), 0) + 1
        INTO v_proxima_sequencia
        FROM producao_registros
        WHERE item_id = p_item_id
          AND organization_id = p_organization_id;
        
        -- Gerar novo lote se necessário
        v_lote_producao_id := gen_random_uuid();
        
        INSERT INTO producao_registros (
            item_id,
            item_nome,
            unidades_programadas,
            demanda_lojas,
            status,
            organization_id,
            usuario_id,
            usuario_nome,
            sequencia_traco,
            lote_producao_id,
            is_incremental,
            data_referencia
        ) VALUES (
            p_item_id,
            v_item.nome,
            v_demanda_total,
            v_demanda_total,
            'a_produzir',
            p_organization_id,
            p_usuario_id,
            p_usuario_nome,
            v_proxima_sequencia,
            v_lote_producao_id,
            true,  -- Marcar como incremental/extra
            CURRENT_DATE
        )
        RETURNING id INTO v_registro_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'action', 'created_extra',
            'registro_id', v_registro_id,
            'demanda_total', v_demanda_total,
            'sequencia', v_proxima_sequencia
        );
    END IF;

    -- CASO 3: Não existe card → CRIAR NOVO
    IF v_demanda_total > 0 THEN
        v_lote_producao_id := gen_random_uuid();
        
        INSERT INTO producao_registros (
            item_id,
            item_nome,
            unidades_programadas,
            demanda_lojas,
            status,
            organization_id,
            usuario_id,
            usuario_nome,
            sequencia_traco,
            lote_producao_id,
            is_incremental,
            data_referencia
        ) VALUES (
            p_item_id,
            v_item.nome,
            v_demanda_total,
            v_demanda_total,
            'a_produzir',
            p_organization_id,
            p_usuario_id,
            p_usuario_nome,
            1,
            v_lote_producao_id,
            false,
            CURRENT_DATE
        )
        RETURNING id INTO v_registro_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'action', 'created',
            'registro_id', v_registro_id,
            'demanda_total', v_demanda_total
        );
    END IF;

    -- Sem demanda
    RETURN jsonb_build_object(
        'success', true,
        'action', 'no_demand',
        'demanda_total', 0
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =====================================================
-- ETAPA 4: Reescrever função recalcular_producao_dia
-- =====================================================

CREATE OR REPLACE FUNCTION public.recalcular_producao_dia(
    p_organization_id uuid,
    p_usuario_id uuid,
    p_usuario_nome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_item RECORD;
    v_itens_processados INTEGER := 0;
    v_cards_criados INTEGER := 0;
    v_cards_atualizados INTEGER := 0;
    v_resultado jsonb;
BEGIN
    -- Para cada item ativo da organização
    FOR v_item IN 
        SELECT id, nome FROM itens_porcionados
        WHERE organization_id = p_organization_id AND ativo = true
    LOOP
        SELECT criar_ou_atualizar_producao_registro(
            v_item.id,
            p_organization_id,
            p_usuario_id,
            p_usuario_nome
        ) INTO v_resultado;
        
        v_itens_processados := v_itens_processados + 1;
        
        IF v_resultado IS NOT NULL THEN
            IF v_resultado->>'action' = 'created' OR v_resultado->>'action' = 'created_extra' THEN
                v_cards_criados := v_cards_criados + 1;
            ELSIF v_resultado->>'action' = 'updated' THEN
                v_cards_atualizados := v_cards_atualizados + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'itens_processados', v_itens_processados,
        'cards_criados', v_cards_criados,
        'cards_atualizados', v_cards_atualizados
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'itens_processados', v_itens_processados
    );
END;
$$;