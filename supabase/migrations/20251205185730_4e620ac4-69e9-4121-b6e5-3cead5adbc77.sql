-- ============================================
-- FASE 1: Remover constraints UNIQUE globais problemáticas
-- ============================================

-- Remover constraints baseadas apenas em "nome" usando ALTER TABLE
ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_nome_key;
ALTER TABLE public.itens_porcionados DROP CONSTRAINT IF EXISTS itens_porcionados_nome_key;
ALTER TABLE public.lojas DROP CONSTRAINT IF EXISTS lojas_nome_key;
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_nome_key;

-- Remover constraint de código global
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_codigo_key;

-- Remover constraints sem organization_id
ALTER TABLE public.configuracoes_sistema DROP CONSTRAINT IF EXISTS configuracoes_sistema_chave_key;
ALTER TABLE public.estoque_cpd DROP CONSTRAINT IF EXISTS estoque_cpd_item_porcionado_id_key;
ALTER TABLE public.itens_reserva_diaria DROP CONSTRAINT IF EXISTS itens_reserva_diaria_item_porcionado_id_key;

-- ============================================
-- FASE 2: Criar constraints UNIQUE compostas com organization_id
-- ============================================

-- UNIQUE(organization_id, nome) para cada tabela
CREATE UNIQUE INDEX insumos_org_nome_key 
  ON public.insumos (organization_id, nome);

CREATE UNIQUE INDEX itens_porcionados_org_nome_key 
  ON public.itens_porcionados (organization_id, nome);

CREATE UNIQUE INDEX lojas_org_nome_key 
  ON public.lojas (organization_id, nome);

CREATE UNIQUE INDEX produtos_org_nome_key 
  ON public.produtos (organization_id, nome);

-- UNIQUE(organization_id, codigo) para produtos (WHERE codigo IS NOT NULL para permitir múltiplos NULL)
CREATE UNIQUE INDEX produtos_org_codigo_key 
  ON public.produtos (organization_id, codigo) WHERE codigo IS NOT NULL;

-- UNIQUE(organization_id, chave) para configurações
CREATE UNIQUE INDEX configuracoes_sistema_org_chave_key 
  ON public.configuracoes_sistema (organization_id, chave);

-- UNIQUE(organization_id, item_porcionado_id) para estoques e reservas
CREATE UNIQUE INDEX estoque_cpd_org_item_key 
  ON public.estoque_cpd (organization_id, item_porcionado_id);

CREATE UNIQUE INDEX itens_reserva_diaria_org_item_key 
  ON public.itens_reserva_diaria (organization_id, item_porcionado_id);