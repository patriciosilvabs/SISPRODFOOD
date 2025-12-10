-- Adicionar campos de embalagem opcional por porção
ALTER TABLE itens_porcionados 
ADD COLUMN IF NOT EXISTS usa_embalagem_por_porcao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS insumo_embalagem_id UUID REFERENCES insumos(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unidade_embalagem TEXT DEFAULT 'unidade',
ADD COLUMN IF NOT EXISTS fator_consumo_embalagem_por_porcao NUMERIC DEFAULT 1;

-- Comentários explicativos
COMMENT ON COLUMN itens_porcionados.usa_embalagem_por_porcao IS 'Se TRUE, item consome embalagem por porção produzida';
COMMENT ON COLUMN itens_porcionados.insumo_embalagem_id IS 'ID do insumo usado como embalagem (saco, bandeja, etc)';
COMMENT ON COLUMN itens_porcionados.unidade_embalagem IS 'Unidade de medida da embalagem (unidade, pacote, rolo)';
COMMENT ON COLUMN itens_porcionados.fator_consumo_embalagem_por_porcao IS 'Quantas embalagens são consumidas por porção (ex: 1 saco por porção)';