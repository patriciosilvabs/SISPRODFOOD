-- Remover política atual permissiva
DROP POLICY IF EXISTS "Users can view presets from their organization or system preset" 
ON public.permission_presets;

-- Criar nova política que restringe presets de sistema apenas a Admins
CREATE POLICY "Users can view presets from their organization or system presets restricted" 
ON public.permission_presets
FOR SELECT
USING (
  (organization_id = get_user_organization_id(auth.uid())) OR 
  (organization_id IS NULL AND has_role(auth.uid(), 'Admin'::app_role))
);