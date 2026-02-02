-- Recriar coluna gerada a_produzir com lógica unificada (manual + automático)
ALTER TABLE contagem_porcionados DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados
ADD COLUMN a_produzir integer GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))
) STORED;