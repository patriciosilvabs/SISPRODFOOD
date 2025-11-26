-- Adicionar campos de timer de produção na tabela itens_porcionados
ALTER TABLE itens_porcionados 
ADD COLUMN timer_ativo BOOLEAN DEFAULT false,
ADD COLUMN tempo_timer_minutos INTEGER DEFAULT 10;