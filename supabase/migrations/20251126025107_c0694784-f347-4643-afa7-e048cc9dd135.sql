-- Criar tabela para contagem de porcionados
CREATE TABLE public.contagem_porcionados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id),
  item_porcionado_id UUID NOT NULL REFERENCES public.itens_porcionados(id),
  final_sobra INTEGER NOT NULL DEFAULT 0,
  peso_total_g NUMERIC,
  ideal_amanha INTEGER NOT NULL DEFAULT 0,
  a_produzir INTEGER GENERATED ALWAYS AS (GREATEST(0, ideal_amanha - final_sobra)) STORED,
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices
CREATE INDEX idx_contagem_loja ON public.contagem_porcionados(loja_id);
CREATE INDEX idx_contagem_item ON public.contagem_porcionados(item_porcionado_id);
CREATE INDEX idx_contagem_updated ON public.contagem_porcionados(updated_at DESC);

-- Constraint única para evitar duplicatas de item por loja
CREATE UNIQUE INDEX idx_contagem_unique ON public.contagem_porcionados(loja_id, item_porcionado_id);

-- Habilitar RLS
ALTER TABLE public.contagem_porcionados ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários autenticados podem visualizar contagens"
ON public.contagem_porcionados
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários de loja podem gerenciar suas contagens"
ON public.contagem_porcionados
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lojas_acesso 
    WHERE lojas_acesso.user_id = auth.uid() 
    AND lojas_acesso.loja_id = contagem_porcionados.loja_id
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas_acesso 
    WHERE lojas_acesso.user_id = auth.uid() 
    AND lojas_acesso.loja_id = contagem_porcionados.loja_id
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contagem_updated_at
BEFORE UPDATE ON public.contagem_porcionados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();