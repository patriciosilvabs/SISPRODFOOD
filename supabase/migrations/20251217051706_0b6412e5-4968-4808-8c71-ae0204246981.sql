-- Remover a constraint antiga
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_modo_envio_check;

-- Adicionar nova constraint com os novos valores
ALTER TABLE produtos ADD CONSTRAINT produtos_modo_envio_check 
CHECK (modo_envio = ANY (ARRAY['peso'::text, 'unidade'::text, 'lote_kg'::text, 'lote_qtde'::text]));