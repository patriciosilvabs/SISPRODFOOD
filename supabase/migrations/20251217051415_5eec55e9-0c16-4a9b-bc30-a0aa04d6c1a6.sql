-- Adicionar novos valores ao enum tipo_produto
ALTER TYPE tipo_produto ADD VALUE IF NOT EXISTS 'lote_kg';
ALTER TYPE tipo_produto ADD VALUE IF NOT EXISTS 'lote_qtde';