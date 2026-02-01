-- Tabela de configuração de integração Cardápio Web por loja
CREATE TABLE public.integracoes_cardapio_web (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  ambiente text NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox', 'producao')),
  ativo boolean NOT NULL DEFAULT true,
  url_webhook text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, loja_id)
);

-- Tabela de mapeamento: produto do cardápio → itens porcionados
CREATE TABLE public.mapeamento_cardapio_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cardapio_item_id integer NOT NULL,
  cardapio_item_nome text NOT NULL,
  item_porcionado_id uuid NOT NULL REFERENCES public.itens_porcionados(id) ON DELETE CASCADE,
  quantidade_consumida integer NOT NULL DEFAULT 1 CHECK (quantidade_consumida > 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, cardapio_item_id, item_porcionado_id)
);

-- Tabela de log de pedidos recebidos via webhook
CREATE TABLE public.cardapio_web_pedidos_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  order_id integer NOT NULL,
  evento text NOT NULL DEFAULT 'order.created',
  payload jsonb NOT NULL,
  itens_processados jsonb,
  sucesso boolean NOT NULL DEFAULT false,
  erro text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_integracoes_cardapio_web_token ON public.integracoes_cardapio_web(token);
CREATE INDEX idx_integracoes_cardapio_web_org ON public.integracoes_cardapio_web(organization_id);
CREATE INDEX idx_mapeamento_cardapio_org_item ON public.mapeamento_cardapio_itens(organization_id, cardapio_item_id);
CREATE INDEX idx_cardapio_web_log_org ON public.cardapio_web_pedidos_log(organization_id);
CREATE INDEX idx_cardapio_web_log_loja ON public.cardapio_web_pedidos_log(loja_id);
CREATE INDEX idx_cardapio_web_log_created ON public.cardapio_web_pedidos_log(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.integracoes_cardapio_web ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapeamento_cardapio_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cardapio_web_pedidos_log ENABLE ROW LEVEL SECURITY;

-- RLS para integracoes_cardapio_web
CREATE POLICY "Admins can manage integracoes_cardapio_web"
ON public.integracoes_cardapio_web FOR ALL
USING (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
)
WITH CHECK (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
);

CREATE POLICY "Users can view integracoes_cardapio_web from their organization"
ON public.integracoes_cardapio_web FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

-- RLS para mapeamento_cardapio_itens
CREATE POLICY "Admins can manage mapeamento_cardapio_itens"
ON public.mapeamento_cardapio_itens FOR ALL
USING (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
)
WITH CHECK (
  is_super_admin(auth.uid()) OR 
  (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
);

CREATE POLICY "Users can view mapeamento_cardapio_itens from their organization"
ON public.mapeamento_cardapio_itens FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

-- RLS para cardapio_web_pedidos_log (insert sem auth para webhook)
CREATE POLICY "System can insert cardapio_web_pedidos_log"
ON public.cardapio_web_pedidos_log FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view cardapio_web_pedidos_log from their organization"
ON public.cardapio_web_pedidos_log FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_integracoes_cardapio_web_updated_at
BEFORE UPDATE ON public.integracoes_cardapio_web
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();