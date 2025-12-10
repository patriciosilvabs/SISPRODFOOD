-- Corrigir peso_medio_operacional_bolinha_g para itens lote_masseira com valores inválidos
-- Usar peso_alvo ou média entre min/max quando o valor estiver fora da faixa esperada
UPDATE itens_porcionados
SET peso_medio_operacional_bolinha_g = COALESCE(
  peso_alvo_bolinha_g,
  (peso_minimo_bolinha_g + peso_maximo_bolinha_g) / 2
)
WHERE unidade_medida = 'lote_masseira'
  AND peso_minimo_bolinha_g IS NOT NULL
  AND peso_maximo_bolinha_g IS NOT NULL
  AND (
    peso_medio_operacional_bolinha_g IS NULL 
    OR peso_medio_operacional_bolinha_g > peso_maximo_bolinha_g * 10
    OR peso_medio_operacional_bolinha_g < peso_minimo_bolinha_g / 10
  );

-- Recalcular unidades_programadas para producao_registros de lote_masseira com dados corrompidos
UPDATE producao_registros pr
SET unidades_programadas = CEIL(
  pr.lotes_masseira * ip.massa_gerada_por_lote_kg * 1000.0 / 
  NULLIF(COALESCE(ip.peso_medio_operacional_bolinha_g, ip.peso_alvo_bolinha_g, (ip.peso_minimo_bolinha_g + ip.peso_maximo_bolinha_g) / 2), 0)
)::integer
FROM itens_porcionados ip
WHERE pr.item_id = ip.id
  AND ip.unidade_medida = 'lote_masseira'
  AND pr.lotes_masseira IS NOT NULL
  AND pr.lotes_masseira > 0
  AND ip.massa_gerada_por_lote_kg IS NOT NULL
  AND (ip.peso_medio_operacional_bolinha_g IS NOT NULL OR ip.peso_alvo_bolinha_g IS NOT NULL OR (ip.peso_minimo_bolinha_g IS NOT NULL AND ip.peso_maximo_bolinha_g IS NOT NULL));