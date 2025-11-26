-- Adicionar colunas para rastreamento detalhado das etapas de produção
ALTER TABLE producao_registros 
ADD COLUMN IF NOT EXISTS peso_preparo_kg NUMERIC,
ADD COLUMN IF NOT EXISTS sobra_preparo_kg NUMERIC,
ADD COLUMN IF NOT EXISTS observacao_preparo TEXT,
ADD COLUMN IF NOT EXISTS data_inicio_preparo TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_fim_preparo TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS observacao_porcionamento TEXT,
ADD COLUMN IF NOT EXISTS data_inicio_porcionamento TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_fim_porcionamento TIMESTAMP WITH TIME ZONE;

-- Adicionar comentários para documentação
COMMENT ON COLUMN producao_registros.peso_preparo_kg IS 'Peso total após a etapa de preparo (fatiação, ralação, cozimento, etc)';
COMMENT ON COLUMN producao_registros.sobra_preparo_kg IS 'Sobra/perda durante o preparo (pedaços não aproveitados, estragados)';
COMMENT ON COLUMN producao_registros.observacao_preparo IS 'Observações sobre a etapa de preparo';
COMMENT ON COLUMN producao_registros.data_inicio_preparo IS 'Timestamp de quando a etapa de preparo foi iniciada';
COMMENT ON COLUMN producao_registros.data_fim_preparo IS 'Timestamp de quando a etapa de preparo foi concluída';
COMMENT ON COLUMN producao_registros.observacao_porcionamento IS 'Observações sobre a etapa de porcionamento';
COMMENT ON COLUMN producao_registros.data_inicio_porcionamento IS 'Timestamp de quando a etapa de porcionamento foi iniciada';
COMMENT ON COLUMN producao_registros.data_fim_porcionamento IS 'Timestamp de quando a etapa de porcionamento foi concluída';