-- Fix incrementar_estoque_cpd to validate organization ownership
CREATE OR REPLACE FUNCTION public.incrementar_estoque_cpd(p_item_id uuid, p_quantidade numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the caller's organization
  v_org_id := get_user_organization_id(auth.uid());
  
  -- Only update if item belongs to caller's organization
  UPDATE estoque_cpd
  SET 
    quantidade = quantidade + p_quantidade,
    data_ultima_movimentacao = NOW()
  WHERE item_porcionado_id = p_item_id
  AND organization_id = v_org_id;
  
  IF NOT FOUND THEN
    -- Only insert if item exists in caller's organization
    INSERT INTO estoque_cpd (item_porcionado_id, quantidade, data_ultima_movimentacao, organization_id)
    SELECT p_item_id, p_quantidade, NOW(), v_org_id
    WHERE EXISTS (
      SELECT 1 FROM itens_porcionados 
      WHERE id = p_item_id AND organization_id = v_org_id
    );
  END IF;
END;
$function$;

-- Fix decrementar_estoque_cpd to validate organization ownership
CREATE OR REPLACE FUNCTION public.decrementar_estoque_cpd(p_item_id uuid, p_quantidade numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the caller's organization
  v_org_id := get_user_organization_id(auth.uid());
  
  -- Only update if item belongs to caller's organization
  UPDATE estoque_cpd
  SET 
    quantidade = quantidade - p_quantidade,
    data_ultima_movimentacao = NOW()
  WHERE item_porcionado_id = p_item_id
  AND organization_id = v_org_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Item % não encontrado no estoque CPD da organização', p_item_id;
  END IF;
END;
$function$;