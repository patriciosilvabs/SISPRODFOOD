-- Remover constraint antiga que impede histórico diário de contagens
ALTER TABLE contagem_porcionados 
DROP CONSTRAINT IF EXISTS contagem_porcionados_unica_loja_item;

-- Verificar que a constraint correta existe (uma contagem por loja/item/dia)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_contagem_por_dia'
    ) THEN
        ALTER TABLE contagem_porcionados
        ADD CONSTRAINT unique_contagem_por_dia 
        UNIQUE (loja_id, item_porcionado_id, dia_operacional);
    END IF;
END $$;