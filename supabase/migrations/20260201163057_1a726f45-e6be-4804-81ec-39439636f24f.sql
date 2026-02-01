-- Remover constraint UNIQUE atual que impede múltiplos itens
ALTER TABLE mapeamento_cardapio_itens 
DROP CONSTRAINT IF EXISTS mapeamento_cardapio_itens_org_item_unique;

-- Criar nova constraint que permite múltiplos itens porcionados por produto
-- mas impede duplicatas do mesmo par (produto + item porcionado)
ALTER TABLE mapeamento_cardapio_itens 
ADD CONSTRAINT mapeamento_cardapio_itens_unique_combo 
UNIQUE (organization_id, cardapio_item_id, item_porcionado_id);