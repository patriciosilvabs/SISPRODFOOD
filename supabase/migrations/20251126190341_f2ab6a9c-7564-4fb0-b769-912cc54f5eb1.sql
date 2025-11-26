-- Adicionar campos de quantidade e peso recebidos na tabela romaneio_itens
ALTER TABLE romaneio_itens 
ADD COLUMN quantidade_recebida INTEGER,
ADD COLUMN peso_recebido_kg NUMERIC(10,2);

COMMENT ON COLUMN romaneio_itens.quantidade_recebida IS 'Quantidade efetivamente recebida pela loja (pode diferir da quantidade enviada devido a perdas/danos)';
COMMENT ON COLUMN romaneio_itens.peso_recebido_kg IS 'Peso efetivamente recebido pela loja em kg';