-- Adicionar coluna codigo_cardapio_web na tabela lojas
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS codigo_cardapio_web TEXT;

-- Comentário explicativo
COMMENT ON COLUMN lojas.codigo_cardapio_web IS 'Código da loja no sistema Cardápio Web (ex: 8268)';