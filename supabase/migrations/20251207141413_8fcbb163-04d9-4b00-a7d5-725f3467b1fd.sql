-- 1. Adicionar role 'Produção' ao usuário SuperAdmin como fallback
INSERT INTO user_roles (user_id, role)
SELECT '6dd8946f-0364-4198-a14b-3caaaf325a97'::uuid, 'Produção'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = '6dd8946f-0364-4198-a14b-3caaaf325a97'::uuid 
  AND role = 'Produção'::app_role
);

-- 2. Drop e recriar política RLS do insumos_log com verificação direta
DROP POLICY IF EXISTS "Users can insert insumos log in their organization" ON public.insumos_log;

CREATE POLICY "Users can insert insumos log in their organization" 
ON public.insumos_log 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- SuperAdmin bypass direto na tabela
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'SuperAdmin'::app_role)
  OR 
  -- Verificação normal para Admin/Produção
  (
    organization_id = get_user_organization_id(auth.uid()) 
    AND (
      has_role(auth.uid(), 'Admin'::app_role) 
      OR has_role(auth.uid(), 'Produção'::app_role)
    )
  )
);