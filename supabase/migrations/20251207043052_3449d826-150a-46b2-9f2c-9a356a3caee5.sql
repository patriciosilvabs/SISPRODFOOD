-- Dropar política antiga de SELECT
DROP POLICY IF EXISTS "Users can view romaneios_produtos from their organization" ON romaneios_produtos;

-- Criar nova política com filtro por loja para usuários Loja
CREATE POLICY "Users can view romaneios_produtos from their organization" 
ON romaneios_produtos
FOR SELECT
TO public
USING (
  (organization_id = get_user_organization_id(auth.uid()))
  AND (
    -- Admin/Produção/SuperAdmin veem todos da organização
    has_role(auth.uid(), 'Admin'::app_role) 
    OR has_role(auth.uid(), 'Produção'::app_role) 
    OR is_super_admin(auth.uid())
    -- Usuários Loja só veem romaneios da sua loja vinculada
    OR EXISTS (
      SELECT 1 FROM lojas_acesso la
      WHERE la.user_id = auth.uid() 
        AND la.loja_id = romaneios_produtos.loja_id
        AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
);