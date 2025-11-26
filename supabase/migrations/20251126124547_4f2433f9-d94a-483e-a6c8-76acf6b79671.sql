-- Etapa 1: Renomear coluna produto_id para item_porcionado_id
ALTER TABLE estoque_cpd 
RENAME COLUMN produto_id TO item_porcionado_id;

-- Etapa 2: Popular dados iniciais do estoque CPD baseado em produção finalizada menos itens em romaneios
INSERT INTO estoque_cpd (item_porcionado_id, quantidade, data_ultima_movimentacao)
SELECT 
  pr.item_id,
  COALESCE(SUM(pr.unidades_reais), 0) - COALESCE(
    (SELECT SUM(ri.quantidade) 
     FROM romaneio_itens ri 
     JOIN romaneios r ON ri.romaneio_id = r.id 
     WHERE ri.item_porcionado_id = pr.item_id
     AND r.status IN ('enviado', 'recebido')),
    0
  ) as quantidade_final,
  NOW()
FROM producao_registros pr
WHERE pr.status = 'finalizado'
GROUP BY pr.item_id
HAVING COALESCE(SUM(pr.unidades_reais), 0) - COALESCE(
    (SELECT SUM(ri.quantidade) 
     FROM romaneio_itens ri 
     JOIN romaneios r ON ri.romaneio_id = r.id 
     WHERE ri.item_porcionado_id = pr.item_id
     AND r.status IN ('enviado', 'recebido')),
    0
  ) > 0
ON CONFLICT (item_porcionado_id) DO UPDATE 
SET quantidade = EXCLUDED.quantidade,
    data_ultima_movimentacao = EXCLUDED.data_ultima_movimentacao;

-- Etapa 3: Criar função para decrementar estoque CPD de forma segura
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
  
  -- Se não existir registro, não faz nada (poderia lançar erro se preferir)
  IF NOT FOUND THEN
    RAISE NOTICE 'Item % não encontrado no estoque CPD', p_item_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Etapa 4: Criar função para incrementar estoque CPD ao finalizar produção
CREATE OR REPLACE FUNCTION incrementar_estoque_cpd(
  p_item_id UUID,
  p_quantidade NUMERIC
) RETURNS VOID AS $$
BEGIN
  -- Tentar atualizar registro existente
  UPDATE estoque_cpd
  SET 
    quantidade = quantidade + p_quantidade,
    data_ultima_movimentacao = NOW()
  WHERE item_porcionado_id = p_item_id;
  
  -- Se não existir, criar novo registro
  IF NOT FOUND THEN
    INSERT INTO estoque_cpd (item_porcionado_id, quantidade, data_ultima_movimentacao)
    VALUES (p_item_id, p_quantidade, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;