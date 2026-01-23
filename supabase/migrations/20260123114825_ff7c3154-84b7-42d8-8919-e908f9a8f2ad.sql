-- 1. Deletar tabela janelas_contagem_por_dia
DROP TABLE IF EXISTS janelas_contagem_por_dia CASCADE;

-- 2. Remover colunas de janela da tabela lojas
ALTER TABLE lojas DROP COLUMN IF EXISTS janela_contagem_inicio;
ALTER TABLE lojas DROP COLUMN IF EXISTS janela_contagem_fim;