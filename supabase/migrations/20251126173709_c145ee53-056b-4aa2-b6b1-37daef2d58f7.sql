-- Adicionar campo para rastrear confirmação de recebimento pela loja
ALTER TABLE estoque_loja_produtos 
ADD COLUMN IF NOT EXISTS data_confirmacao_recebimento TIMESTAMP WITH TIME ZONE;