-- Atualizar função has_role para verificar AMBAS as tabelas (user_roles E organization_members)
-- Isso corrige o problema onde usuários convidados via sistema multi-tenant
-- só têm role em organization_members, não em user_roles

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Verificar em user_roles (sistema de permissões granulares)
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  OR EXISTS (
    -- Verificar em organization_members (usuários convidados via multi-tenant)
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id AND role = _role
  )
$$;