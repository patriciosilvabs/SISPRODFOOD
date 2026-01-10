-- Remover política antiga
DROP POLICY IF EXISTS "Users can manage contagens in their organization" ON contagem_porcionados;

-- Criar nova política com suporte a Produção
CREATE POLICY "Users can manage contagens in their organization"
ON contagem_porcionados
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR has_role(auth.uid(), 'Produção'::app_role)
    OR EXISTS (
      SELECT 1 FROM lojas_acesso la
      WHERE la.user_id = auth.uid()
        AND la.loja_id = contagem_porcionados.loja_id
        AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR has_role(auth.uid(), 'Produção'::app_role)
    OR EXISTS (
      SELECT 1 FROM lojas_acesso la
      WHERE la.user_id = auth.uid()
        AND la.loja_id = contagem_porcionados.loja_id
        AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
);