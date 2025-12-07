-- Corrigir política RLS do insumos_log para usar APENAS funções SECURITY DEFINER
-- Isso evita conflitos de avaliação RLS quando a política tenta consultar user_roles diretamente

DROP POLICY IF EXISTS "Users can insert insumos log in their organization" ON public.insumos_log;

CREATE POLICY "Users can insert insumos log in their organization" 
ON public.insumos_log 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Usar is_super_admin() que é SECURITY DEFINER (bypassa RLS de user_roles)
  is_super_admin(auth.uid())
  OR 
  -- Verificação normal usando has_role() que também é SECURITY DEFINER
  (
    organization_id = get_user_organization_id(auth.uid()) 
    AND (
      has_role(auth.uid(), 'Admin'::app_role) 
      OR has_role(auth.uid(), 'Produção'::app_role)
    )
  )
);