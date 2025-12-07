
-- =============================================
-- REESTRUTURAR RLS PARA SUPERADMIN BYPASS COMPLETO
-- =============================================

-- 1. INSUMOS_LOG (INSERT) - Erro atual
DROP POLICY IF EXISTS "Users can insert insumos log in their organization" ON public.insumos_log;
CREATE POLICY "Users can insert insumos log in their organization" 
ON public.insumos_log 
FOR INSERT 
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 2. CONSUMO_HISTORICO (INSERT)
DROP POLICY IF EXISTS "Users can insert consumo historico in their organization" ON public.consumo_historico;
CREATE POLICY "Users can insert consumo historico in their organization" 
ON public.consumo_historico 
FOR INSERT 
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 3. CONFIGURACOES_SISTEMA (ALL)
DROP POLICY IF EXISTS "Admins can manage configuracoes in their organization" ON public.configuracoes_sistema;
CREATE POLICY "Admins can manage configuracoes in their organization" 
ON public.configuracoes_sistema 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
);

-- 4. ESTOQUE_CPD (ALL)
DROP POLICY IF EXISTS "Users can manage estoque CPD in their organization" ON public.estoque_cpd;
CREATE POLICY "Users can manage estoque CPD in their organization" 
ON public.estoque_cpd 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 5. ESTOQUE_CPD_PRODUTOS (ALL)
DROP POLICY IF EXISTS "Users can manage estoque CPD produtos in their organization" ON public.estoque_cpd_produtos;
CREATE POLICY "Users can manage estoque CPD produtos in their organization" 
ON public.estoque_cpd_produtos 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 6. ESTOQUE_LOJA_ITENS (ALL para Admins)
DROP POLICY IF EXISTS "Admins can manage estoque loja itens in their organization" ON public.estoque_loja_itens;
CREATE POLICY "Admins can manage estoque loja itens in their organization" 
ON public.estoque_loja_itens 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'::app_role))
);

-- 7. INSUMOS (ALL)
DROP POLICY IF EXISTS "Users can manage insumos in their organization" ON public.insumos;
CREATE POLICY "Users can manage insumos in their organization" 
ON public.insumos 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 8. INSUMOS_EXTRAS (ALL)
DROP POLICY IF EXISTS "Users can manage insumos extras in their organization" ON public.insumos_extras;
CREATE POLICY "Users can manage insumos extras in their organization" 
ON public.insumos_extras 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 9. ITENS_PORCIONADOS (ALL)
DROP POLICY IF EXISTS "Users can manage itens porcionados in their organization" ON public.itens_porcionados;
CREATE POLICY "Users can manage itens porcionados in their organization" 
ON public.itens_porcionados 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 10. PRODUCAO_LOTES (ALL)
DROP POLICY IF EXISTS "Users can manage producao lotes in their organization" ON public.producao_lotes;
CREATE POLICY "Users can manage producao lotes in their organization" 
ON public.producao_lotes 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 11. PRODUCAO_REGISTROS (ALL)
DROP POLICY IF EXISTS "Users can manage producao registros in their organization" ON public.producao_registros;
CREATE POLICY "Users can manage producao registros in their organization" 
ON public.producao_registros 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 12. MOVIMENTACOES_CPD_PRODUTOS (INSERT)
DROP POLICY IF EXISTS "Users can insert movimentacoes in their organization" ON public.movimentacoes_cpd_produtos;
CREATE POLICY "Users can insert movimentacoes in their organization" 
ON public.movimentacoes_cpd_produtos 
FOR INSERT 
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 13. PEDIDOS_COMPRA (ALL)
DROP POLICY IF EXISTS "Users can manage pedidos_compra in their organization" ON public.pedidos_compra;
CREATE POLICY "Users can manage pedidos_compra in their organization" 
ON public.pedidos_compra 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 14. PEDIDOS_COMPRA_ITENS (ALL)
DROP POLICY IF EXISTS "Users can manage pedidos_compra_itens in their organization" ON public.pedidos_compra_itens;
CREATE POLICY "Users can manage pedidos_compra_itens in their organization" 
ON public.pedidos_compra_itens 
FOR ALL 
USING (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);
