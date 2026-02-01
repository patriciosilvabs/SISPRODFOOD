-- Alterar cardapio_item_id de integer para bigint para suportar códigos grandes
ALTER TABLE mapeamento_cardapio_itens 
  ALTER COLUMN cardapio_item_id TYPE bigint;