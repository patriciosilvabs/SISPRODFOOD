-- Tabela para configurações de UI por organização
CREATE TABLE public.ui_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pagina_id TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, pagina_id)
);

-- Habilitar RLS
ALTER TABLE public.ui_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage ui_permissions in their org"
  ON public.ui_permissions FOR ALL
  USING (organization_id = get_user_organization_id(auth.uid()) 
         AND has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) 
              AND has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view ui_permissions from their org"
  ON public.ui_permissions FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ui_permissions_updated_at
  BEFORE UPDATE ON public.ui_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar comentário na tabela
COMMENT ON TABLE public.ui_permissions IS 'Configurações de visibilidade de UI por organização - controla páginas, seções, colunas e ações';