-- 1. Criar nova tabela incrementos_producao
CREATE TABLE public.incrementos_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  item_porcionado_id UUID NOT NULL REFERENCES itens_porcionados(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  dia_operacional DATE NOT NULL,
  
  -- Dados do incremento
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  motivo TEXT NOT NULL,
  observacao TEXT,
  
  -- Auditoria
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status para rastreabilidade
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_producao', 'concluido'))
);

-- Índices para performance
CREATE INDEX idx_incrementos_dia_item ON incrementos_producao(dia_operacional, item_porcionado_id);
CREATE INDEX idx_incrementos_loja ON incrementos_producao(loja_id);
CREATE INDEX idx_incrementos_org ON incrementos_producao(organization_id);
CREATE INDEX idx_incrementos_status ON incrementos_producao(status);

-- RLS
ALTER TABLE incrementos_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver incrementos da sua organização"
ON incrementos_producao FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem criar incrementos na sua organização"
ON incrementos_producao FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem atualizar incrementos da sua organização"
ON incrementos_producao FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

-- 2. Remover colunas de incremento da tabela contagem_porcionados
ALTER TABLE contagem_porcionados 
  DROP COLUMN IF EXISTS is_incremento,
  DROP COLUMN IF EXISTS motivo_incremento;

-- 3. Atualizar a função criar_ou_atualizar_producao_registro para somar ambas as tabelas
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
  p_item_id UUID,
  p_item_nome TEXT,
  p_organization_id UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_quantidade_por_lote INTEGER DEFAULT NULL,
  p_farinha_por_lote_kg NUMERIC DEFAULT NULL,
  p_massa_gerada_por_lote_kg NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje DATE;
  v_demanda_contagem INTEGER;
  v_demanda_incrementos INTEGER;
  v_demanda_lojas INTEGER;
  v_reserva_diaria INTEGER;
  v_estoque_cpd INTEGER;
  v_producao_existente INTEGER;
  v_demanda_total INTEGER;
  v_lotes_necessarios INTEGER;
  v_registro_id UUID;
  v_codigo_lote TEXT;
  v_detalhes_lojas JSON;
  v_detalhes_incrementos JSON;
  v_dia_semana TEXT;
  v_registro_existente RECORD;
BEGIN
  -- Obter a data de hoje
  v_hoje := CURRENT_DATE;
  
  -- Determinar o dia da semana para reserva diária
  v_dia_semana := CASE EXTRACT(DOW FROM v_hoje)
    WHEN 0 THEN 'domingo'
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END;
  
  -- Calcular demanda das contagens normais
  SELECT COALESCE(SUM(GREATEST(0, COALESCE(a_produzir, ideal_amanha - final_sobra, 0))), 0)
  INTO v_demanda_contagem
  FROM contagem_porcionados
  WHERE dia_operacional = v_hoje
    AND item_porcionado_id = p_item_id
    AND organization_id = p_organization_id;
  
  -- Calcular demanda dos incrementos pendentes
  SELECT COALESCE(SUM(quantidade), 0)
  INTO v_demanda_incrementos
  FROM incrementos_producao
  WHERE dia_operacional = v_hoje
    AND item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND status = 'pendente';
  
  -- Somar demandas
  v_demanda_lojas := v_demanda_contagem + v_demanda_incrementos;
  
  -- Obter detalhes por loja (contagens)
  SELECT json_agg(json_build_object(
    'loja_id', cp.loja_id,
    'loja_nome', l.nome,
    'final_sobra', cp.final_sobra,
    'ideal_amanha', cp.ideal_amanha,
    'a_produzir', COALESCE(cp.a_produzir, GREATEST(0, cp.ideal_amanha - cp.final_sobra))
  ))
  INTO v_detalhes_lojas
  FROM contagem_porcionados cp
  JOIN lojas l ON l.id = cp.loja_id
  WHERE cp.dia_operacional = v_hoje
    AND cp.item_porcionado_id = p_item_id
    AND cp.organization_id = p_organization_id;
  
  -- Obter reserva diária
  SELECT COALESCE(
    CASE v_dia_semana
      WHEN 'domingo' THEN domingo
      WHEN 'segunda' THEN segunda
      WHEN 'terca' THEN terca
      WHEN 'quarta' THEN quarta
      WHEN 'quinta' THEN quinta
      WHEN 'sexta' THEN sexta
      WHEN 'sabado' THEN sabado
    END, 0)
  INTO v_reserva_diaria
  FROM itens_reserva_diaria
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id;
  
  IF v_reserva_diaria IS NULL THEN
    v_reserva_diaria := 0;
  END IF;
  
  -- Obter estoque CPD
  SELECT COALESCE(quantidade, 0)
  INTO v_estoque_cpd
  FROM estoque_cpd
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id;
  
  IF v_estoque_cpd IS NULL THEN
    v_estoque_cpd := 0;
  END IF;
  
  -- Calcular produção já existente hoje
  SELECT COALESCE(SUM(quantidade_produzida), 0)
  INTO v_producao_existente
  FROM producao_registros
  WHERE item_id = p_item_id
    AND organization_id = p_organization_id
    AND data_referencia = v_hoje
    AND status NOT IN ('cancelado');
  
  -- Calcular demanda total
  v_demanda_total := GREATEST(0, v_demanda_lojas + v_reserva_diaria - v_estoque_cpd - v_producao_existente);
  
  -- Calcular lotes necessários
  IF p_quantidade_por_lote IS NOT NULL AND p_quantidade_por_lote > 0 THEN
    v_lotes_necessarios := CEIL(v_demanda_total::NUMERIC / p_quantidade_por_lote);
  ELSE
    v_lotes_necessarios := 1;
  END IF;
  
  -- Verificar se já existe registro para hoje
  SELECT * INTO v_registro_existente
  FROM producao_registros
  WHERE item_id = p_item_id
    AND organization_id = p_organization_id
    AND data_referencia = v_hoje
    AND status = 'pendente'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_registro_existente.id IS NOT NULL THEN
    -- Atualizar registro existente
    UPDATE producao_registros
    SET 
      demanda_lojas = v_demanda_lojas,
      reserva_cpd = v_reserva_diaria,
      quantidade_programada = v_demanda_total,
      lotes_masseira = v_lotes_necessarios,
      detalhes_lojas = v_detalhes_lojas,
      updated_at = NOW()
    WHERE id = v_registro_existente.id;
    
    v_registro_id := v_registro_existente.id;
    v_codigo_lote := v_registro_existente.codigo_lote;
  ELSE
    -- Gerar código do lote
    v_codigo_lote := 'LOTE-' || TO_CHAR(v_hoje, 'YYYYMMDD') || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 4);
    
    -- Criar novo registro
    INSERT INTO producao_registros (
      item_id,
      item_nome,
      organization_id,
      data_referencia,
      demanda_lojas,
      reserva_cpd,
      quantidade_programada,
      lotes_masseira,
      codigo_lote,
      status,
      usuario_id,
      usuario_nome,
      detalhes_lojas,
      quantidade_por_lote,
      farinha_por_lote_kg,
      massa_gerada_por_lote_kg
    ) VALUES (
      p_item_id,
      p_item_nome,
      p_organization_id,
      v_hoje,
      v_demanda_lojas,
      v_reserva_diaria,
      v_demanda_total,
      v_lotes_necessarios,
      v_codigo_lote,
      'pendente',
      p_usuario_id,
      p_usuario_nome,
      v_detalhes_lojas,
      p_quantidade_por_lote,
      p_farinha_por_lote_kg,
      p_massa_gerada_por_lote_kg
    )
    RETURNING id INTO v_registro_id;
  END IF;
  
  -- Marcar incrementos como em_producao
  UPDATE incrementos_producao
  SET status = 'em_producao'
  WHERE dia_operacional = v_hoje
    AND item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND status = 'pendente';
  
  RETURN json_build_object(
    'success', true,
    'registro_id', v_registro_id,
    'codigo_lote', v_codigo_lote,
    'demanda_contagem', v_demanda_contagem,
    'demanda_incrementos', v_demanda_incrementos,
    'demanda_lojas', v_demanda_lojas,
    'reserva_diaria', v_reserva_diaria,
    'estoque_cpd', v_estoque_cpd,
    'producao_existente', v_producao_existente,
    'demanda_total', v_demanda_total,
    'lotes_necessarios', v_lotes_necessarios
  );
END;
$$;