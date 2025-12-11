-- Criar tabela de solicitações de reposição
CREATE TABLE public.solicitacoes_reposicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  loja_nome TEXT NOT NULL,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  produto_nome TEXT NOT NULL,
  quantidade_solicitada NUMERIC NOT NULL DEFAULT 0,
  quantidade_atendida NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  usuario_solicitante_id UUID NOT NULL,
  usuario_solicitante_nome TEXT NOT NULL,
  data_solicitacao TIMESTAMPTZ DEFAULT NOW(),
  data_atendimento TIMESTAMPTZ,
  usuario_atendente_id UUID,
  usuario_atendente_nome TEXT,
  observacao TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_solicitacoes_reposicao_org ON solicitacoes_reposicao(organization_id);
CREATE INDEX idx_solicitacoes_reposicao_loja ON solicitacoes_reposicao(loja_id);
CREATE INDEX idx_solicitacoes_reposicao_status ON solicitacoes_reposicao(status);
CREATE INDEX idx_solicitacoes_reposicao_loja_status ON solicitacoes_reposicao(loja_id, status);

-- Enable RLS
ALTER TABLE public.solicitacoes_reposicao ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view solicitacoes from their organization
CREATE POLICY "Users can view solicitacoes from their organization"
ON public.solicitacoes_reposicao
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

-- Policy: Loja users can create solicitacoes for their stores
CREATE POLICY "Users can create solicitacoes for their stores"
ON public.solicitacoes_reposicao
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM lojas_acesso la
      WHERE la.user_id = auth.uid()
      AND la.loja_id = solicitacoes_reposicao.loja_id
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
);

-- Policy: CPD/Admin can update solicitacoes (to mark as attended)
CREATE POLICY "CPD and Admin can update solicitacoes"
ON public.solicitacoes_reposicao
FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- Policy: Users can delete their own pending solicitacoes
CREATE POLICY "Users can delete their pending solicitacoes"
ON public.solicitacoes_reposicao
FOR DELETE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND status = 'pendente'
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR usuario_solicitante_id = auth.uid()
  )
);