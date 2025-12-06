-- Criar enum para tipo_produto
CREATE TYPE public.tipo_produto AS ENUM ('lacrado', 'porcionado', 'lote', 'simples');

-- Adicionar colunas tipo_produto e ativo na tabela produtos
ALTER TABLE public.produtos 
ADD COLUMN tipo_produto tipo_produto NOT NULL DEFAULT 'simples',
ADD COLUMN ativo boolean NOT NULL DEFAULT true;

-- Criar índice para filtrar produtos ativos
CREATE INDEX idx_produtos_ativo ON public.produtos(ativo) WHERE ativo = true;