-- Limpar registros duplicados mantendo apenas o primeiro de cada grupo (order_id, organization_id, evento)
-- Em seguida, criar a UNIQUE constraint para evitar futuros duplicados

-- 1. Deletar os registros duplicados, mantendo apenas o mais antigo de cada grupo
DELETE FROM cardapio_web_pedidos_log
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY organization_id, order_id, evento 
             ORDER BY created_at ASC
           ) as rn
    FROM cardapio_web_pedidos_log
  ) sub
  WHERE rn > 1
);

-- 2. Agora criar a constraint UNIQUE
ALTER TABLE cardapio_web_pedidos_log 
ADD CONSTRAINT unique_order_per_org_event UNIQUE (organization_id, order_id, evento);