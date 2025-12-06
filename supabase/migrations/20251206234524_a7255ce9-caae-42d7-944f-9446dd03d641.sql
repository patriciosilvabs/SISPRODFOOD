-- Adicionar coluna permissions à tabela convites_pendentes
ALTER TABLE public.convites_pendentes
ADD COLUMN permissions text[] DEFAULT '{}'::text[];