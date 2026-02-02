-- Primeiro, limpar duplicatas existentes (manter apenas o registro mais antigo)
DELETE FROM mapeamento_cardapio_itens a
USING mapeamento_cardapio_itens b
WHERE a.id > b.id
  AND a.organization_id = b.organization_id
  AND a.loja_id IS NOT DISTINCT FROM b.loja_id
  AND a.cardapio_item_id = b.cardapio_item_id
  AND a.item_porcionado_id IS NULL
  AND b.item_porcionado_id IS NULL;

-- Criar índice único parcial para quando item_porcionado_id IS NULL
-- Isso garante que só pode existir UM registro por produto/loja quando não há vínculo
CREATE UNIQUE INDEX IF NOT EXISTS 
  mapeamento_cardapio_itens_org_loja_item_null_unique 
ON mapeamento_cardapio_itens(organization_id, loja_id, cardapio_item_id) 
WHERE item_porcionado_id IS NULL;