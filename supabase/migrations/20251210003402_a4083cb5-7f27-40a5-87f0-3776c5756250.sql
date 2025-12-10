-- Adicionar novo valor ao ENUM unidade_medida
ALTER TYPE unidade_medida ADD VALUE IF NOT EXISTS 'lote_com_perda';

-- Adicionar novas colunas para Lote com Perda
ALTER TABLE itens_porcionados 
ADD COLUMN IF NOT EXISTS perda_cozimento_percentual numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS peso_pronto_g numeric;

-- Comentários para documentação
COMMENT ON COLUMN itens_porcionados.perda_cozimento_percentual IS 'Percentual de perda durante o cozimento (0-99). Usado quando unidade_medida = lote_com_perda';
COMMENT ON COLUMN itens_porcionados.peso_pronto_g IS 'Peso da porção após o cozimento em gramas. Usado quando unidade_medida = lote_com_perda';