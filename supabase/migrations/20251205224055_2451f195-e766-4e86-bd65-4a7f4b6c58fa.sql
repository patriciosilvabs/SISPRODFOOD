-- Create table for romaneios avulsos (inter-store transfers)
CREATE TABLE public.romaneios_avulsos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_origem_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  loja_origem_nome TEXT NOT NULL,
  loja_destino_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  loja_destino_nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_criacao TIMESTAMPTZ DEFAULT now(),
  data_envio TIMESTAMPTZ,
  data_recebimento TIMESTAMPTZ,
  usuario_criacao_id UUID NOT NULL,
  usuario_criacao_nome TEXT NOT NULL,
  recebido_por_id UUID,
  recebido_por_nome TEXT,
  observacao TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for romaneios avulsos items
CREATE TABLE public.romaneios_avulsos_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  romaneio_avulso_id UUID NOT NULL REFERENCES public.romaneios_avulsos(id) ON DELETE CASCADE,
  item_porcionado_id UUID REFERENCES public.itens_porcionados(id),
  item_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  peso_kg NUMERIC,
  quantidade_recebida INTEGER,
  peso_recebido_kg NUMERIC,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.romaneios_avulsos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.romaneios_avulsos_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for romaneios_avulsos
CREATE POLICY "Users can view romaneios avulsos from their organization"
ON public.romaneios_avulsos
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can manage romaneios avulsos in their organization"
ON public.romaneios_avulsos
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) AND
  (
    has_role(auth.uid(), 'Admin'::app_role) OR
    has_role(auth.uid(), 'Produção'::app_role) OR
    EXISTS (
      SELECT 1 FROM lojas_acesso la
      WHERE la.user_id = auth.uid()
      AND (la.loja_id = romaneios_avulsos.loja_origem_id OR la.loja_id = romaneios_avulsos.loja_destino_id)
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) AND
  (
    has_role(auth.uid(), 'Admin'::app_role) OR
    has_role(auth.uid(), 'Produção'::app_role) OR
    EXISTS (
      SELECT 1 FROM lojas_acesso la
      WHERE la.user_id = auth.uid()
      AND (la.loja_id = romaneios_avulsos.loja_origem_id OR la.loja_id = romaneios_avulsos.loja_destino_id)
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
);

-- RLS Policies for romaneios_avulsos_itens
CREATE POLICY "Users can view romaneios avulsos itens from their organization"
ON public.romaneios_avulsos_itens
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can manage romaneios avulsos itens in their organization"
ON public.romaneios_avulsos_itens
FOR ALL
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()))
WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.romaneios_avulsos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.romaneios_avulsos_itens;