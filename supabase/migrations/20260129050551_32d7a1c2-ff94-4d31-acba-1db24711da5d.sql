-- 1. Adicionar coluna gatilho mínimo à tabela itens_porcionados
ALTER TABLE itens_porcionados 
ADD COLUMN IF NOT EXISTS quantidade_minima_producao INTEGER DEFAULT 0;

COMMENT ON COLUMN itens_porcionados.quantidade_minima_producao IS 
'Quantidade mínima de unidades necessária para autorizar criação de lote de produção. 0 = desativado.';

-- 2. Criar tabela de Buffer (Backlog de Produção)
CREATE TABLE IF NOT EXISTS backlog_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES itens_porcionados(id) ON DELETE CASCADE,
  item_nome TEXT NOT NULL,
  quantidade_pendente INTEGER NOT NULL DEFAULT 0,
  gatilho_minimo INTEGER NOT NULL DEFAULT 0,
  estoque_cpd INTEGER NOT NULL DEFAULT 0,
  saldo_liquido INTEGER NOT NULL DEFAULT 0,
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'aguardando_gatilho',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Índice único para evitar duplicatas por item e data
  UNIQUE(item_id, data_referencia, organization_id)
);

-- 3. Habilitar RLS
ALTER TABLE backlog_producao ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acesso
CREATE POLICY "Usuários podem ver backlog da organização" ON backlog_producao
  FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admin e Produção podem gerenciar backlog" ON backlog_producao
  FOR ALL USING (
    organization_id = get_user_organization_id(auth.uid()) 
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) 
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  );

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_backlog_producao_org_date ON backlog_producao(organization_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_backlog_producao_status ON backlog_producao(status);
CREATE INDEX IF NOT EXISTS idx_backlog_producao_item ON backlog_producao(item_id);

-- 6. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_backlog_producao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_backlog_producao_updated_at ON backlog_producao;
CREATE TRIGGER trigger_update_backlog_producao_updated_at
  BEFORE UPDATE ON backlog_producao
  FOR EACH ROW
  EXECUTE FUNCTION update_backlog_producao_updated_at();