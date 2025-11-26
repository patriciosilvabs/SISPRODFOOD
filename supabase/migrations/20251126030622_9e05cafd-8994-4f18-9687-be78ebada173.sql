-- Habilitar realtime para a tabela producao_registros
ALTER TABLE producao_registros REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE producao_registros;