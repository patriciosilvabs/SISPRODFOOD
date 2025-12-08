-- Criar tabela para estoque mínimo semanal de insumos
CREATE TABLE public.insumos_estoque_minimo_semanal (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  insumo_id UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  segunda NUMERIC NOT NULL DEFAULT 0,
  terca NUMERIC NOT NULL DEFAULT 0,
  quarta NUMERIC NOT NULL DEFAULT 0,
  quinta NUMERIC NOT NULL DEFAULT 0,
  sexta NUMERIC NOT NULL DEFAULT 0,
  sabado NUMERIC NOT NULL DEFAULT 0,
  domingo NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(insumo_id, organization_id)
);

-- Habilitar RLS
ALTER TABLE public.insumos_estoque_minimo_semanal ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view insumos estoque minimo from their organization"
ON public.insumos_estoque_minimo_semanal
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can manage insumos estoque minimo in their organization"
ON public.insumos_estoque_minimo_semanal
FOR ALL
USING (
  is_super_admin(auth.uid()) OR (
    organization_id = get_user_organization_id(auth.uid()) AND 
    (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR (
    organization_id = get_user_organization_id(auth.uid()) AND 
    (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_insumos_estoque_minimo_semanal_updated_at
BEFORE UPDATE ON public.insumos_estoque_minimo_semanal
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();