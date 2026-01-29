-- Remover a constraint de foreign key que exige usuario_id em profiles
-- Isso permite que o UUID de sistema seja usado sem precisar existir em auth.users
ALTER TABLE producao_registros DROP CONSTRAINT IF EXISTS producao_registros_usuario_id_fkey;

-- Adicionar um comentário para documentar a decisão
COMMENT ON COLUMN producao_registros.usuario_id IS 'ID do usuário que criou o registro. Pode ser 00000000-0000-0000-0000-000000000000 para registros criados automaticamente por triggers do sistema.';