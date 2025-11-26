-- Criar tabela para estoques ideais por dia da semana
CREATE TABLE public.estoques_ideais_semanais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  item_porcionado_id UUID NOT NULL REFERENCES public.itens_porcionados(id) ON DELETE CASCADE,
  segunda INTEGER NOT NULL DEFAULT 0,
  terca INTEGER NOT NULL DEFAULT 0,
  quarta INTEGER NOT NULL DEFAULT 0,
  quinta INTEGER NOT NULL DEFAULT 0,
  sexta INTEGER NOT NULL DEFAULT 0,
  sabado INTEGER NOT NULL DEFAULT 0,
  domingo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loja_id, item_porcionado_id)
);

-- Habilitar RLS
ALTER TABLE public.estoques_ideais_semanais ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários autenticados podem visualizar estoques ideais"
ON public.estoques_ideais_semanais
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem gerenciar estoques ideais de suas lojas"
ON public.estoques_ideais_semanais
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lojas_acesso 
    WHERE lojas_acesso.user_id = auth.uid() 
    AND lojas_acesso.loja_id = estoques_ideais_semanais.loja_id
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas_acesso 
    WHERE lojas_acesso.user_id = auth.uid() 
    AND lojas_acesso.loja_id = estoques_ideais_semanais.loja_id
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_estoques_ideais_updated_at
BEFORE UPDATE ON public.estoques_ideais_semanais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_estoques_ideais_loja ON public.estoques_ideais_semanais(loja_id);
CREATE INDEX idx_estoques_ideais_item ON public.estoques_ideais_semanais(item_porcionado_id);