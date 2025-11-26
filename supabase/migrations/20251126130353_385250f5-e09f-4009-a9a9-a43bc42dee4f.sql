-- Remover a foreign key errada que aponta para 'produtos'
ALTER TABLE estoque_cpd 
DROP CONSTRAINT IF EXISTS estoque_cpd_produto_id_fkey;

-- Criar a foreign key correta apontando para 'itens_porcionados'
ALTER TABLE estoque_cpd 
ADD CONSTRAINT estoque_cpd_item_porcionado_id_fkey 
FOREIGN KEY (item_porcionado_id) 
REFERENCES itens_porcionados(id) 
ON DELETE CASCADE;