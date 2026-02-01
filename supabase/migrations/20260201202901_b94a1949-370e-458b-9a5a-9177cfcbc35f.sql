-- Corrigir a fórmula de a_produzir: remover cardapio_web_baixa_total do cálculo
-- O campo final_sobra já representa o estoque físico REAL após todas as vendas
-- Vendas web são apenas para auditoria, não devem influenciar produção

ALTER TABLE contagem_porcionados 
DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados 
ADD COLUMN a_produzir integer 
GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))
) STORED;