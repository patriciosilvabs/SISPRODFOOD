-- Create table for category-based mappings
CREATE TABLE public.mapeamento_cardapio_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  tipo TEXT, -- 'PRODUTO' ou 'OPÇÃO' (opcional, para filtrar)
  item_porcionado_id UUID NOT NULL REFERENCES public.itens_porcionados(id) ON DELETE CASCADE,
  quantidade_consumida INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (organization_id, loja_id, categoria, item_porcionado_id)
);

-- Enable RLS
ALTER TABLE public.mapeamento_cardapio_categorias ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage mapeamento_cardapio_categorias"
ON public.mapeamento_cardapio_categorias
FOR ALL
USING (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
)
WITH CHECK (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
);

CREATE POLICY "Users can view mapeamento_cardapio_categorias from their org"
ON public.mapeamento_cardapio_categorias
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

-- Add index for faster lookups
CREATE INDEX idx_mapeamento_categorias_org_loja_cat 
ON public.mapeamento_cardapio_categorias(organization_id, loja_id, categoria);