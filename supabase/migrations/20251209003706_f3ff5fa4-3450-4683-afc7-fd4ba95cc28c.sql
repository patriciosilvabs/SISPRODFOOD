-- Adicionar campos de peso e volumes no envio e recebimento de romaneios
ALTER TABLE public.romaneios 
  ADD COLUMN IF NOT EXISTS peso_total_envio_g NUMERIC,
  ADD COLUMN IF NOT EXISTS quantidade_volumes_envio INTEGER,
  ADD COLUMN IF NOT EXISTS peso_total_recebido_g NUMERIC,
  ADD COLUMN IF NOT EXISTS quantidade_volumes_recebido INTEGER;