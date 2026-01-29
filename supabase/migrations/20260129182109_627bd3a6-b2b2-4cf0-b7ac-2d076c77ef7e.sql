-- Atualizar função do trigger para ignorar updates irrelevantes (romaneio/produção)
CREATE OR REPLACE FUNCTION public.trigger_criar_producao_apos_contagem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    -- Ignorar se apenas final_sobra ou updated_at mudou (típico de romaneio/produção)
    IF TG_OP = 'UPDATE' THEN
        -- Só recalcular se ideal_amanha mudou (loja atualizou estoque ideal)
        -- ou se estoque_inicial mudou
        IF (OLD.ideal_amanha IS DISTINCT FROM NEW.ideal_amanha) OR
           (OLD.estoque_inicial IS DISTINCT FROM NEW.estoque_inicial) THEN
            PERFORM criar_ou_atualizar_producao_registro(
                NEW.item_porcionado_id,
                NEW.organization_id,
                NEW.usuario_id,
                NEW.usuario_nome
            );
        END IF;
        -- Se apenas final_sobra mudou, NÃO recalcular
        -- (romaneio debitando estoque ou produção creditando)
    END IF;
    
    RETURN NEW;
END;
$$;