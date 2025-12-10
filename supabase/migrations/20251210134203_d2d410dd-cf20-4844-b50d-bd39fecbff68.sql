-- Adicionar campo quantidade_por_lote para itens com Lote sem Perda
ALTER TABLE itens_porcionados 
ADD COLUMN IF NOT EXISTS quantidade_por_lote INTEGER DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN itens_porcionados.quantidade_por_lote IS 'Quantidade de unidades produzidas por lote (usado para unidade_medida = lote_sem_perda)';