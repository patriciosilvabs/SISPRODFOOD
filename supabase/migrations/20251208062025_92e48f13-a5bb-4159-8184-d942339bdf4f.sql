-- Add classificacao field to insumos table for ABC classification
ALTER TABLE public.insumos 
ADD COLUMN IF NOT EXISTS classificacao TEXT DEFAULT 'C';

-- Add comment for documentation
COMMENT ON COLUMN public.insumos.classificacao IS 'ABC classification: A (high value/consumption), B (medium), C (low)';