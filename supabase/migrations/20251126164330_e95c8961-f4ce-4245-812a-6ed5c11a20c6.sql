-- Adicionar campo 'ativo' para soft delete em itens_porcionados
ALTER TABLE itens_porcionados ADD COLUMN ativo boolean NOT NULL DEFAULT true;

-- Criar índice para melhorar performance de queries filtrando itens ativos
CREATE INDEX idx_itens_porcionados_ativo ON itens_porcionados(ativo);