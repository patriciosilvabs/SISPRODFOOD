-- Permitir que usuários autenticados verifiquem existência de organizações (para validação de slug único)
CREATE POLICY "Authenticated users can check org existence"
ON public.organizations FOR SELECT
TO authenticated
USING (true);
