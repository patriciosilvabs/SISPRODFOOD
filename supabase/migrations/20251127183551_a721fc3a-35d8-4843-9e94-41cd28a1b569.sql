-- Fase 1: Estrutura Base Multi-Tenant para Comercialização SaaS

-- 1. Criar tabela organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ativo BOOLEAN NOT NULL DEFAULT true
);

-- 2. Criar tabela organization_members
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'Loja',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- 3. Criar índices para performance
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_org_id ON public.organization_members(organization_id);

-- 4. Criar função helper para obter organização do usuário
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = _user_id 
  LIMIT 1
$$;

-- 5. Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies para organizations

-- Usuários podem ver sua própria organização
CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Admins podem atualizar sua organização
CREATE POLICY "Admins can update their organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin')
)
WITH CHECK (
  id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin')
);

-- 7. RLS Policies para organization_members

-- Usuários podem ver membros da sua organização
CREATE POLICY "Users can view members of their organization"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
);

-- Admins podem gerenciar membros da sua organização
CREATE POLICY "Admins can manage members in their organization"
ON public.organization_members
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin')
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin')
);