
-- Criar tabela user_page_access para override de acesso por página
CREATE TABLE public.user_page_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  page_route TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, page_route)
);

-- Enable RLS
ALTER TABLE public.user_page_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own page access"
ON public.user_page_access
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage page access in their organization"
ON public.user_page_access
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Admin'::app_role)
);

CREATE POLICY "SuperAdmin can manage all page access"
ON public.user_page_access
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Adicionar coluna is_admin em organization_members
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Migrar: usuários com role Admin devem ter is_admin = true
UPDATE public.organization_members 
SET is_admin = true 
WHERE role = 'Admin'::app_role;

-- Função para verificar perfil do usuário baseado no tipo de loja vinculada
CREATE OR REPLACE FUNCTION public.get_user_profile(_user_id uuid)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM organization_members 
        WHERE user_id = _user_id AND is_admin = true
      ) THEN 'admin'
      WHEN EXISTS (
        SELECT 1 FROM lojas_acesso la
        JOIN lojas l ON l.id = la.loja_id
        WHERE la.user_id = _user_id AND l.tipo = 'cpd'
      ) THEN 'cpd'
      ELSE 'loja'
    END
$$;

-- Função para verificar acesso a página
CREATE OR REPLACE FUNCTION public.has_page_access(_user_id uuid, _page_route text)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- SuperAdmin tem acesso total
      WHEN is_super_admin(_user_id) THEN true
      -- Verificar override específico
      WHEN EXISTS (
        SELECT 1 FROM user_page_access 
        WHERE user_id = _user_id 
        AND page_route = _page_route
        AND organization_id = get_user_organization_id(_user_id)
      ) THEN (
        SELECT enabled FROM user_page_access 
        WHERE user_id = _user_id 
        AND page_route = _page_route
        AND organization_id = get_user_organization_id(_user_id)
      )
      -- Se não há override, retorna true (usa default do perfil no frontend)
      ELSE true
    END
$$;

-- Trigger para updated_at
CREATE TRIGGER update_user_page_access_updated_at
BEFORE UPDATE ON public.user_page_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
