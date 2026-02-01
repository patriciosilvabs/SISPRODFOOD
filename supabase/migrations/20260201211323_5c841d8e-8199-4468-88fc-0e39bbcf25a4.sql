-- 1. Alterar fórmula de a_produzir para = vendas acumuladas
ALTER TABLE contagem_porcionados DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados 
ADD COLUMN a_produzir integer 
GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(cardapio_web_baixa_total, 0))
) STORED;

-- 2. Criar nova coluna saldo_atual = ideal - vendas
ALTER TABLE contagem_porcionados 
ADD COLUMN saldo_atual integer 
GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(cardapio_web_baixa_total, 0))
) STORED;