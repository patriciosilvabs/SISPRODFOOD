-- Tabela de pedidos de compra
CREATE TABLE public.pedidos_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'parcial', 'recebido', 'cancelado')),
  data_pedido TIMESTAMPTZ DEFAULT now(),
  data_prevista_entrega DATE,
  data_recebimento TIMESTAMPTZ,
  recebido_por_id UUID,
  recebido_por_nome TEXT,
  observacao TEXT,
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, numero_pedido)
);

-- Tabela de itens do pedido de compra
CREATE TABLE public.pedidos_compra_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  produto_nome TEXT NOT NULL,
  quantidade_solicitada NUMERIC NOT NULL,
  quantidade_recebida NUMERIC,
  unidade TEXT,
  divergencia BOOLEAN DEFAULT false,
  observacao_divergencia TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_compra_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pedidos_compra
CREATE POLICY "Users can view pedidos_compra from their organization"
ON public.pedidos_compra FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage pedidos_compra"
ON public.pedidos_compra FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
);

-- RLS Policies for pedidos_compra_itens
CREATE POLICY "Users can view pedidos_compra_itens from their organization"
ON public.pedidos_compra_itens FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage pedidos_compra_itens"
ON public.pedidos_compra_itens FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
);

-- Trigger para updated_at
CREATE TRIGGER update_pedidos_compra_updated_at
  BEFORE UPDATE ON public.pedidos_compra
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_compra;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_compra_itens;