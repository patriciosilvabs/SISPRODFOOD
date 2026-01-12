-- Tabela para controlar sessões de contagem por loja/dia
CREATE TABLE sessoes_contagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  dia_operacional DATE NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Status da sessão
  status TEXT NOT NULL DEFAULT 'pendente' 
    CHECK (status IN ('pendente', 'em_andamento', 'encerrada')),
  
  -- Controle de início
  iniciado_em TIMESTAMPTZ,
  iniciado_por_id UUID REFERENCES profiles(id),
  iniciado_por_nome TEXT,
  
  -- Controle de encerramento
  encerrado_em TIMESTAMPTZ,
  encerrado_por_id UUID REFERENCES profiles(id),
  encerrado_por_nome TEXT,
  
  -- Flag para indicar se foi após cutoff
  iniciado_apos_cutoff BOOLEAN DEFAULT false,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint de unicidade
  UNIQUE(loja_id, dia_operacional)
);

-- Índices para performance
CREATE INDEX idx_sessoes_contagem_loja_dia ON sessoes_contagem(loja_id, dia_operacional);
CREATE INDEX idx_sessoes_contagem_org ON sessoes_contagem(organization_id);
CREATE INDEX idx_sessoes_contagem_status ON sessoes_contagem(status);

-- Habilitar RLS
ALTER TABLE sessoes_contagem ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Membros podem ver sessões da organização"
ON sessoes_contagem FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Membros podem inserir sessões"
ON sessoes_contagem FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Membros podem atualizar sessões"
ON sessoes_contagem FOR UPDATE
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

-- Adicionar coluna na contagem_porcionados para rastrear preenchimento
ALTER TABLE contagem_porcionados 
ADD COLUMN IF NOT EXISTS preenchido_na_sessao BOOLEAN DEFAULT false;

-- Habilitar realtime para sessões
ALTER PUBLICATION supabase_realtime ADD TABLE sessoes_contagem;

-- Função para verificar cutoff da loja
CREATE OR REPLACE FUNCTION verificar_cutoff_loja(p_loja_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff TIME;
  v_fuso TEXT;
  v_hora_local TIME;
  v_passou BOOLEAN;
BEGIN
  -- Buscar cutoff e fuso horário da loja
  SELECT cutoff_operacional, fuso_horario
  INTO v_cutoff, v_fuso
  FROM lojas WHERE id = p_loja_id;
  
  -- Defaults se não configurado
  v_cutoff := COALESCE(v_cutoff, '03:00:00'::TIME);
  v_fuso := COALESCE(v_fuso, 'America/Sao_Paulo');
  
  -- Hora atual no fuso da loja
  v_hora_local := (NOW() AT TIME ZONE v_fuso)::TIME;
  
  -- Passou do cutoff se hora atual > cutoff (considerando que cutoff é de madrugada)
  -- Exemplo: cutoff 03:00, hora 10:00 -> passou (10 > 3)
  -- Exemplo: cutoff 03:00, hora 02:00 -> não passou (2 < 3)
  v_passou := v_hora_local > v_cutoff;
  
  RETURN jsonb_build_object(
    'passou_cutoff', v_passou,
    'hora_cutoff', v_cutoff::TEXT,
    'hora_local', v_hora_local::TEXT,
    'fuso_horario', v_fuso
  );
END;
$$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sessoes_contagem_updated_at
  BEFORE UPDATE ON sessoes_contagem
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();