-- Adicionar campo para armazenar quantidade enviada pelo CPD
ALTER TABLE estoque_loja_produtos 
ADD COLUMN quantidade_ultimo_envio numeric DEFAULT 0;