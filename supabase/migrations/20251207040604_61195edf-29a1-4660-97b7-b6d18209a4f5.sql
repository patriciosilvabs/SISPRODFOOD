-- Add new reposicao_loja permissions to all existing Admin users
INSERT INTO public.user_permissions (user_id, organization_id, permission_key, granted)
SELECT DISTINCT 
  om.user_id,
  om.organization_id,
  perm.permission_key,
  true
FROM public.organization_members om
CROSS JOIN (
  SELECT 'reposicao_loja.view' AS permission_key
  UNION ALL
  SELECT 'reposicao_loja.enviar'
) perm
WHERE om.role = 'Admin'
AND NOT EXISTS (
  SELECT 1 FROM public.user_permissions up 
  WHERE up.user_id = om.user_id 
  AND up.organization_id = om.organization_id 
  AND up.permission_key = perm.permission_key
);