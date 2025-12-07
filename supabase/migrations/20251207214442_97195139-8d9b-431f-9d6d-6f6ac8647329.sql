-- Adicionar política RLS para Produção gerenciar estoque de itens da loja CPD
CREATE POLICY "Producao can manage estoque loja itens CPD"
ON estoque_loja_itens
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Produção'::app_role)
  AND EXISTS (
    SELECT 1 FROM lojas l 
    WHERE l.id = estoque_loja_itens.loja_id 
    AND l.tipo = 'cpd'
    AND l.organization_id = get_user_organization_id(auth.uid())
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Produção'::app_role)
  AND EXISTS (
    SELECT 1 FROM lojas l 
    WHERE l.id = estoque_loja_itens.loja_id 
    AND l.tipo = 'cpd'
    AND l.organization_id = get_user_organization_id(auth.uid())
  )
);