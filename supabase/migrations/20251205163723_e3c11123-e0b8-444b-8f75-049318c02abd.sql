-- Criar função is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = 'SuperAdmin'
  )
$$;

-- Criar tabela planos_assinatura
CREATE TABLE IF NOT EXISTS public.planos_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  preco_centavos integer NOT NULL DEFAULT 0,
  intervalo text DEFAULT 'mensal' CHECK (intervalo IN ('mensal', 'anual')),
  descricao text,
  recursos jsonb DEFAULT '[]'::jsonb,
  ativo boolean DEFAULT true,
  destaque boolean DEFAULT false,
  max_usuarios integer DEFAULT 5,
  max_lojas integer DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS na tabela planos_assinatura
ALTER TABLE public.planos_assinatura ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para planos_assinatura
CREATE POLICY "Anyone can view active plans"
ON public.planos_assinatura
FOR SELECT
USING (ativo = true);

CREATE POLICY "SuperAdmin can manage all plans"
ON public.planos_assinatura
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- SuperAdmin policies para tabelas existentes
CREATE POLICY "SuperAdmin can manage all organizations"
ON public.organizations
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "SuperAdmin can manage all organization members"
ON public.organization_members
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "SuperAdmin can view all profiles"
ON public.profiles
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "SuperAdmin can manage all user roles"
ON public.user_roles
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "SuperAdmin can manage all subscription history"
ON public.subscription_history
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Inserir planos padrão
INSERT INTO public.planos_assinatura (nome, slug, preco_centavos, intervalo, descricao, recursos, destaque, max_usuarios, max_lojas)
VALUES 
  ('Básico', 'basico', 9900, 'mensal', 'Ideal para pequenos negócios', '["Até 3 lojas", "Até 5 usuários", "Suporte por email"]'::jsonb, false, 5, 3),
  ('Profissional', 'profissional', 19900, 'mensal', 'Para negócios em crescimento', '["Até 10 lojas", "Até 15 usuários", "Suporte prioritário", "Relatórios avançados"]'::jsonb, true, 15, 10),
  ('Enterprise', 'enterprise', 49900, 'mensal', 'Para grandes operações', '["Lojas ilimitadas", "Usuários ilimitados", "Suporte 24/7", "API dedicada", "Customizações"]'::jsonb, false, 999, 999)
ON CONFLICT (slug) DO NOTHING;