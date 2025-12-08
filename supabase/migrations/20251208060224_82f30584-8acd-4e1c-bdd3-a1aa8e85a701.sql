-- Create alertas_estoque table to track sent alerts
CREATE TABLE public.alertas_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  item_tipo TEXT NOT NULL CHECK (item_tipo IN ('insumo', 'produto')),
  item_nome TEXT NOT NULL,
  status_alerta TEXT NOT NULL CHECK (status_alerta IN ('critico', 'urgente')),
  estoque_atual NUMERIC,
  dias_cobertura_restante NUMERIC,
  enviado_em TIMESTAMPTZ DEFAULT now(),
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index to prevent duplicate active alerts for same item
CREATE UNIQUE INDEX alertas_estoque_item_ativo 
ON public.alertas_estoque(organization_id, item_id, item_tipo) 
WHERE resolvido_em IS NULL;

-- Index for querying by organization
CREATE INDEX idx_alertas_estoque_org ON public.alertas_estoque(organization_id);

-- Enable RLS
ALTER TABLE public.alertas_estoque ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view alertas from their organization"
ON public.alertas_estoque FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage alertas in their organization"
ON public.alertas_estoque FOR ALL
USING (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
)
WITH CHECK (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
);

-- Create configuracao_alertas table for organization preferences
CREATE TABLE public.configuracao_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  alertas_email_ativos BOOLEAN DEFAULT true,
  emails_destinatarios TEXT[] DEFAULT '{}',
  horario_envio_preferido TIME DEFAULT '08:00',
  enviar_apenas_criticos BOOLEAN DEFAULT false,
  frequencia TEXT DEFAULT 'diario' CHECK (frequencia IN ('diario', 'semanal', 'nunca')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracao_alertas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view configuracao from their organization"
ON public.configuracao_alertas FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage configuracao in their organization"
ON public.configuracao_alertas FOR ALL
USING (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
)
WITH CHECK (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
);

-- Trigger for updated_at
CREATE TRIGGER update_configuracao_alertas_updated_at
BEFORE UPDATE ON public.configuracao_alertas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();