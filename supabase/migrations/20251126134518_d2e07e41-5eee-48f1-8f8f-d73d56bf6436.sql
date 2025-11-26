-- Criar tabela para estoque de produtos nas lojas
CREATE TABLE IF NOT EXISTS public.estoque_loja_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  data_ultima_atualizacao TIMESTAMPTZ DEFAULT now(),
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(loja_id, produto_id)
);

-- Criar índices para melhor performance
CREATE INDEX idx_estoque_loja_produtos_loja_id ON public.estoque_loja_produtos(loja_id);
CREATE INDEX idx_estoque_loja_produtos_produto_id ON public.estoque_loja_produtos(produto_id);

-- Habilitar RLS
ALTER TABLE public.estoque_loja_produtos ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários autenticados podem visualizar
CREATE POLICY "Usuários autenticados podem visualizar estoque de produtos"
ON public.estoque_loja_produtos
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Policy: Usuários com acesso à loja ou Admins podem gerenciar
CREATE POLICY "Usuários podem gerenciar estoque de produtos de suas lojas"
ON public.estoque_loja_produtos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lojas_acesso
    WHERE lojas_acesso.user_id = auth.uid()
    AND lojas_acesso.loja_id = estoque_loja_produtos.loja_id
  )
  OR public.has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas_acesso
    WHERE lojas_acesso.user_id = auth.uid()
    AND lojas_acesso.loja_id = estoque_loja_produtos.loja_id
  )
  OR public.has_role(auth.uid(), 'Admin'::app_role)
);