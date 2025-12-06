-- Tabela principal de romaneios de produtos
CREATE TABLE public.romaneios_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  loja_nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'recebido')),
  data_criacao TIMESTAMPTZ DEFAULT now(),
  data_envio TIMESTAMPTZ,
  data_recebimento TIMESTAMPTZ,
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  recebido_por_id UUID,
  recebido_por_nome TEXT,
  observacao TEXT,
  observacao_recebimento TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de itens do romaneio de produtos
CREATE TABLE public.romaneios_produtos_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  romaneio_id UUID NOT NULL REFERENCES public.romaneios_produtos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  produto_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  unidade TEXT,
  quantidade_recebida INTEGER,
  divergencia BOOLEAN DEFAULT false,
  observacao_divergencia TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.romaneios_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.romaneios_produtos_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for romaneios_produtos
CREATE POLICY "Users can view romaneios_produtos from their organization"
ON public.romaneios_produtos
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage romaneios_produtos"
ON public.romaneios_produtos
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
);

CREATE POLICY "Loja users can update romaneios_produtos for receipt"
ON public.romaneios_produtos
FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Loja')
  AND status = 'enviado'
  AND EXISTS (
    SELECT 1 FROM lojas_acesso la
    WHERE la.user_id = auth.uid() 
    AND la.loja_id = romaneios_produtos.loja_id
    AND la.organization_id = get_user_organization_id(auth.uid())
  )
);

-- RLS Policies for romaneios_produtos_itens
CREATE POLICY "Users can view romaneios_produtos_itens from their organization"
ON public.romaneios_produtos_itens
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage romaneios_produtos_itens"
ON public.romaneios_produtos_itens
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'))
);

CREATE POLICY "Loja users can update romaneios_produtos_itens for receipt"
ON public.romaneios_produtos_itens
FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Loja')
  AND EXISTS (
    SELECT 1 FROM romaneios_produtos rp
    WHERE rp.id = romaneios_produtos_itens.romaneio_id
    AND rp.status = 'enviado'
    AND EXISTS (
      SELECT 1 FROM lojas_acesso la
      WHERE la.user_id = auth.uid() 
      AND la.loja_id = rp.loja_id
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.romaneios_produtos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.romaneios_produtos_itens;