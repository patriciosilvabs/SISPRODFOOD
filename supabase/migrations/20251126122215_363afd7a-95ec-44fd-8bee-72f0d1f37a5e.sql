-- Criar tabela de romaneios (cabeçalho)
CREATE TABLE IF NOT EXISTS public.romaneios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id),
  loja_nome TEXT NOT NULL,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_envio TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pendente',
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de itens do romaneio
CREATE TABLE IF NOT EXISTS public.romaneio_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  romaneio_id UUID NOT NULL REFERENCES public.romaneios(id) ON DELETE CASCADE,
  item_porcionado_id UUID REFERENCES public.itens_porcionados(id),
  item_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  peso_total_kg NUMERIC,
  producao_registro_id UUID REFERENCES public.producao_registros(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.romaneios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.romaneio_itens ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para romaneios
CREATE POLICY "Usuários autenticados podem visualizar romaneios"
ON public.romaneios
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins e Produção podem gerenciar romaneios"
ON public.romaneios
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Produção'::app_role)
);

-- Políticas RLS para romaneio_itens
CREATE POLICY "Usuários autenticados podem visualizar itens de romaneio"
ON public.romaneio_itens
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins e Produção podem gerenciar itens de romaneio"
ON public.romaneio_itens
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Produção'::app_role)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_romaneios_loja_id ON public.romaneios(loja_id);
CREATE INDEX IF NOT EXISTS idx_romaneios_status ON public.romaneios(status);
CREATE INDEX IF NOT EXISTS idx_romaneio_itens_romaneio_id ON public.romaneio_itens(romaneio_id);
CREATE INDEX IF NOT EXISTS idx_romaneio_itens_item_porcionado_id ON public.romaneio_itens(item_porcionado_id);