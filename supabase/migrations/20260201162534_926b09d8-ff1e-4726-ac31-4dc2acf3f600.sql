-- Abordagem robusta: usar CTE para identificar e deletar todas as duplicatas exceto a mais antiga
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id, cardapio_item_id 
           ORDER BY created_at ASC
         ) as rn
  FROM mapeamento_cardapio_itens
)
DELETE FROM mapeamento_cardapio_itens
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Agora adicionar a constraint UNIQUE
ALTER TABLE mapeamento_cardapio_itens 
ADD CONSTRAINT mapeamento_cardapio_itens_org_item_unique 
UNIQUE (organization_id, cardapio_item_id);