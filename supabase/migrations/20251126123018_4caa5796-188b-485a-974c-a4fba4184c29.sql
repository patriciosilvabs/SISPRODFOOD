-- Adicionar campos de recebimento na tabela romaneios
ALTER TABLE public.romaneios
ADD COLUMN data_recebimento TIMESTAMP WITH TIME ZONE,
ADD COLUMN recebido_por_id UUID,
ADD COLUMN recebido_por_nome TEXT;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.romaneios.data_recebimento IS 'Data e hora em que o romaneio foi recebido pela loja';
COMMENT ON COLUMN public.romaneios.recebido_por_id IS 'ID do usuário que confirmou o recebimento';
COMMENT ON COLUMN public.romaneios.recebido_por_nome IS 'Nome do usuário que confirmou o recebimento';