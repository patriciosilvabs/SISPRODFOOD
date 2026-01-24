-- Adicionar coluna faltante total_tracos_lote na tabela producao_registros
ALTER TABLE public.producao_registros 
ADD COLUMN IF NOT EXISTS total_tracos_lote INTEGER DEFAULT 1;

COMMENT ON COLUMN public.producao_registros.total_tracos_lote IS 
'Total de tracos/lotes programados para esta producao (ex: traco 2 de 5)';