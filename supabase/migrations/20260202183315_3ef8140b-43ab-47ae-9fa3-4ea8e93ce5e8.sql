-- Permitir que o sistema (edge functions com service_role) faça UPDATE no log
-- para atualizar status após processamento

CREATE POLICY "System can update cardapio_web_pedidos_log" 
ON cardapio_web_pedidos_log 
FOR UPDATE 
USING (true)
WITH CHECK (true);