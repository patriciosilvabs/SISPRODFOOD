-- Adicionar coluna para armazenar detalhamento por loja
ALTER TABLE producao_registros 
ADD COLUMN IF NOT EXISTS detalhes_lojas jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN producao_registros.detalhes_lojas IS 'Array JSON com detalhamento de quantidades por loja: [{"loja_id": "uuid", "loja_nome": "text", "quantidade": number}]';