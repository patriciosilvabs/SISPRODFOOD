-- Migração: Corrigir escala_configuracao para insumos de itens LOTE_MASSEIRA
-- E atualizar registros de produção existentes

-- 1. Atualizar escala_configuracao para 'por_lote' em todos os insumos
-- vinculados a itens com unidade_medida = 'lote_masseira'
UPDATE insumos_extras ie
SET escala_configuracao = 'por_lote'
FROM itens_porcionados ip
WHERE ie.item_porcionado_id = ip.id
  AND ip.unidade_medida = 'lote_masseira'
  AND (ie.escala_configuracao IS NULL OR ie.escala_configuracao != 'por_lote');

-- 2. Recalcular e atualizar producao_registros existentes para itens LOTE_MASSEIRA
-- que estejam com lotes_masseira NULL ou incorreto
UPDATE producao_registros pr
SET 
  lotes_masseira = CEIL(
    COALESCE(pr.unidades_programadas, 0)::numeric / 
    NULLIF(FLOOR((ip.massa_gerada_por_lote_kg * 1000) / NULLIF(ip.peso_medio_operacional_bolinha_g, 0)), 0)
  ),
  farinha_consumida_kg = CEIL(
    COALESCE(pr.unidades_programadas, 0)::numeric / 
    NULLIF(FLOOR((ip.massa_gerada_por_lote_kg * 1000) / NULLIF(ip.peso_medio_operacional_bolinha_g, 0)), 0)
  ) * ip.farinha_por_lote_kg,
  massa_total_gerada_kg = CEIL(
    COALESCE(pr.unidades_programadas, 0)::numeric / 
    NULLIF(FLOOR((ip.massa_gerada_por_lote_kg * 1000) / NULLIF(ip.peso_medio_operacional_bolinha_g, 0)), 0)
  ) * ip.massa_gerada_por_lote_kg
FROM itens_porcionados ip
WHERE pr.item_id = ip.id
  AND ip.unidade_medida = 'lote_masseira'
  AND ip.farinha_por_lote_kg IS NOT NULL
  AND ip.massa_gerada_por_lote_kg IS NOT NULL
  AND ip.peso_medio_operacional_bolinha_g IS NOT NULL
  AND ip.peso_medio_operacional_bolinha_g > 0
  AND (pr.lotes_masseira IS NULL OR pr.lotes_masseira = 0);