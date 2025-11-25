-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE public.app_role AS ENUM ('Admin', 'Produção', 'Loja');
CREATE TYPE public.unidade_medida AS ENUM ('kg', 'unidade', 'g', 'ml', 'l', 'traco');
CREATE TYPE public.tipo_movimento AS ENUM ('entrada', 'saida');
CREATE TYPE public.categoria_produto AS ENUM ('congelado', 'refrigerado', 'ambiente', 'diversos');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create lojas_acesso table for user-store access
CREATE TABLE public.lojas_acesso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  loja_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lojas_acesso ENABLE ROW LEVEL SECURITY;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'Admin')
$$;

-- Create insumos table (raw materials)
CREATE TABLE public.insumos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL UNIQUE,
  quantidade_em_estoque DECIMAL(10, 3) DEFAULT 0,
  unidade_medida unidade_medida NOT NULL DEFAULT 'kg',
  data_ultima_movimentacao TIMESTAMPTZ DEFAULT NOW(),
  perda_percentual DECIMAL(5, 2) DEFAULT 0,
  estoque_minimo DECIMAL(10, 3) DEFAULT 0,
  dias_cobertura_desejado INTEGER DEFAULT 7,
  lead_time_real_dias INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

-- Create insumos_log table
CREATE TABLE public.insumos_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  insumo_id UUID REFERENCES public.insumos(id) ON DELETE CASCADE NOT NULL,
  insumo_nome TEXT NOT NULL,
  quantidade DECIMAL(10, 3) NOT NULL,
  data TIMESTAMPTZ DEFAULT NOW(),
  usuario_id UUID REFERENCES public.profiles(id) NOT NULL,
  usuario_nome TEXT NOT NULL,
  tipo tipo_movimento NOT NULL
);

ALTER TABLE public.insumos_log ENABLE ROW LEVEL SECURITY;

-- Create lojas table (stores)
CREATE TABLE public.lojas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL UNIQUE,
  responsavel TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

-- Create itens_porcionados table (portioned items)
CREATE TABLE public.itens_porcionados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL UNIQUE,
  peso_unitario_g DECIMAL(10, 2) NOT NULL,
  insumo_vinculado_id UUID REFERENCES public.insumos(id) ON DELETE SET NULL,
  unidade_medida unidade_medida NOT NULL DEFAULT 'unidade',
  equivalencia_traco INTEGER,
  baixar_producao_inicio BOOLEAN DEFAULT TRUE,
  perda_percentual_adicional DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.itens_porcionados ENABLE ROW LEVEL SECURITY;

-- Create insumos_extras table
CREATE TABLE public.insumos_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_porcionado_id UUID REFERENCES public.itens_porcionados(id) ON DELETE CASCADE NOT NULL,
  insumo_id UUID REFERENCES public.insumos(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  quantidade DECIMAL(10, 3) NOT NULL,
  unidade unidade_medida NOT NULL
);

ALTER TABLE public.insumos_extras ENABLE ROW LEVEL SECURITY;

-- Create estoque_loja_itens table
CREATE TABLE public.estoque_loja_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE NOT NULL,
  item_porcionado_id UUID REFERENCES public.itens_porcionados(id) ON DELETE CASCADE NOT NULL,
  quantidade DECIMAL(10, 2) DEFAULT 0,
  data_ultima_movimentacao TIMESTAMPTZ DEFAULT NOW(),
  estoque_minimo DECIMAL(10, 2) DEFAULT 0,
  UNIQUE (loja_id, item_porcionado_id)
);

ALTER TABLE public.estoque_loja_itens ENABLE ROW LEVEL SECURITY;

-- Create produtos table
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL UNIQUE,
  categoria categoria_produto NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Create estoque_cpd table (Central Production Depot)
CREATE TABLE public.estoque_cpd (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL UNIQUE,
  quantidade DECIMAL(10, 2) DEFAULT 0,
  data_ultima_movimentacao TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.estoque_cpd ENABLE ROW LEVEL SECURITY;

-- Create producao_lotes table
CREATE TABLE public.producao_lotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES public.itens_porcionados(id) ON DELETE CASCADE NOT NULL,
  item_nome TEXT NOT NULL,
  usuario_id UUID REFERENCES public.profiles(id) NOT NULL,
  usuario_nome TEXT NOT NULL,
  data_inicio TIMESTAMPTZ DEFAULT NOW(),
  data_fim TIMESTAMPTZ,
  status TEXT DEFAULT 'em_andamento',
  peso_total_programado_kg DECIMAL(10, 3),
  unidades_programadas INTEGER
);

ALTER TABLE public.producao_lotes ENABLE ROW LEVEL SECURITY;

-- Create producao_registros table
CREATE TABLE public.producao_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producao_lote_id UUID REFERENCES public.producao_lotes(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.itens_porcionados(id) ON DELETE CASCADE NOT NULL,
  item_nome TEXT NOT NULL,
  usuario_id UUID REFERENCES public.profiles(id) NOT NULL,
  usuario_nome TEXT NOT NULL,
  data_inicio TIMESTAMPTZ DEFAULT NOW(),
  data_fim TIMESTAMPTZ,
  status TEXT DEFAULT 'aguardando_pesagem',
  peso_programado_kg DECIMAL(10, 3),
  unidades_programadas INTEGER,
  unidades_reais INTEGER,
  peso_final_kg DECIMAL(10, 3),
  sobra_kg DECIMAL(10, 3)
);

ALTER TABLE public.producao_registros ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (public.is_admin(auth.uid()));

-- RLS Policies for insumos
CREATE POLICY "Authenticated users can view insumos" ON public.insumos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Produção can manage insumos" ON public.insumos
  FOR ALL USING (
    public.has_role(auth.uid(), 'Admin') OR 
    public.has_role(auth.uid(), 'Produção')
  );

-- RLS Policies for lojas
CREATE POLICY "Authenticated users can view lojas" ON public.lojas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage lojas" ON public.lojas
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for itens_porcionados
CREATE POLICY "Authenticated users can view itens" ON public.itens_porcionados
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Produção can manage itens" ON public.itens_porcionados
  FOR ALL USING (
    public.has_role(auth.uid(), 'Admin') OR 
    public.has_role(auth.uid(), 'Produção')
  );

-- RLS Policies for produtos
CREATE POLICY "Authenticated users can view produtos" ON public.produtos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage produtos" ON public.produtos
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for producao_lotes and producao_registros
CREATE POLICY "Authenticated users can view producao" ON public.producao_lotes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Produção can manage producao" ON public.producao_lotes
  FOR ALL USING (
    public.has_role(auth.uid(), 'Admin') OR 
    public.has_role(auth.uid(), 'Produção')
  );

CREATE POLICY "Authenticated users can view registros" ON public.producao_registros
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Produção can manage registros" ON public.producao_registros
  FOR ALL USING (
    public.has_role(auth.uid(), 'Admin') OR 
    public.has_role(auth.uid(), 'Produção')
  );

-- Trigger function for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_insumos_updated_at
  BEFORE UPDATE ON public.insumos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_itens_updated_at
  BEFORE UPDATE ON public.itens_porcionados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();