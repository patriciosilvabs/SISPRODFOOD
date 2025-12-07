-- Tabela para rastrear perdas de produção (prejuízo financeiro)
CREATE TABLE public.perdas_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producao_registro_id UUID NOT NULL,
  item_id UUID NOT NULL,
  item_nome TEXT NOT NULL,
  tipo_perda TEXT NOT NULL, -- 'queimado', 'contaminado', 'erro_preparo', 'equipamento', 'outro'
  quantidade_perdida NUMERIC NOT NULL,
  peso_perdido_kg NUMERIC,
  motivo TEXT NOT NULL,
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  organization_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT fk_producao_registro FOREIGN KEY (producao_registro_id) 
    REFERENCES producao_registros(id) ON DELETE CASCADE,
  CONSTRAINT fk_item FOREIGN KEY (item_id) 
    REFERENCES itens_porcionados(id) ON DELETE CASCADE,
  CONSTRAINT fk_organization FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) ON DELETE CASCADE
);

-- Habilitar RLS
ALTER TABLE public.perdas_producao ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem inserir perdas na sua organização (Admin ou Produção)
CREATE POLICY "Users can insert perdas in their organization"
ON public.perdas_producao FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) OR (
    organization_id = get_user_organization_id(auth.uid()) AND 
    (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- Policy: Usuários podem visualizar perdas da sua organização
CREATE POLICY "Users can view perdas from their organization"
ON public.perdas_producao FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

-- Index para queries frequentes
CREATE INDEX idx_perdas_producao_org ON perdas_producao(organization_id);
CREATE INDEX idx_perdas_producao_item ON perdas_producao(item_id);
CREATE INDEX idx_perdas_producao_data ON perdas_producao(created_at DESC);