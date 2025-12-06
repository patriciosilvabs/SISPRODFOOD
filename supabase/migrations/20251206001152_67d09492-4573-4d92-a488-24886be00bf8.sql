-- Criar tabela de permissões de usuários
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, permission_key)
);

-- Criar tabela de presets de permissões por organização
CREATE TABLE public.permission_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_presets ENABLE ROW LEVEL SECURITY;

-- Função para verificar permissão específica
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- SuperAdmin tem todas as permissões
  SELECT CASE 
    WHEN is_super_admin(_user_id) THEN true
    -- Admin tem todas as permissões da sua organização
    WHEN has_role(_user_id, 'Admin') THEN true
    -- Verificar permissão específica
    ELSE EXISTS (
      SELECT 1
      FROM public.user_permissions
      WHERE user_id = _user_id
        AND permission_key = _permission_key
        AND granted = true
        AND organization_id = get_user_organization_id(_user_id)
    )
  END
$$;

-- Função para obter todas as permissões de um usuário
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY_AGG(permission_key),
    ARRAY[]::TEXT[]
  )
  FROM public.user_permissions
  WHERE user_id = _user_id
    AND granted = true
    AND organization_id = get_user_organization_id(_user_id)
$$;

-- Políticas RLS para user_permissions
CREATE POLICY "Admins can manage permissions in their organization"
ON public.user_permissions
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Admin')
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Admin')
);

CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "SuperAdmin can manage all permissions"
ON public.user_permissions
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Políticas RLS para permission_presets
CREATE POLICY "Users can view presets from their organization or system presets"
ON public.permission_presets
FOR SELECT
USING (
  organization_id IS NULL 
  OR organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Admins can manage presets in their organization"
ON public.permission_presets
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Admin')
  AND is_system = false
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Admin')
  AND is_system = false
);

CREATE POLICY "SuperAdmin can manage all presets"
ON public.permission_presets
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Inserir presets de sistema padrão
INSERT INTO public.permission_presets (organization_id, nome, descricao, permissions, is_system) VALUES
(NULL, 'Operador CPD Completo', 'Acesso completo às operações de produção e estoque', 
 '["dashboard.view", "producao.resumo.view", "producao.resumo.manage", "insumos.view", "insumos.manage", "contagem.view", "contagem.manage", "romaneio.view", "romaneio.create", "romaneio.send", "romaneio.history", "relatorios.producao", "relatorios.romaneios", "relatorios.insumos", "relatorios.consumo"]'::jsonb, 
 true),
(NULL, 'Operador de Loja', 'Acesso às operações de loja e recebimento', 
 '["dashboard.view", "contagem.view", "contagem.manage", "estoque_loja.view", "estoque_loja.manage", "romaneio.view", "romaneio.receive", "romaneio.history", "erros.view", "erros.create"]'::jsonb, 
 true),
(NULL, 'Visualizador de Relatórios', 'Apenas visualização de relatórios e dashboard', 
 '["dashboard.view", "relatorios.producao", "relatorios.romaneios", "relatorios.estoque", "relatorios.insumos", "relatorios.consumo", "relatorios.diagnostico"]'::jsonb, 
 true),
(NULL, 'Gerente de Produção', 'Gestão completa de produção e insumos', 
 '["dashboard.view", "producao.resumo.view", "producao.resumo.manage", "insumos.view", "insumos.manage", "contagem.view", "contagem.manage", "romaneio.view", "romaneio.create", "romaneio.send", "romaneio.history", "relatorios.producao", "relatorios.romaneios", "relatorios.insumos", "relatorios.consumo", "relatorios.diagnostico", "config.itens", "config.insumos"]'::jsonb, 
 true),
(NULL, 'Gerente de Loja', 'Gestão completa de operações de loja', 
 '["dashboard.view", "contagem.view", "contagem.manage", "estoque_loja.view", "estoque_loja.manage", "romaneio.view", "romaneio.receive", "romaneio.history", "erros.view", "erros.create", "relatorios.estoque", "relatorios.romaneios"]'::jsonb, 
 true);