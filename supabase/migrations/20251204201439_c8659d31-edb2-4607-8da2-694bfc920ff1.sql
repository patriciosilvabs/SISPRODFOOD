-- Adicionar campo usa_traco_massa na tabela itens_porcionados
ALTER TABLE itens_porcionados 
ADD COLUMN IF NOT EXISTS usa_traco_massa boolean DEFAULT false;

-- Adicionar campos de controle de fila na tabela producao_registros
ALTER TABLE producao_registros 
ADD COLUMN IF NOT EXISTS sequencia_traco integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS lote_producao_id uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bloqueado_por_traco_anterior boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS timer_status text DEFAULT 'aguardando',
ADD COLUMN IF NOT EXISTS data_referencia date DEFAULT CURRENT_DATE;

-- Criar índice para otimizar consultas de bloqueio
CREATE INDEX IF NOT EXISTS idx_producao_registros_lote_seq 
ON producao_registros(lote_producao_id, sequencia_traco);

CREATE INDEX IF NOT EXISTS idx_producao_registros_timer_status 
ON producao_registros(item_id, data_referencia, timer_status);