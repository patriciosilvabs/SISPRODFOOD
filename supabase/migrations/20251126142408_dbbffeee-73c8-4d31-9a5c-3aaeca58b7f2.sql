-- Adicionar campos de controle de timestamp à tabela estoque_loja_produtos
ALTER TABLE estoque_loja_produtos 
  ADD COLUMN data_ultima_contagem TIMESTAMPTZ,
  ADD COLUMN data_ultimo_envio TIMESTAMPTZ;