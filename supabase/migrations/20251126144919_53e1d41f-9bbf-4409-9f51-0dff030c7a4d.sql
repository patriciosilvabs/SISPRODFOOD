-- Preencher data_ultima_contagem em registros existentes
-- Isso ativa todos os registros antigos para aparecerem em "Envio CPD"
UPDATE estoque_loja_produtos 
SET data_ultima_contagem = data_ultima_atualizacao 
WHERE data_ultima_contagem IS NULL;