-- Política de DELETE para administradores excluírem ocorrências da sua organização
CREATE POLICY "Admins can delete erros from their organization"
ON public.erros_devolucoes
FOR DELETE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
);