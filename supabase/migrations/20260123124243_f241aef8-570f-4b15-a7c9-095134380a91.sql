-- =====================================================
-- TRIGGER PARA CRIAR CARDS DE PRODUÇÃO AUTOMATICAMENTE
-- =====================================================

-- 1. Dropar função existente para recriar com novo tipo de retorno
DROP FUNCTION IF EXISTS criar_ou_atualizar_producao_registro(UUID, UUID, UUID, TEXT);

-- 2. Recriar função corrigida
CREATE OR REPLACE FUNCTION criar_ou_atualizar_producao_registro(
    p_item_id UUID,
    p_organization_id UUID,
    p_usuario_id UUID,
    p_usuario_nome TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_item_nome TEXT;
    v_demanda_total INTEGER;
    v_registro_id UUID;
    v_status TEXT;
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
            demanda_lojas = v_demanda_total
        WHERE id = v_registro_id;
    END IF;

    RETURN v_registro_id;
END;
$$;

-- 3. Criar função de trigger
CREATE OR REPLACE FUNCTION trigger_criar_producao_apos_contagem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    PERFORM criar_ou_atualizar_producao_registro(
        NEW.item_porcionado_id,
        NEW.organization_id,
        NEW.usuario_id,
        NEW.usuario_nome
    );
    RETURN NEW;
END;
$$;

-- 4. Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trg_criar_producao_apos_contagem ON contagem_porcionados;

-- 5. Criar trigger
CREATE TRIGGER trg_criar_producao_apos_contagem
AFTER INSERT OR UPDATE ON contagem_porcionados
FOR EACH ROW
EXECUTE FUNCTION trigger_criar_producao_apos_contagem();