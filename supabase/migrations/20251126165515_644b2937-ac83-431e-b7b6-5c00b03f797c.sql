-- Adicionar campo consumo_por_traco_g para armazenar o consumo em gramas quando unidade é traço
ALTER TABLE itens_porcionados ADD COLUMN consumo_por_traco_g numeric DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN itens_porcionados.consumo_por_traco_g IS 'Quantidade em gramas consumida por traço (usado quando unidade_medida = traco)';