-- Corrigir search_path nas funções para segurança
CREATE OR REPLACE FUNCTION decrementar_estoque_cpd(
  p_item_id UUID,
  p_quantidade NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE estoque_cpd
  SET 
    quantidade = quantidade - p_quantidade,
    data_ultima_movimentacao = NOW()
  WHERE item_porcionado_id = p_item_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Item % não encontrado no estoque CPD', p_item_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION incrementar_estoque_cpd(
  p_item_id UUID,
  p_quantidade NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE estoque_cpd
  SET 
    quantidade = quantidade + p_quantidade,
    data_ultima_movimentacao = NOW()
  WHERE item_porcionado_id = p_item_id;
  
  IF NOT FOUND THEN
    INSERT INTO estoque_cpd (item_porcionado_id, quantidade, data_ultima_movimentacao)
    VALUES (p_item_id, p_quantidade, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;