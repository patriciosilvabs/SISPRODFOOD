-- Remover política atual
DROP POLICY IF EXISTS "Admins and Produção can manage romaneios_produtos" ON public.romaneios_produtos;

-- Criar nova política incluindo SuperAdmin
CREATE POLICY "Admins Produção and SuperAdmins can manage romaneios_produtos" 
ON public.romaneios_produtos
FOR ALL
USING (
  (organization_id = get_user_organization_id(auth.uid()) 
   AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role)))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (organization_id = get_user_organization_id(auth.uid()) 
   AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role)))
  OR is_super_admin(auth.uid())
);