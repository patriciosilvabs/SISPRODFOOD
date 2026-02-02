-- Alterar a lógica da coluna gerada a_produzir
-- De: GREATEST(0, ideal_amanha - final_sobra) - modelo "teto fixo"
-- Para: LEAST(ideal_amanha, cardapio_web_baixa_total) - modelo "repor vendas"

ALTER TABLE contagem_porcionados 
DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados
ADD COLUMN a_produzir integer GENERATED ALWAYS AS (
  LEAST(
    COALESCE(ideal_amanha, 0),
    COALESCE(cardapio_web_baixa_total, 0)
  )
) STORED;