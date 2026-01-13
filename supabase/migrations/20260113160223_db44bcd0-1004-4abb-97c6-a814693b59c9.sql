-- Adicionar colunas de janela de contagem na tabela lojas
ALTER TABLE public.lojas 
ADD COLUMN janela_contagem_inicio TIME DEFAULT '22:00:00',
ADD COLUMN janela_contagem_fim TIME DEFAULT '00:00:00';

-- Comentários explicativos
COMMENT ON COLUMN public.lojas.janela_contagem_inicio IS 'Horário de início da janela de contagem (ex: 22:00)';
COMMENT ON COLUMN public.lojas.janela_contagem_fim IS 'Horário de fim da janela de contagem (ex: 00:00 - pode cruzar meia-noite)';