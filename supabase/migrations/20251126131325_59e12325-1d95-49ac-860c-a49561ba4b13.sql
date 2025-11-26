-- Adicionar novos campos à tabela produtos
ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS codigo text UNIQUE,
ADD COLUMN IF NOT EXISTS unidade_consumo text,
ADD COLUMN IF NOT EXISTS classificacao text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON produtos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Adicionar novos valores ao enum categoria_produto
ALTER TYPE categoria_produto ADD VALUE IF NOT EXISTS 'material_escritorio';
ALTER TYPE categoria_produto ADD VALUE IF NOT EXISTS 'material_limpeza';
ALTER TYPE categoria_produto ADD VALUE IF NOT EXISTS 'embalagens';
ALTER TYPE categoria_produto ADD VALUE IF NOT EXISTS 'descartaveis';
ALTER TYPE categoria_produto ADD VALUE IF NOT EXISTS 'equipamentos';