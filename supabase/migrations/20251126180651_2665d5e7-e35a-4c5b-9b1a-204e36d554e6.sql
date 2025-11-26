-- Criar tabela para histórico de consumo real vs programado
CREATE TABLE IF NOT EXISTS public.consumo_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producao_registro_id UUID REFERENCES producao_registros(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES itens_porcionados(id),
  item_nome TEXT NOT NULL,
  insumo_id UUID NOT NULL REFERENCES insumos(id),
  insumo_nome TEXT NOT NULL,
  tipo_insumo TEXT NOT NULL DEFAULT 'principal' CHECK (tipo_insumo IN ('principal', 'extra')),
  consumo_programado NUMERIC NOT NULL,
  consumo_real NUMERIC NOT NULL,
  variacao NUMERIC GENERATED ALWAYS AS (consumo_real - consumo_programado) STORED,
  variacao_percentual NUMERIC GENERATED ALWAYS AS (
    CASE WHEN consumo_programado > 0 
      THEN ((consumo_real - consumo_programado) / consumo_programado) * 100 
      ELSE 0 
    END
  ) STORED,
  unidade TEXT NOT NULL DEFAULT 'kg',
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  data TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.consumo_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem visualizar histórico de consumo"
ON public.consumo_historico FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Produção pode inserir histórico de consumo"
ON public.consumo_historico FOR INSERT
WITH CHECK (has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Produção'));

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.consumo_historico;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_consumo_historico_item_id ON public.consumo_historico(item_id);
CREATE INDEX IF NOT EXISTS idx_consumo_historico_insumo_id ON public.consumo_historico(insumo_id);
CREATE INDEX IF NOT EXISTS idx_consumo_historico_data ON public.consumo_historico(data DESC);
CREATE INDEX IF NOT EXISTS idx_consumo_historico_producao_registro ON public.consumo_historico(producao_registro_id);