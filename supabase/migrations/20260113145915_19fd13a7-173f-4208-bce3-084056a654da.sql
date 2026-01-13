-- Adicionar campos para rastrear solicitações de produção extra
ALTER TABLE contagem_porcionados 
ADD COLUMN IF NOT EXISTS is_incremento BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS motivo_incremento TEXT;

-- Adicionar comentários explicativos
COMMENT ON COLUMN contagem_porcionados.is_incremento IS 'Indica se este registro é uma solicitação de produção extra incremental';
COMMENT ON COLUMN contagem_porcionados.motivo_incremento IS 'Motivo da solicitação de produção extra (Pedido extra, Erro de cálculo, Evento especial, Outro)';