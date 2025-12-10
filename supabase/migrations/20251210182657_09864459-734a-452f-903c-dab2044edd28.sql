-- Corrigir peso_medio_operacional_bolinha_g corrompido para itens LOTE_MASSEIRA
-- Valor atual do MASSA: 2.148.308,76g (incorreto)
-- Valor correto: peso_alvo_bolinha_g ou média entre min/max

UPDATE itens_porcionados
SET peso_medio_operacional_bolinha_g = COALESCE(
  peso_alvo_bolinha_g,
  (COALESCE(peso_minimo_bolinha_g, 400) + COALESCE(peso_maximo_bolinha_g, 450)) / 2
)
WHERE unidade_medida = 'lote_masseira'
  AND (
    peso_medio_operacional_bolinha_g IS NULL
    OR peso_medio_operacional_bolinha_g <= 0
    OR peso_medio_operacional_bolinha_g > 10000  -- Qualquer valor acima de 10kg por bolinha é claramente erro
    OR (peso_minimo_bolinha_g IS NOT NULL AND peso_medio_operacional_bolinha_g < peso_minimo_bolinha_g * 0.5)
    OR (peso_maximo_bolinha_g IS NOT NULL AND peso_medio_operacional_bolinha_g > peso_maximo_bolinha_g * 2)
  );