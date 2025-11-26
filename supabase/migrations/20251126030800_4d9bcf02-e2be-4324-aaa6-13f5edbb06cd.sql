-- Adicionar política para permitir INSERT de registros de produção por usuários autenticados
CREATE POLICY "Usuários autenticados podem criar registros de produção"
ON producao_registros
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id);

-- Adicionar política para permitir UPDATE de registros próprios
CREATE POLICY "Usuários podem atualizar seus próprios registros"
ON producao_registros
FOR UPDATE
TO authenticated
USING (auth.uid() = usuario_id)
WITH CHECK (auth.uid() = usuario_id);