-- Adicionar campo dia_operacional para identificar o dia da contagem
ALTER TABLE public.contagem_porcionados 
ADD COLUMN dia_operacional DATE NOT NULL DEFAULT CURRENT_DATE;

-- Atualizar registros existentes baseado na data de criação
UPDATE public.contagem_porcionados 
SET dia_operacional = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE dia_operacional = CURRENT_DATE;

-- Criar índice para melhor performance nas consultas
CREATE INDEX idx_contagem_porcionados_dia_operacional 
ON public.contagem_porcionados (organization_id, item_porcionado_id, dia_operacional);

-- Adicionar constraint única para evitar duplicatas por loja/item/dia
ALTER TABLE public.contagem_porcionados 
ADD CONSTRAINT unique_contagem_por_dia UNIQUE (loja_id, item_porcionado_id, dia_operacional);