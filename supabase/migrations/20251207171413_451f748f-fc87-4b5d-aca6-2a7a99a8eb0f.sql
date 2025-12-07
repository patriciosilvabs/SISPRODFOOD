-- Corrigir valor de consumo_por_traco_g de 15 para 15000 (15kg) no item MASSA PORCIONADO
UPDATE itens_porcionados 
SET consumo_por_traco_g = 15000 
WHERE nome = 'MASSA PORCIONADO' AND consumo_por_traco_g = 15;