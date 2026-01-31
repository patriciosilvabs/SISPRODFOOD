-- Tabela de configuração de integração PDV por organização
CREATE TABLE integracoes_pdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'PDV Pizzaria',
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  notificar_romaneio BOOLEAN DEFAULT true,
  sincronizar_demanda BOOLEAN DEFAULT true,
  ultima_sincronizacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- Tabela de logs de integração para auditoria
CREATE TABLE integracoes_pdv_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL CHECK (direcao IN ('pull', 'push')),
  endpoint TEXT NOT NULL,
  metodo TEXT NOT NULL,
  payload JSONB,
  resposta JSONB,
  status_code INTEGER,
  sucesso BOOLEAN NOT NULL,
  erro TEXT,
  duracao_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_integracoes_pdv_log_org ON integracoes_pdv_log(organization_id);
CREATE INDEX idx_integracoes_pdv_log_created ON integracoes_pdv_log(created_at DESC);

-- Enable RLS
ALTER TABLE integracoes_pdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE integracoes_pdv_log ENABLE ROW LEVEL SECURITY;

-- Policies para integracoes_pdv
CREATE POLICY "Users can view PDV integration of their organization" ON integracoes_pdv
  FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage PDV integration" ON integracoes_pdv
  FOR ALL USING (
    organization_id = get_user_organization_id(auth.uid()) 
    AND has_role(auth.uid(), 'Admin'::app_role)
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) 
    AND has_role(auth.uid(), 'Admin'::app_role)
  );

-- Policies para integracoes_pdv_log
CREATE POLICY "Users can view PDV logs of their organization" ON integracoes_pdv_log
  FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "System can insert PDV logs" ON integracoes_pdv_log
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id(auth.uid()));