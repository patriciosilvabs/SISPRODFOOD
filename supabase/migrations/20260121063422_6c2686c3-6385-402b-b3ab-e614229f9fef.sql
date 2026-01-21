-- Limpeza de dados inconsistentes: remover registros de produção e contagens com data_referencia errada (2026-01-21)
-- Esses registros foram criados durante sessões que cruzaram meia-noite, com dia_operacional calculado incorretamente

-- 1. Remover registros de produção do dia 21/01 que estão pendentes (a_produzir)
DELETE FROM producao_registros 
WHERE data_referencia = '2026-01-21' 
AND status = 'a_produzir';

-- 2. Remover contagens do dia 21/01 que foram criadas incorretamente
DELETE FROM contagem_porcionados
WHERE dia_operacional = '2026-01-21';