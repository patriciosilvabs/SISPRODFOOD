-- Atualizar trigger para ignorar INSERT/UPDATE de lojas tipo CPD
-- Isso evita o loop infinito quando a produção é finalizada e credita o estoque

CREATE OR REPLACE FUNCTION trigger_criar_producao_apos_contagem()
RETURNS TRIGGER AS $$
DECLARE
  v_loja_tipo TEXT;
BEGIN
    -- Buscar o tipo da loja
    SELECT tipo INTO v_loja_tipo FROM lojas WHERE id = NEW.loja_id;
    
    -- NUNCA recalcular para INSERT/UPDATE de loja CPD
    -- Isso evita loops quando produção finaliza e credita o estoque
    IF v_loja_tipo = 'cpd' THEN
        RETURN NEW;
    END IF;

    -- Para INSERTs (de lojas normais), sempre recalcular
    IF TG_OP = 'INSERT' THEN
        PERFORM criar_ou_atualizar_producao_registro(
            NEW.item_porcionado_id,
            NEW.organization_id,
            NEW.usuario_id,
            NEW.usuario_nome
        );
        RETURN NEW;
    END IF;
    
    -- Para UPDATEs (de lojas normais), verificar se ideal_amanha mudou
    IF TG_OP = 'UPDATE' THEN
        IF OLD.ideal_amanha IS DISTINCT FROM NEW.ideal_amanha THEN
            PERFORM criar_ou_atualizar_producao_registro(
                NEW.item_porcionado_id,
                NEW.organization_id,
                NEW.usuario_id,
                NEW.usuario_nome
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;