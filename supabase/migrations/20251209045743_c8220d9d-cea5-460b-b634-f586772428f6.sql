-- Remover constraint/índice UNIQUE antigo que bloqueia múltiplas contagens por dia operacional
-- A constraint correta já existe: contagem_porcionados_unica_por_dia_operacional (loja_id, item_porcionado_id, dia_operacional)
DROP INDEX IF EXISTS idx_contagem_unique;