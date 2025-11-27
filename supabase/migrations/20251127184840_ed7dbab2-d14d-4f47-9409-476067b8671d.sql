-- FASE 2: Adicionar organization_id a todas as tabelas existentes
-- Esta migration é executada em uma única transação

BEGIN;

-- ============================================================================
-- PASSO 1: Criar organização default para dados existentes
-- ============================================================================

INSERT INTO public.organizations (nome, slug, ativo)
VALUES ('Organização Principal', 'principal', true)
ON CONFLICT DO NOTHING;

-- Armazenar o ID da organização default em uma variável temporária
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'principal' LIMIT 1;

  -- ============================================================================
  -- PASSO 2: Adicionar organization_id a todas as 21 tabelas
  -- ============================================================================

  -- 1. lojas
  ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.lojas ADD CONSTRAINT lojas_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_lojas_organization_id ON public.lojas(organization_id);
  UPDATE public.lojas SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 2. lojas_acesso
  ALTER TABLE public.lojas_acesso ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.lojas_acesso ADD CONSTRAINT lojas_acesso_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_lojas_acesso_organization_id ON public.lojas_acesso(organization_id);
  UPDATE public.lojas_acesso SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 3. insumos
  ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.insumos ADD CONSTRAINT insumos_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_insumos_organization_id ON public.insumos(organization_id);
  UPDATE public.insumos SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 4. insumos_extras
  ALTER TABLE public.insumos_extras ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.insumos_extras ADD CONSTRAINT insumos_extras_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_insumos_extras_organization_id ON public.insumos_extras(organization_id);
  UPDATE public.insumos_extras SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 5. insumos_log
  ALTER TABLE public.insumos_log ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.insumos_log ADD CONSTRAINT insumos_log_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_insumos_log_organization_id ON public.insumos_log(organization_id);
  UPDATE public.insumos_log SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 6. itens_porcionados
  ALTER TABLE public.itens_porcionados ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.itens_porcionados ADD CONSTRAINT itens_porcionados_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_itens_porcionados_organization_id ON public.itens_porcionados(organization_id);
  UPDATE public.itens_porcionados SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 7. itens_reserva_diaria
  ALTER TABLE public.itens_reserva_diaria ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.itens_reserva_diaria ADD CONSTRAINT itens_reserva_diaria_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_itens_reserva_diaria_organization_id ON public.itens_reserva_diaria(organization_id);
  UPDATE public.itens_reserva_diaria SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 8. estoques_ideais_semanais
  ALTER TABLE public.estoques_ideais_semanais ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.estoques_ideais_semanais ADD CONSTRAINT estoques_ideais_semanais_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_estoques_ideais_semanais_organization_id ON public.estoques_ideais_semanais(organization_id);
  UPDATE public.estoques_ideais_semanais SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 9. estoque_cpd
  ALTER TABLE public.estoque_cpd ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.estoque_cpd ADD CONSTRAINT estoque_cpd_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_estoque_cpd_organization_id ON public.estoque_cpd(organization_id);
  UPDATE public.estoque_cpd SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 10. estoque_loja_itens
  ALTER TABLE public.estoque_loja_itens ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.estoque_loja_itens ADD CONSTRAINT estoque_loja_itens_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_estoque_loja_itens_organization_id ON public.estoque_loja_itens(organization_id);
  UPDATE public.estoque_loja_itens SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 11. estoque_loja_produtos
  ALTER TABLE public.estoque_loja_produtos ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.estoque_loja_produtos ADD CONSTRAINT estoque_loja_produtos_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_estoque_loja_produtos_organization_id ON public.estoque_loja_produtos(organization_id);
  UPDATE public.estoque_loja_produtos SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 12. produtos
  ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.produtos ADD CONSTRAINT produtos_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_produtos_organization_id ON public.produtos(organization_id);
  UPDATE public.produtos SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 13. produtos_estoque_minimo_semanal
  ALTER TABLE public.produtos_estoque_minimo_semanal ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.produtos_estoque_minimo_semanal ADD CONSTRAINT produtos_estoque_minimo_semanal_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_produtos_estoque_minimo_semanal_organization_id ON public.produtos_estoque_minimo_semanal(organization_id);
  UPDATE public.produtos_estoque_minimo_semanal SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 14. producao_lotes
  ALTER TABLE public.producao_lotes ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.producao_lotes ADD CONSTRAINT producao_lotes_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_producao_lotes_organization_id ON public.producao_lotes(organization_id);
  UPDATE public.producao_lotes SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 15. producao_registros
  ALTER TABLE public.producao_registros ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.producao_registros ADD CONSTRAINT producao_registros_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_producao_registros_organization_id ON public.producao_registros(organization_id);
  UPDATE public.producao_registros SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 16. romaneios
  ALTER TABLE public.romaneios ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.romaneios ADD CONSTRAINT romaneios_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_romaneios_organization_id ON public.romaneios(organization_id);
  UPDATE public.romaneios SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 17. romaneio_itens
  ALTER TABLE public.romaneio_itens ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.romaneio_itens ADD CONSTRAINT romaneio_itens_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_romaneio_itens_organization_id ON public.romaneio_itens(organization_id);
  UPDATE public.romaneio_itens SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 18. contagem_porcionados
  ALTER TABLE public.contagem_porcionados ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.contagem_porcionados ADD CONSTRAINT contagem_porcionados_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_contagem_porcionados_organization_id ON public.contagem_porcionados(organization_id);
  UPDATE public.contagem_porcionados SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 19. consumo_historico
  ALTER TABLE public.consumo_historico ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.consumo_historico ADD CONSTRAINT consumo_historico_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_consumo_historico_organization_id ON public.consumo_historico(organization_id);
  UPDATE public.consumo_historico SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 20. erros_devolucoes
  ALTER TABLE public.erros_devolucoes ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.erros_devolucoes ADD CONSTRAINT erros_devolucoes_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_erros_devolucoes_organization_id ON public.erros_devolucoes(organization_id);
  UPDATE public.erros_devolucoes SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- 21. configuracoes_sistema
  ALTER TABLE public.configuracoes_sistema ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.configuracoes_sistema ADD CONSTRAINT configuracoes_sistema_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS idx_configuracoes_sistema_organization_id ON public.configuracoes_sistema(organization_id);
  UPDATE public.configuracoes_sistema SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- ============================================================================
  -- PASSO 3: Vincular usuários existentes à organização default
  -- ============================================================================

  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT 
    default_org_id,
    p.id,
    COALESCE(
      (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1),
      'Loja'::app_role
    )
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.user_id = p.id AND om.organization_id = default_org_id
  );

END $$;

-- ============================================================================
-- PASSO 4: Remover políticas RLS antigas e criar novas com filtro por organização
-- ============================================================================

-- LOJAS
DROP POLICY IF EXISTS "Admins can manage lojas" ON public.lojas;
DROP POLICY IF EXISTS "Authenticated users can view lojas" ON public.lojas;

CREATE POLICY "Users can view lojas from their organization"
ON public.lojas FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage lojas in their organization"
ON public.lojas FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
);

-- LOJAS_ACESSO
DROP POLICY IF EXISTS "Admins can manage lojas access" ON public.lojas_acesso;
DROP POLICY IF EXISTS "Users can view their own lojas access" ON public.lojas_acesso;

CREATE POLICY "Users can view lojas access from their organization"
ON public.lojas_acesso FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND user_id = auth.uid()
);

CREATE POLICY "Admins can manage lojas access in their organization"
ON public.lojas_acesso FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
);

-- INSUMOS
DROP POLICY IF EXISTS "Admins and Produção can manage insumos" ON public.insumos;
DROP POLICY IF EXISTS "Authenticated users can view insumos" ON public.insumos;

CREATE POLICY "Users can view insumos from their organization"
ON public.insumos FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage insumos in their organization"
ON public.insumos FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- INSUMOS_EXTRAS
DROP POLICY IF EXISTS "Admins and Produção can manage insumos extras" ON public.insumos_extras;
DROP POLICY IF EXISTS "Authenticated users can view insumos extras" ON public.insumos_extras;

CREATE POLICY "Users can view insumos extras from their organization"
ON public.insumos_extras FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage insumos extras in their organization"
ON public.insumos_extras FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- INSUMOS_LOG
DROP POLICY IF EXISTS "Admins and Produção can insert insumos log" ON public.insumos_log;
DROP POLICY IF EXISTS "Authenticated users can view insumos log" ON public.insumos_log;

CREATE POLICY "Users can view insumos log from their organization"
ON public.insumos_log FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can insert insumos log in their organization"
ON public.insumos_log FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- ITENS_PORCIONADOS
DROP POLICY IF EXISTS "Admins and Produção can manage itens" ON public.itens_porcionados;
DROP POLICY IF EXISTS "Authenticated users can view itens" ON public.itens_porcionados;

CREATE POLICY "Users can view itens from their organization"
ON public.itens_porcionados FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage itens in their organization"
ON public.itens_porcionados FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- ITENS_RESERVA_DIARIA
DROP POLICY IF EXISTS "Admins podem gerenciar reservas diárias" ON public.itens_reserva_diaria;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar reservas diárias" ON public.itens_reserva_diaria;

CREATE POLICY "Users can view reservas from their organization"
ON public.itens_reserva_diaria FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage reservas in their organization"
ON public.itens_reserva_diaria FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
);

-- ESTOQUES_IDEAIS_SEMANAIS
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar estoques ideais" ON public.estoques_ideais_semanais;
DROP POLICY IF EXISTS "Usuários podem gerenciar estoques ideais de suas lojas" ON public.estoques_ideais_semanais;

CREATE POLICY "Users can view estoques ideais from their organization"
ON public.estoques_ideais_semanais FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can manage estoques ideais in their organization"
ON public.estoques_ideais_semanais FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lojas_acesso la
      WHERE la.user_id = auth.uid()
      AND la.loja_id = estoques_ideais_semanais.loja_id
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lojas_acesso la
      WHERE la.user_id = auth.uid()
      AND la.loja_id = estoques_ideais_semanais.loja_id
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
);

-- ESTOQUE_CPD
DROP POLICY IF EXISTS "Admins and Produção can manage estoque CPD" ON public.estoque_cpd;
DROP POLICY IF EXISTS "Authenticated users can view estoque CPD" ON public.estoque_cpd;

CREATE POLICY "Users can view estoque CPD from their organization"
ON public.estoque_cpd FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage estoque CPD in their organization"
ON public.estoque_cpd FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- ESTOQUE_LOJA_ITENS
DROP POLICY IF EXISTS "Admins can manage estoque loja itens" ON public.estoque_loja_itens;
DROP POLICY IF EXISTS "Authenticated users can view estoque loja itens" ON public.estoque_loja_itens;
DROP POLICY IF EXISTS "Loja users can update their own loja estoque" ON public.estoque_loja_itens;

CREATE POLICY "Users can view estoque loja itens from their organization"
ON public.estoque_loja_itens FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage estoque loja itens in their organization"
ON public.estoque_loja_itens FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
);

CREATE POLICY "Loja users can update their loja estoque in their organization"
ON public.estoque_loja_itens FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Loja'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.lojas_acesso la
    WHERE la.user_id = auth.uid()
    AND la.loja_id = estoque_loja_itens.loja_id
    AND la.organization_id = get_user_organization_id(auth.uid())
  )
);

-- ESTOQUE_LOJA_PRODUTOS
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar estoque de produtos" ON public.estoque_loja_produtos;
DROP POLICY IF EXISTS "Usuários podem gerenciar estoque de produtos de suas lojas" ON public.estoque_loja_produtos;

CREATE POLICY "Users can view estoque loja produtos from their organization"
ON public.estoque_loja_produtos FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can manage estoque loja produtos in their organization"
ON public.estoque_loja_produtos FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lojas_acesso la
      WHERE la.user_id = auth.uid()
      AND la.loja_id = estoque_loja_produtos.loja_id
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lojas_acesso la
      WHERE la.user_id = auth.uid()
      AND la.loja_id = estoque_loja_produtos.loja_id
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
);

-- PRODUTOS
DROP POLICY IF EXISTS "Admins can manage produtos" ON public.produtos;
DROP POLICY IF EXISTS "Authenticated users can view produtos" ON public.produtos;

CREATE POLICY "Users can view produtos from their organization"
ON public.produtos FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage produtos in their organization"
ON public.produtos FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
);

-- PRODUTOS_ESTOQUE_MINIMO_SEMANAL
DROP POLICY IF EXISTS "Admins podem gerenciar estoques mínimos" ON public.produtos_estoque_minimo_semanal;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar estoques mínimos" ON public.produtos_estoque_minimo_semanal;

CREATE POLICY "Users can view estoques mínimos from their organization"
ON public.produtos_estoque_minimo_semanal FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage estoques mínimos in their organization"
ON public.produtos_estoque_minimo_semanal FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
);

-- PRODUCAO_LOTES
DROP POLICY IF EXISTS "Authenticated users can view producao" ON public.producao_lotes;
DROP POLICY IF EXISTS "Produção can manage producao" ON public.producao_lotes;

CREATE POLICY "Users can view producao lotes from their organization"
ON public.producao_lotes FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage producao lotes in their organization"
ON public.producao_lotes FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- PRODUCAO_REGISTROS
DROP POLICY IF EXISTS "Authenticated users can view registros" ON public.producao_registros;
DROP POLICY IF EXISTS "Produção can manage registros" ON public.producao_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem criar registros de produção" ON public.producao_registros;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios registros" ON public.producao_registros;

CREATE POLICY "Users can view producao registros from their organization"
ON public.producao_registros FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage producao registros in their organization"
ON public.producao_registros FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- ROMANEIOS
DROP POLICY IF EXISTS "Admins e Produção podem gerenciar romaneios" ON public.romaneios;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar romaneios" ON public.romaneios;

CREATE POLICY "Users can view romaneios from their organization"
ON public.romaneios FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage romaneios in their organization"
ON public.romaneios FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- ROMANEIO_ITENS
DROP POLICY IF EXISTS "Admins e Produção podem gerenciar itens de romaneio" ON public.romaneio_itens;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar itens de romaneio" ON public.romaneio_itens;

CREATE POLICY "Users can view romaneio itens from their organization"
ON public.romaneio_itens FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and Produção can manage romaneio itens in their organization"
ON public.romaneio_itens FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- CONTAGEM_PORCIONADOS
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar contagens" ON public.contagem_porcionados;
DROP POLICY IF EXISTS "Usuários de loja podem gerenciar suas contagens" ON public.contagem_porcionados;

CREATE POLICY "Users can view contagens from their organization"
ON public.contagem_porcionados FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can manage contagens in their organization"
ON public.contagem_porcionados FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lojas_acesso la
      WHERE la.user_id = auth.uid()
      AND la.loja_id = contagem_porcionados.loja_id
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'Admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lojas_acesso la
      WHERE la.user_id = auth.uid()
      AND la.loja_id = contagem_porcionados.loja_id
      AND la.organization_id = get_user_organization_id(auth.uid())
    )
  )
);

-- CONSUMO_HISTORICO
DROP POLICY IF EXISTS "Produção pode inserir histórico de consumo" ON public.consumo_historico;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar histórico de consumo" ON public.consumo_historico;

CREATE POLICY "Users can view consumo historico from their organization"
ON public.consumo_historico FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Produção can insert consumo historico in their organization"
ON public.consumo_historico FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
);

-- ERROS_DEVOLUCOES
DROP POLICY IF EXISTS "Usuários autenticados podem inserir erros e devoluções" ON public.erros_devolucoes;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar erros e devoluções" ON public.erros_devolucoes;

CREATE POLICY "Users can view erros from their organization"
ON public.erros_devolucoes FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert erros in their organization"
ON public.erros_devolucoes FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND auth.uid() = usuario_id
);

-- CONFIGURACOES_SISTEMA
DROP POLICY IF EXISTS "Admins podem gerenciar configurações" ON public.configuracoes_sistema;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar configurações" ON public.configuracoes_sistema;

CREATE POLICY "Users can view configuracoes from their organization"
ON public.configuracoes_sistema FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage configuracoes in their organization"
ON public.configuracoes_sistema FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'Admin'::app_role)
);

COMMIT;