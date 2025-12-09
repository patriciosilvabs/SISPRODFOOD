-- Adicionar coluna escala_configuracao na tabela insumos_extras
-- Valores possíveis: 'por_unidade', 'por_traco', 'por_lote'
ALTER TABLE insumos_extras 
ADD COLUMN escala_configuracao text DEFAULT 'por_unidade';

-- Atualizar registros existentes: se item usa traço/lote, marcar como por_traco
UPDATE insumos_extras ie
SET escala_configuracao = 'por_traco'
FROM itens_porcionados ip
WHERE ie.item_porcionado_id = ip.id
AND ip.unidade_medida IN ('traco', 'lote');

-- Adicionar constraint de check para valores válidos
ALTER TABLE insumos_extras
ADD CONSTRAINT check_escala_configuracao 
CHECK (escala_configuracao IN ('por_unidade', 'por_traco', 'por_lote'));