-- =================================================================
-- MIGRAÇÃO: LOTE_MASSEIRA - Sistema Industrial de Produção de Massa
-- =================================================================

-- 1. Adicionar novos campos para LOTE_MASSEIRA na tabela itens_porcionados
ALTER TABLE public.itens_porcionados 
ADD COLUMN IF NOT EXISTS farinha_por_lote_kg NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS massa_gerada_por_lote_kg NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS peso_minimo_bolinha_g NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS peso_maximo_bolinha_g NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS peso_alvo_bolinha_g NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS peso_medio_operacional_bolinha_g NUMERIC DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.itens_porcionados.farinha_por_lote_kg IS 'Quantidade de farinha consumida por lote da masseira (kg)';
COMMENT ON COLUMN public.itens_porcionados.massa_gerada_por_lote_kg IS 'Peso total de massa gerada por lote da masseira (kg)';
COMMENT ON COLUMN public.itens_porcionados.peso_minimo_bolinha_g IS 'Peso mínimo aceitável para cada unidade/bolinha (g)';
COMMENT ON COLUMN public.itens_porcionados.peso_maximo_bolinha_g IS 'Peso máximo aceitável para cada unidade/bolinha (g)';
COMMENT ON COLUMN public.itens_porcionados.peso_alvo_bolinha_g IS 'Peso alvo ideal para cada unidade/bolinha (g)';
COMMENT ON COLUMN public.itens_porcionados.peso_medio_operacional_bolinha_g IS 'Peso médio operacional ajustado por média móvel (g)';

-- 2. Criar tabela de histórico de calibração de massa
CREATE TABLE IF NOT EXISTS public.producao_massa_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.itens_porcionados(id) ON DELETE CASCADE,
  producao_registro_id UUID REFERENCES public.producao_registros(id) ON DELETE SET NULL,
  lotes_produzidos INTEGER NOT NULL,
  quantidade_esperada INTEGER NOT NULL,
  quantidade_real_produzida INTEGER NOT NULL,
  peso_final_g NUMERIC NOT NULL,
  sobra_perda_g NUMERIC DEFAULT 0,
  massa_total_utilizada_g NUMERIC NOT NULL,
  peso_medio_real_bolinha_g NUMERIC NOT NULL,
  status_calibracao TEXT NOT NULL CHECK (status_calibracao IN ('dentro_do_padrao', 'fora_do_padrao_abaixo', 'fora_do_padrao_acima')),
  peso_medio_operacional_anterior_g NUMERIC,
  novo_peso_medio_operacional_g NUMERIC,
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_producao_massa_historico_item_id ON public.producao_massa_historico(item_id);
CREATE INDEX IF NOT EXISTS idx_producao_massa_historico_created_at ON public.producao_massa_historico(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_producao_massa_historico_organization_id ON public.producao_massa_historico(organization_id);

-- 3. Habilitar RLS
ALTER TABLE public.producao_massa_historico ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
CREATE POLICY "Users can view historico in their organization"
ON public.producao_massa_historico
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert historico in their organization"
ON public.producao_massa_historico
FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) OR
  (
    organization_id = get_user_organization_id(auth.uid()) AND
    (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Produção'::app_role))
  )
);

-- 5. Adicionar campos de masseira no producao_registros para rastreamento
ALTER TABLE public.producao_registros
ADD COLUMN IF NOT EXISTS lotes_masseira INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS farinha_consumida_kg NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS massa_total_gerada_kg NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS peso_medio_real_bolinha_g NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS status_calibracao TEXT DEFAULT NULL;