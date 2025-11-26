-- Criar tabela para estoque mínimo semanal de produtos
CREATE TABLE public.produtos_estoque_minimo_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  segunda INTEGER NOT NULL DEFAULT 0,
  terca INTEGER NOT NULL DEFAULT 0,
  quarta INTEGER NOT NULL DEFAULT 0,
  quinta INTEGER NOT NULL DEFAULT 0,
  sexta INTEGER NOT NULL DEFAULT 0,
  sabado INTEGER NOT NULL DEFAULT 0,
  domingo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(produto_id, loja_id)
);

-- Enable Row Level Security
ALTER TABLE public.produtos_estoque_minimo_semanal ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuários autenticados podem visualizar estoques mínimos"
  ON public.produtos_estoque_minimo_semanal
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem gerenciar estoques mínimos"
  ON public.produtos_estoque_minimo_semanal
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_produtos_estoque_minimo_semanal_updated_at
  BEFORE UPDATE ON public.produtos_estoque_minimo_semanal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();