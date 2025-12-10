-- 1. Deletar registros claramente inválidos do histórico de calibragem
DELETE FROM producao_massa_historico
WHERE peso_medio_real_bolinha_g < 100  -- Abaixo de 100g (impossível para bolinhas)
   OR peso_medio_real_bolinha_g > 1000  -- Acima de 1kg (impossível para bolinhas)
   OR peso_final_g < 1000             -- Peso total menor que 1kg (impossível para lotes)
   OR peso_final_g > 100000000;       -- Peso total absurdo (>100 toneladas)

-- 2. Corrigir peso_medio_operacional_bolinha_g para valor alvo configurado
UPDATE itens_porcionados
SET peso_medio_operacional_bolinha_g = peso_alvo_bolinha_g,
    updated_at = NOW()
WHERE unidade_medida = 'lote_masseira'
  AND peso_alvo_bolinha_g IS NOT NULL
  AND (
    peso_medio_operacional_bolinha_g IS NULL 
    OR peso_medio_operacional_bolinha_g < 100 
    OR peso_medio_operacional_bolinha_g > 1000
  );