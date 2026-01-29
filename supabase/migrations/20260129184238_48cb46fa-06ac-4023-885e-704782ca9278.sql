-- Atualizar função do trigger removendo referência a estoque_inicial (coluna inexistente)
CREATE OR REPLACE FUNCTION trigger_criar_producao_apos_contagem()
RETURNS TRIGGER AS $$
BEGIN
    -- Para INSERTs, sempre recalcular
    IF TG_OP = 'INSERT' THEN
        PERFORM criar_ou_atualizar_producao_registro(
            NEW.item_porcionado_id,
            NEW.organization_id,
            NEW.usuario_id,
            NEW.usuario_nome
        );
        RETURN NEW;
    END IF;
    
    -- Para UPDATEs, verificar se campos relevantes mudaram
    IF TG_OP = 'UPDATE' THEN
        -- Só recalcular se ideal_amanha mudou (loja atualizou estoque ideal)
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