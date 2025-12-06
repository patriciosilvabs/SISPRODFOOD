-- Criar tabela audit_logs para logging de auditoria
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX idx_audit_logs_org ON public.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins podem ver logs da sua organização
CREATE POLICY "Admins podem ver logs da organizacao"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin')
);

-- SuperAdmin pode ver todos os logs
CREATE POLICY "SuperAdmin pode ver todos os logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Todos autenticados podem inserir logs (para logar suas próprias ações)
CREATE POLICY "Usuarios podem inserir logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Service role pode inserir logs (para Edge Functions)
CREATE POLICY "Service role pode inserir logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');