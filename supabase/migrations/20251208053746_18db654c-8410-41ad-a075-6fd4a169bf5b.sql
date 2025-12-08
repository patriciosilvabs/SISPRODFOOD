-- Add missing columns to produtos for shopping list calculations
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS dias_cobertura_desejado INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS lead_time_real_dias INTEGER DEFAULT 2;

-- Add comment for documentation
COMMENT ON COLUMN produtos.dias_cobertura_desejado IS 'Dias de cobertura desejado para cálculo de compras';
COMMENT ON COLUMN produtos.lead_time_real_dias IS 'Lead time real do fornecedor em dias';