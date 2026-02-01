-- 1. Remover colunas geradas atuais
ALTER TABLE contagem_porcionados DROP COLUMN IF EXISTS a_produzir;
ALTER TABLE contagem_porcionados DROP COLUMN IF EXISTS saldo_atual;

-- 2. Recriar a_produzir com fórmula correta: ideal - sobra
-- Isso garante teto natural (nunca excede o ideal)
ALTER TABLE contagem_porcionados 
ADD COLUMN a_produzir integer 
GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))
) STORED;

-- 3. Adicionar comentário explicativo
COMMENT ON COLUMN contagem_porcionados.final_sobra IS 
  'Estoque atual do item. Inicia com ideal_amanha e é decrementado automaticamente pelas vendas do Cardápio Web.';