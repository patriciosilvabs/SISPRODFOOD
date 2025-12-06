-- Tabela para estoque central de produtos no CPD
CREATE TABLE public.estoque_cpd_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  data_ultima_movimentacao TIMESTAMPTZ DEFAULT now(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, produto_id)
);

-- Tabela para log de movimentações
CREATE TABLE public.movimentacoes_cpd_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  produto_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada_compra', 'entrada_producao', 'ajuste_positivo', 'ajuste_negativo', 'saida_romaneio')),
  quantidade NUMERIC NOT NULL,
  quantidade_anterior NUMERIC NOT NULL DEFAULT 0,
  quantidade_posterior NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.estoque_cpd_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_cpd_produtos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for estoque_cpd_produtos
CREATE POLICY "Users can view estoque CPD produtos from their organization"
ON public.estoque_cpd_produtos
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage estoque CPD produtos"
ON public.estoque_cpd_produtos
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
);

-- RLS Policies for movimentacoes_cpd_produtos
CREATE POLICY "Users can view movimentacoes from their organization"
ON public.movimentacoes_cpd_produtos
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can insert movimentacoes"
ON public.movimentacoes_cpd_produtos
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
);

-- Trigger para updated_at
CREATE TRIGGER update_estoque_cpd_produtos_updated_at
BEFORE UPDATE ON public.estoque_cpd_produtos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();