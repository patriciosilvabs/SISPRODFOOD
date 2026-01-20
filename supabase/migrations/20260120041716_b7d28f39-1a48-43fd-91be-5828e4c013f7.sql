-- Criar tabela para janelas de contagem por dia da semana
CREATE TABLE public.janelas_contagem_por_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid REFERENCES lojas(id) ON DELETE CASCADE NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  janela_inicio time NOT NULL DEFAULT '22:00:00',
  janela_fim time NOT NULL DEFAULT '00:00:00',
  ativo boolean DEFAULT true,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(loja_id, dia_semana)
);

-- Índice para consultas rápidas
CREATE INDEX idx_janelas_loja_dia ON janelas_contagem_por_dia(loja_id, dia_semana);

-- RLS
ALTER TABLE janelas_contagem_por_dia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver janelas da sua organização"
  ON janelas_contagem_por_dia FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Usuários podem gerenciar janelas da sua organização"
  ON janelas_contagem_por_dia FOR ALL
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Migrar configurações existentes para todos os dias da semana
INSERT INTO janelas_contagem_por_dia (loja_id, dia_semana, janela_inicio, janela_fim, organization_id)
SELECT 
  l.id,
  d.dia,
  COALESCE(l.janela_contagem_inicio, '22:00:00'),
  COALESCE(l.janela_contagem_fim, '00:00:00'),
  l.organization_id
FROM lojas l
CROSS JOIN generate_series(0, 6) AS d(dia)
WHERE l.tipo IS DISTINCT FROM 'cpd'
ON CONFLICT (loja_id, dia_semana) DO NOTHING;