-- Recriar a coluna a_produzir com a nova fórmula do modelo 3 camadas
-- que inclui vendas do Cardápio Web

ALTER TABLE contagem_porcionados 
DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados 
ADD COLUMN a_produzir integer 
GENERATED ALWAYS AS (
  GREATEST(0, (COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0)) + COALESCE(cardapio_web_baixa_total, 0))
) STORED;