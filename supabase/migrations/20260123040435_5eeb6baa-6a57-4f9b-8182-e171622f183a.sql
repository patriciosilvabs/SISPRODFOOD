-- Tabela para cadastrar destinatários de email de resumo de contagem
CREATE TABLE public.destinatarios_email_contagem (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT,
  ativo BOOLEAN DEFAULT true,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE, -- NULL = todas as lojas
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca por organização
CREATE INDEX idx_destinatarios_email_org ON public.destinatarios_email_contagem(organization_id);

-- Habilitar RLS
ALTER TABLE public.destinatarios_email_contagem ENABLE ROW LEVEL SECURITY;

-- Política de leitura: usuários da organização podem ver
CREATE POLICY "Usuarios podem ver destinatarios da sua organizacao" 
  ON public.destinatarios_email_contagem FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Política de inserção: admins podem inserir
CREATE POLICY "Admins podem inserir destinatarios" 
  ON public.destinatarios_email_contagem FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.is_admin = true
  ));

-- Política de update: admins podem atualizar
CREATE POLICY "Admins podem atualizar destinatarios" 
  ON public.destinatarios_email_contagem FOR UPDATE
  USING (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.is_admin = true
  ));

-- Política de delete: admins podem deletar
CREATE POLICY "Admins podem deletar destinatarios" 
  ON public.destinatarios_email_contagem FOR DELETE
  USING (organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.is_admin = true
  ));

-- Trigger para updated_at
CREATE TRIGGER update_destinatarios_email_contagem_updated_at
  BEFORE UPDATE ON public.destinatarios_email_contagem
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();