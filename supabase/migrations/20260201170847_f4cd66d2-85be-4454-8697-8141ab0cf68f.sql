-- Adicionar campos para rastreamento das baixas do Cardápio Web
ALTER TABLE public.contagem_porcionados 
ADD COLUMN IF NOT EXISTS cardapio_web_baixa_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cardapio_web_ultima_baixa_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cardapio_web_ultima_baixa_qtd INTEGER;