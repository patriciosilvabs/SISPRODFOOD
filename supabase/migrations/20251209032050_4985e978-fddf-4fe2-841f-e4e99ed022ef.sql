-- ============================================
-- REGRA-MÃE UNIVERSAL DE MOVIMENTAÇÕES DE ESTOQUE
-- ============================================

-- 1. CRIAR TABELA UNIFICADA DE LOGS (IMUTÁVEL)
CREATE TABLE public.movimentacoes_estoque_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação do item
  entidade_tipo TEXT NOT NULL CHECK (entidade_tipo IN ('insumo', 'produto', 'porcionado')),
  entidade_id UUID NOT NULL,
  entidade_nome TEXT NOT NULL,
  
  -- Tipo de movimentação (padronizado)
  tipo_movimentacao TEXT NOT NULL CHECK (tipo_movimentacao IN (
    'compra', 'producao', 'transferencia_entrada', 'transferencia_saida',
    'ajuste_positivo', 'ajuste_negativo', 'perda', 'cancelamento_preparo',
    'romaneio_envio', 'romaneio_recebimento', 'consumo_producao'
  )),
  
  -- Quantidades obrigatórias
  quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
  estoque_anterior NUMERIC NOT NULL,
  estoque_resultante NUMERIC NOT NULL,
  
  -- Rastreabilidade
  usuario_id UUID NOT NULL,
  usuario_nome TEXT NOT NULL,
  unidade_origem TEXT NOT NULL,
  unidade_destino TEXT,
  
  -- Metadata
  observacao TEXT,
  documento_url TEXT,
  referencia_id UUID, -- ID do romaneio, producao_registro, etc
  referencia_tipo TEXT, -- 'romaneio', 'producao_registro', 'pedido_compra'
  
  -- Timestamps
  data_hora_servidor TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_mov_log_org ON movimentacoes_estoque_log(organization_id);
CREATE INDEX idx_mov_log_entidade ON movimentacoes_estoque_log(entidade_tipo, entidade_id);
CREATE INDEX idx_mov_log_data ON movimentacoes_estoque_log(data_hora_servidor DESC);
CREATE INDEX idx_mov_log_tipo ON movimentacoes_estoque_log(tipo_movimentacao);
CREATE INDEX idx_mov_log_usuario ON movimentacoes_estoque_log(usuario_id);

-- 3. RLS POLICIES (IMUTÁVEL: SEM UPDATE/DELETE)
ALTER TABLE movimentacoes_estoque_log ENABLE ROW LEVEL SECURITY;

-- INSERT: Usuários autenticados da organização podem inserir
CREATE POLICY "Insert log in organization" 
ON movimentacoes_estoque_log 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

-- SELECT: Usuários podem visualizar logs da sua organização
CREATE POLICY "View log in organization" 
ON movimentacoes_estoque_log 
FOR SELECT 
USING (organization_id = get_user_organization_id(auth.uid()));

-- NÃO criar policies de UPDATE/DELETE = LOGS IMUTÁVEIS

-- 4. ADICIONAR CAMPOS FALTANTES EM insumos_log
ALTER TABLE insumos_log ADD COLUMN IF NOT EXISTS estoque_anterior NUMERIC;
ALTER TABLE insumos_log ADD COLUMN IF NOT EXISTS estoque_resultante NUMERIC;
ALTER TABLE insumos_log ADD COLUMN IF NOT EXISTS unidade_origem TEXT DEFAULT 'cpd';

-- 5. FUNÇÃO CENTRALIZADA DE MOVIMENTAÇÃO (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_estoque(
  p_entidade_tipo TEXT,
  p_entidade_id UUID,
  p_entidade_nome TEXT,
  p_tipo_movimentacao TEXT,
  p_quantidade NUMERIC,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_unidade_origem TEXT,
  p_unidade_destino TEXT DEFAULT NULL,
  p_observacao TEXT DEFAULT NULL,
  p_referencia_id UUID DEFAULT NULL,
  p_referencia_tipo TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_estoque_anterior NUMERIC;
  v_estoque_resultante NUMERIC;
  v_org_id UUID;
BEGIN
  -- Usar organization_id do parâmetro ou buscar do usuário
  v_org_id := COALESCE(p_organization_id, get_user_organization_id(p_usuario_id));
  
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization ID não encontrado');
  END IF;

  -- 1. VALIDAÇÕES CRÍTICAS
  IF p_quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
  END IF;
  
  -- Validar observação obrigatória para certos tipos
  IF p_tipo_movimentacao IN ('ajuste_positivo', 'ajuste_negativo', 'perda', 'cancelamento_preparo')
     AND (p_observacao IS NULL OR TRIM(p_observacao) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Observação obrigatória para este tipo de movimentação');
  END IF;
  
  -- 2. BUSCAR ESTOQUE ANTERIOR (conforme tipo de entidade)
  CASE p_entidade_tipo
    WHEN 'insumo' THEN
      SELECT COALESCE(quantidade_em_estoque, 0) INTO v_estoque_anterior
      FROM insumos WHERE id = p_entidade_id AND organization_id = v_org_id;
      
    WHEN 'produto' THEN
      -- Para produtos, verificar se unidade_origem é um UUID válido (loja_id)
      BEGIN
        SELECT COALESCE(quantidade, 0) INTO v_estoque_anterior
        FROM estoque_cpd_produtos 
        WHERE produto_id = p_entidade_id AND organization_id = v_org_id;
      EXCEPTION WHEN OTHERS THEN
        v_estoque_anterior := 0;
      END;
      
    WHEN 'porcionado' THEN
      -- Para porcionados no CPD
      SELECT COALESCE(quantidade, 0) INTO v_estoque_anterior
      FROM estoque_cpd 
      WHERE item_porcionado_id = p_entidade_id AND organization_id = v_org_id;
  END CASE;
  
  v_estoque_anterior := COALESCE(v_estoque_anterior, 0);
  
  -- 3. CALCULAR ESTOQUE RESULTANTE
  IF p_tipo_movimentacao IN ('compra', 'producao', 'transferencia_entrada', 'ajuste_positivo', 'cancelamento_preparo', 'romaneio_recebimento') THEN
    v_estoque_resultante := v_estoque_anterior + p_quantidade;
  ELSE
    v_estoque_resultante := v_estoque_anterior - p_quantidade;
  END IF;
  
  -- 4. VALIDAR ESTOQUE NEGATIVO
  IF v_estoque_resultante < 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Movimentação resultaria em estoque negativo: %s - %s = %s', 
        v_estoque_anterior, p_quantidade, v_estoque_resultante)
    );
  END IF;
  
  -- 5. REGISTRAR LOG IMUTÁVEL (PRIMEIRO - se falhar, não altera estoque)
  INSERT INTO movimentacoes_estoque_log (
    entidade_tipo, entidade_id, entidade_nome,
    tipo_movimentacao, quantidade,
    estoque_anterior, estoque_resultante,
    usuario_id, usuario_nome,
    unidade_origem, unidade_destino,
    observacao, referencia_id, referencia_tipo,
    organization_id
  ) VALUES (
    p_entidade_tipo, p_entidade_id, p_entidade_nome,
    p_tipo_movimentacao, p_quantidade,
    v_estoque_anterior, v_estoque_resultante,
    p_usuario_id, p_usuario_nome,
    p_unidade_origem, p_unidade_destino,
    p_observacao, p_referencia_id, p_referencia_tipo,
    v_org_id
  );
  
  -- 6. ATUALIZAR ESTOQUE (só executa se log foi gravado)
  CASE p_entidade_tipo
    WHEN 'insumo' THEN
      UPDATE insumos 
      SET quantidade_em_estoque = v_estoque_resultante,
          data_ultima_movimentacao = NOW()
      WHERE id = p_entidade_id AND organization_id = v_org_id;
      
    WHEN 'produto' THEN
      -- Upsert em estoque_cpd_produtos
      INSERT INTO estoque_cpd_produtos (produto_id, quantidade, organization_id, data_ultima_movimentacao)
      VALUES (p_entidade_id, v_estoque_resultante, v_org_id, NOW())
      ON CONFLICT (produto_id) 
      DO UPDATE SET quantidade = v_estoque_resultante, data_ultima_movimentacao = NOW();
      
    WHEN 'porcionado' THEN
      -- Upsert em estoque_cpd
      INSERT INTO estoque_cpd (item_porcionado_id, quantidade, organization_id, data_ultima_movimentacao)
      VALUES (p_entidade_id, v_estoque_resultante, v_org_id, NOW())
      ON CONFLICT (item_porcionado_id) 
      DO UPDATE SET quantidade = v_estoque_resultante, data_ultima_movimentacao = NOW();
  END CASE;
  
  RETURN jsonb_build_object(
    'success', true,
    'estoque_anterior', v_estoque_anterior,
    'estoque_resultante', v_estoque_resultante,
    'tipo_movimentacao', p_tipo_movimentacao,
    'quantidade', p_quantidade
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;