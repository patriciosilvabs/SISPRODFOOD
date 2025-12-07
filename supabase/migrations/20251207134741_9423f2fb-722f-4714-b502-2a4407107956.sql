-- Atualizar políticas RLS para incluir SuperAdmin

-- 1. insumos_log (INSERT)
DROP POLICY IF EXISTS "Admins and Produção can insert insumos log in their organizat" ON insumos_log;

CREATE POLICY "Users can insert insumos log in their organization"
ON insumos_log FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 2. consumo_historico (INSERT)
DROP POLICY IF EXISTS "Produção can insert consumo historico in their organization" ON consumo_historico;

CREATE POLICY "Users can insert consumo historico in their organization"
ON consumo_historico FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 3. configuracoes_sistema (ALL)
DROP POLICY IF EXISTS "Admins can manage configuracoes in their organization" ON configuracoes_sistema;

CREATE POLICY "Admins can manage configuracoes in their organization"
ON configuracoes_sistema FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role)
  )
);

-- 4. estoque_cpd (ALL)
DROP POLICY IF EXISTS "Admins and Produção can manage estoque CPD in their organizat" ON estoque_cpd;

CREATE POLICY "Users can manage estoque CPD in their organization"
ON estoque_cpd FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 5. estoque_cpd_produtos (ALL)
DROP POLICY IF EXISTS "Admins and Produção can manage estoque CPD produtos" ON estoque_cpd_produtos;

CREATE POLICY "Users can manage estoque CPD produtos in their organization"
ON estoque_cpd_produtos FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 6. estoque_loja_itens (ALL para Admins)
DROP POLICY IF EXISTS "Admins can manage estoque loja itens in their organization" ON estoque_loja_itens;

CREATE POLICY "Admins can manage estoque loja itens in their organization"
ON estoque_loja_itens FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role)
  )
);

-- 7. insumos (ALL)
DROP POLICY IF EXISTS "Admins and Produção can manage insumos in their organization" ON insumos;

CREATE POLICY "Users can manage insumos in their organization"
ON insumos FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 8. insumos_extras (ALL)
DROP POLICY IF EXISTS "Admins and Produção can manage insumos extras in their organi" ON insumos_extras;

CREATE POLICY "Users can manage insumos extras in their organization"
ON insumos_extras FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 9. itens_porcionados (ALL)
DROP POLICY IF EXISTS "Admins and Produção can manage itens in their organization" ON itens_porcionados;

CREATE POLICY "Users can manage itens porcionados in their organization"
ON itens_porcionados FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 10. producao_lotes (ALL)
DROP POLICY IF EXISTS "Admins and Produção can manage producao lotes in their organi" ON producao_lotes;

CREATE POLICY "Users can manage producao lotes in their organization"
ON producao_lotes FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 11. producao_registros (ALL)
DROP POLICY IF EXISTS "Admins and Produção can manage producao registros in their or" ON producao_registros;

CREATE POLICY "Users can manage producao registros in their organization"
ON producao_registros FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 12. movimentacoes_cpd_produtos (INSERT)
DROP POLICY IF EXISTS "Admins and Produção can insert movimentacoes" ON movimentacoes_cpd_produtos;

CREATE POLICY "Users can insert movimentacoes in their organization"
ON movimentacoes_cpd_produtos FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 13. pedidos_compra (ALL)
DROP POLICY IF EXISTS "Admins and Produção can manage pedidos_compra" ON pedidos_compra;

CREATE POLICY "Users can manage pedidos_compra in their organization"
ON pedidos_compra FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);

-- 14. pedidos_compra_itens (ALL)
DROP POLICY IF EXISTS "Admins and Produção can manage pedidos_compra_itens" ON pedidos_compra_itens;

CREATE POLICY "Users can manage pedidos_compra_itens in their organization"
ON pedidos_compra_itens FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (
    is_super_admin(auth.uid()) 
    OR has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role)
  )
);