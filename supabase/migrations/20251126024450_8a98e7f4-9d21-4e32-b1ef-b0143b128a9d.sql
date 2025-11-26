-- Criar tabela para registro de erros e devoluções
CREATE TABLE public.erros_devolucoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id),
  loja_nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  foto_url TEXT,
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.erros_devolucoes ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários autenticados podem visualizar erros e devoluções"
ON public.erros_devolucoes
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem inserir erros e devoluções"
ON public.erros_devolucoes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id);

-- Criar bucket para fotos de erros e devoluções
INSERT INTO storage.buckets (id, name, public)
VALUES ('erros-devolucoes', 'erros-devolucoes', true);

-- Políticas para o bucket
CREATE POLICY "Fotos são publicamente acessíveis"
ON storage.objects
FOR SELECT
USING (bucket_id = 'erros-devolucoes');

CREATE POLICY "Usuários autenticados podem fazer upload de fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'erros-devolucoes' AND auth.uid() IS NOT NULL);

-- Índice para melhor performance
CREATE INDEX idx_erros_devolucoes_loja ON public.erros_devolucoes(loja_id);
CREATE INDEX idx_erros_devolucoes_created ON public.erros_devolucoes(created_at DESC);