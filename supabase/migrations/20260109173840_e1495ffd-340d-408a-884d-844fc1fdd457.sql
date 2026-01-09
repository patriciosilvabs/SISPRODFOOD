-- Adicionar coluna quantidade_volumes na tabela romaneio_itens
ALTER TABLE public.romaneio_itens
ADD COLUMN IF NOT EXISTS quantidade_volumes INTEGER DEFAULT 0;