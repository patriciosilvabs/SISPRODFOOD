-- Policy para permitir apenas service_role acessar (Edge Functions)
CREATE POLICY "Service role full access" ON public.password_reset_tokens
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);