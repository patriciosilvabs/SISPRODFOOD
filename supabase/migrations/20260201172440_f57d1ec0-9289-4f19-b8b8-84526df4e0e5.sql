-- Adicionar coluna para armazenar a API Key do CardápioWeb
ALTER TABLE integracoes_cardapio_web 
ADD COLUMN cardapio_api_key TEXT;

-- Comentário para documentação
COMMENT ON COLUMN integracoes_cardapio_web.cardapio_api_key IS 'API Key do CardápioWeb necessária para buscar detalhes dos pedidos via API';