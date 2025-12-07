
-- Fase 1: Adicionar coluna tipo na tabela lojas
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'loja' CHECK (tipo IN ('loja', 'cpd'));

-- Fase 2: Criar loja CPD para cada organização existente
INSERT INTO lojas (nome, responsavel, organization_id, tipo)
SELECT 
  'CPD - Centro de Produção e Distribuição',
  'Sistema',
  o.id,
  'cpd'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM lojas l WHERE l.organization_id = o.id AND l.tipo = 'cpd'
);

-- Fase 3: Migrar dados do estoque_cpd para estoque_loja_itens
INSERT INTO estoque_loja_itens (loja_id, item_porcionado_id, quantidade, data_ultima_movimentacao, organization_id)
SELECT 
  (SELECT l.id FROM lojas l WHERE l.organization_id = ec.organization_id AND l.tipo = 'cpd' LIMIT 1),
  ec.item_porcionado_id,
  ec.quantidade,
  ec.data_ultima_movimentacao,
  ec.organization_id
FROM estoque_cpd ec
WHERE ec.organization_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM estoque_loja_itens eli 
  WHERE eli.item_porcionado_id = ec.item_porcionado_id 
  AND eli.loja_id = (SELECT l.id FROM lojas l WHERE l.organization_id = ec.organization_id AND l.tipo = 'cpd' LIMIT 1)
);

-- Fase 4: Migrar dados do estoque_cpd_produtos para estoque_loja_produtos
INSERT INTO estoque_loja_produtos (loja_id, produto_id, quantidade, data_ultima_atualizacao, organization_id)
SELECT 
  (SELECT l.id FROM lojas l WHERE l.organization_id = ecp.organization_id AND l.tipo = 'cpd' LIMIT 1),
  ecp.produto_id,
  ecp.quantidade,
  ecp.data_ultima_movimentacao,
  ecp.organization_id
FROM estoque_cpd_produtos ecp
WHERE ecp.organization_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM estoque_loja_produtos elp 
  WHERE elp.produto_id = ecp.produto_id 
  AND elp.loja_id = (SELECT l.id FROM lojas l WHERE l.organization_id = ecp.organization_id AND l.tipo = 'cpd' LIMIT 1)
);

-- Fase 5: Vincular usuários Produção à loja CPD via lojas_acesso
INSERT INTO lojas_acesso (user_id, loja_id, organization_id)
SELECT DISTINCT
  om.user_id,
  (SELECT l.id FROM lojas l WHERE l.organization_id = om.organization_id AND l.tipo = 'cpd' LIMIT 1),
  om.organization_id
FROM organization_members om
WHERE om.role = 'Produção'
AND NOT EXISTS (
  SELECT 1 FROM lojas_acesso la 
  WHERE la.user_id = om.user_id 
  AND la.loja_id = (SELECT l.id FROM lojas l WHERE l.organization_id = om.organization_id AND l.tipo = 'cpd' LIMIT 1)
);

-- Fase 6: Atualizar funções PostgreSQL para usar tabelas unificadas
CREATE OR REPLACE FUNCTION public.incrementar_estoque_cpd(p_item_id uuid, p_quantidade numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_cpd_loja_id uuid;
BEGIN
  v_org_id := get_user_organization_id(auth.uid());
  
  SELECT id INTO v_cpd_loja_id FROM lojas WHERE organization_id = v_org_id AND tipo = 'cpd' LIMIT 1;
  
  IF v_cpd_loja_id IS NULL THEN
    RAISE EXCEPTION 'Loja CPD não encontrada para a organização';
  END IF;
  
  UPDATE estoque_loja_itens
  SET 
    quantidade = quantidade + p_quantidade,
    data_ultima_movimentacao = NOW()
  WHERE item_porcionado_id = p_item_id
  AND loja_id = v_cpd_loja_id;
  
  IF NOT FOUND THEN
    INSERT INTO estoque_loja_itens (loja_id, item_porcionado_id, quantidade, data_ultima_movimentacao, organization_id)
    SELECT v_cpd_loja_id, p_item_id, p_quantidade, NOW(), v_org_id
    WHERE EXISTS (
      SELECT 1 FROM itens_porcionados WHERE id = p_item_id AND organization_id = v_org_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrementar_estoque_cpd(p_item_id uuid, p_quantidade numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_cpd_loja_id uuid;
BEGIN
  v_org_id := get_user_organization_id(auth.uid());
  
  SELECT id INTO v_cpd_loja_id FROM lojas WHERE organization_id = v_org_id AND tipo = 'cpd' LIMIT 1;
  
  IF v_cpd_loja_id IS NULL THEN
    RAISE EXCEPTION 'Loja CPD não encontrada para a organização';
  END IF;
  
  UPDATE estoque_loja_itens
  SET 
    quantidade = quantidade - p_quantidade,
    data_ultima_movimentacao = NOW()
  WHERE item_porcionado_id = p_item_id
  AND loja_id = v_cpd_loja_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Item % não encontrado no estoque CPD', p_item_id;
  END IF;
END;
$$;

-- Fase 7: Função helper para obter loja CPD da organização
CREATE OR REPLACE FUNCTION public.get_cpd_loja_id(p_organization_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM lojas WHERE organization_id = p_organization_id AND tipo = 'cpd' LIMIT 1;
$$;
