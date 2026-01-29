-- Corrigir constraint para permitir 'embalagem' como tipo_insumo válido
ALTER TABLE consumo_historico DROP CONSTRAINT IF EXISTS consumo_historico_tipo_insumo_check;
ALTER TABLE consumo_historico ADD CONSTRAINT consumo_historico_tipo_insumo_check 
CHECK (tipo_insumo = ANY (ARRAY['principal', 'extra', 'embalagem']));