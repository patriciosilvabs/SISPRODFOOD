-- Adicionar 'lote_masseira' ao enum unidade_medida
ALTER TYPE public.unidade_medida ADD VALUE IF NOT EXISTS 'lote_masseira';