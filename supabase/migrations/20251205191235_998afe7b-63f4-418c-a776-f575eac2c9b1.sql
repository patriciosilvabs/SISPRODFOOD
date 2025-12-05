-- ============================================
-- Tabela de Convites Pendentes
-- ============================================

CREATE TABLE public.convites_pendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  roles text[] NOT NULL DEFAULT '{}',
  lojas_ids uuid[] DEFAULT '{}',
  convidado_por_id uuid NOT NULL,
  convidado_por_nome text NOT NULL,
  token uuid DEFAULT gen_random_uuid() NOT NULL,
  status text DEFAULT 'pendente' NOT NULL, -- pendente, aceito, expirado, cancelado
  expires_at timestamptz DEFAULT (now() + interval '7 days') NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  accepted_at timestamptz,
  UNIQUE(organization_id, email)
);

-- Enable RLS
ALTER TABLE public.convites_pendentes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage invites in their organization"
ON public.convites_pendentes
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Admin'::app_role)
);

-- Allow service role to manage all invites (for edge functions)
CREATE POLICY "Service role can manage all invites"
ON public.convites_pendentes
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Allow users to view invites for their email (for accepting)
CREATE POLICY "Users can view their own pending invites"
ON public.convites_pendentes
FOR SELECT
USING (
  lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  AND status = 'pendente'
);

-- Index for faster lookups
CREATE INDEX convites_pendentes_email_idx ON public.convites_pendentes (lower(email));
CREATE INDEX convites_pendentes_token_idx ON public.convites_pendentes (token);
CREATE INDEX convites_pendentes_status_idx ON public.convites_pendentes (status);