-- Remover política atual de Loja para recebimento
DROP POLICY IF EXISTS "Loja users can update romaneios_produtos for receipt" ON public.romaneios_produtos;

-- Criar nova política com WITH CHECK permitindo status='recebido'
CREATE POLICY "Loja users can update romaneios_produtos for receipt"
ON public.romaneios_produtos
FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Loja'::app_role)
  AND status = 'enviado'
  AND EXISTS (
    SELECT 1 FROM lojas_acesso la
    WHERE la.user_id = auth.uid() 
    AND la.loja_id = romaneios_produtos.loja_id
    AND la.organization_id = get_user_organization_id(auth.uid())
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND has_role(auth.uid(), 'Loja'::app_role)
  AND status = 'recebido'
  AND EXISTS (
    SELECT 1 FROM lojas_acesso la
    WHERE la.user_id = auth.uid() 
    AND la.loja_id = romaneios_produtos.loja_id
    AND la.organization_id = get_user_organization_id(auth.uid())
  )
);