-- Adicionar colunas tipo e categoria na tabela mapeamento_cardapio_itens
ALTER TABLE public.mapeamento_cardapio_itens
ADD COLUMN tipo text,
ADD COLUMN categoria text;

-- Alterar item_porcionado_id para permitir NULL (para importação em lote)
ALTER TABLE public.mapeamento_cardapio_itens
ALTER COLUMN item_porcionado_id DROP NOT NULL;

-- Criar índices para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_mapeamento_cardapio_tipo ON public.mapeamento_cardapio_itens(tipo);
CREATE INDEX IF NOT EXISTS idx_mapeamento_cardapio_categoria ON public.mapeamento_cardapio_itens(categoria);

-- Comentários nas colunas
COMMENT ON COLUMN public.mapeamento_cardapio_itens.tipo IS 'Tipo do item: PRODUTO ou OPÇÃO';
COMMENT ON COLUMN public.mapeamento_cardapio_itens.categoria IS 'Categoria ou complemento do item no Cardápio Web';