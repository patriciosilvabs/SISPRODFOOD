-- ================================================================
-- MIGRAÇÃO: Unificar insumos em lista única "Insumos Vinculados"
-- ================================================================

-- 1. Adicionar colunas na tabela insumos_extras
ALTER TABLE public.insumos_extras 
ADD COLUMN IF NOT EXISTS is_principal BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS consumo_por_traco_g NUMERIC;

-- 2. Migrar dados existentes: criar insumos_extras com is_principal=true
-- para cada item que tem insumo_vinculado_id configurado
INSERT INTO public.insumos_extras (
  item_porcionado_id, 
  insumo_id, 
  nome, 
  quantidade, 
  unidade, 
  is_principal, 
  consumo_por_traco_g,
  organization_id
)
SELECT 
  ip.id AS item_porcionado_id,
  ip.insumo_vinculado_id AS insumo_id,
  i.nome AS nome,
  COALESCE(ip.consumo_por_traco_g, 0) AS quantidade,
  'g'::unidade_medida AS unidade,
  true AS is_principal,
  ip.consumo_por_traco_g AS consumo_por_traco_g,
  ip.organization_id AS organization_id
FROM public.itens_porcionados ip
JOIN public.insumos i ON ip.insumo_vinculado_id = i.id
WHERE ip.insumo_vinculado_id IS NOT NULL
  -- Não duplicar se já existe um insumo_extra com is_principal=true para esse item
  AND NOT EXISTS (
    SELECT 1 FROM public.insumos_extras ie 
    WHERE ie.item_porcionado_id = ip.id 
    AND ie.is_principal = true
  );

-- 3. Criar índice para performance de consultas
CREATE INDEX IF NOT EXISTS idx_insumos_extras_is_principal 
ON public.insumos_extras(item_porcionado_id, is_principal) 
WHERE is_principal = true;