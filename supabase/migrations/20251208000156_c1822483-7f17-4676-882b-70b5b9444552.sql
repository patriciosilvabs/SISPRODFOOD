-- Tabela para tokens de recuperação de senha
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Apenas service_role pode acessar
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Índice para busca rápida por token
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);

-- Índice para limpeza de tokens expirados
CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);