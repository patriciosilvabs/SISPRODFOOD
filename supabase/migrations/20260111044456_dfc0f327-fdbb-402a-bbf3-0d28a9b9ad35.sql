-- Tabela de auditoria para registrar todas as tentativas de salvamento
CREATE TABLE public.contagem_porcionados_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contagem_id uuid REFERENCES public.contagem_porcionados(id) ON DELETE SET NULL,
  loja_id uuid NOT NULL REFERENCES public.lojas(id),
  item_porcionado_id uuid NOT NULL REFERENCES public.itens_porcionados(id),
  dia_operacional date NOT NULL,
  valor_sobra_enviado integer,
  valor_ideal_enviado integer,
  valor_a_produzir integer,
  usuario_id uuid NOT NULL,
  usuario_nome text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  operacao text NOT NULL, -- 'INSERT', 'UPDATE', 'FALHA'
  status text NOT NULL, -- 'SUCESSO', 'ERRO', 'VERIFICADO'
  mensagem_erro text,
  dados_enviados jsonb,
  dados_verificados jsonb,
  tentativas integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Índices para consultas de auditoria
CREATE INDEX idx_contagem_audit_org ON public.contagem_porcionados_audit(organization_id);
CREATE INDEX idx_contagem_audit_loja ON public.contagem_porcionados_audit(loja_id);
CREATE INDEX idx_contagem_audit_data ON public.contagem_porcionados_audit(created_at);
CREATE INDEX idx_contagem_audit_status ON public.contagem_porcionados_audit(status);

-- Habilitar RLS
ALTER TABLE public.contagem_porcionados_audit ENABLE ROW LEVEL SECURITY;

-- Política para visualizar auditorias da própria organização
CREATE POLICY "Users can view audit from their organization"
ON public.contagem_porcionados_audit FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
  )
);

-- Política para inserir auditorias na própria organização
CREATE POLICY "Users can insert audit in their organization"
ON public.contagem_porcionados_audit FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
  )
);