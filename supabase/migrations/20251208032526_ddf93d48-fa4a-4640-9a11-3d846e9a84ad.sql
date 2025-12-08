-- Policy para Loja confirmar recebimento de romaneios de porcionados
CREATE POLICY "Loja users can update romaneios for receipt"
ON public.romaneios
FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Loja')
  AND status = 'enviado'
  AND EXISTS (
    SELECT 1 FROM lojas_acesso la
    WHERE la.user_id = auth.uid() 
    AND la.loja_id = romaneios.loja_id
    AND la.organization_id = get_user_organization_id(auth.uid())
  )
);

-- Policy para Loja atualizar itens de romaneio no recebimento
CREATE POLICY "Loja users can update romaneio_itens for receipt"
ON public.romaneio_itens
FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Loja')
  AND EXISTS (
    SELECT 1 FROM romaneios r
    WHERE r.id = romaneio_itens.romaneio_id
    AND r.status = 'enviado'
    AND EXISTS (
      SELECT 1 FROM lojas_acesso la
      WHERE la.user_id = auth.uid() 
      AND la.loja_id = r.loja_id
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
);