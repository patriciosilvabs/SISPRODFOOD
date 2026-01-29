-- Atualizar função criar_ou_atualizar_producao_registro para usar contagem_porcionados do CPD
-- em vez da tabela estoque_cpd desatualizada

CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
  p_item_id uuid,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_organization_id uuid
)
RETURNS TABLE(
  registro_id uuid,
  acao text,
  detalhes jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_nome text;
  v_demanda_total_lojas integer := 0;
  v_demanda_incrementos integer := 0;
  v_reserva_dia integer := 0;
  v_estoque_cpd integer := 0;
  v_saldo_liquido integer;
  v_gatilho_minimo integer;
  v_quantidade_por_lote integer;
  v_total_tracos integer;
  v_unidades_por_traco integer;
  v_peso_unitario_g numeric;
  v_peso_programado_kg numeric;
  v_data_hoje date;
  v_data_referencia date;
  v_registro_existente uuid;
  v_novo_registro_id uuid;
  v_lote_producao_id uuid;
  v_sequencia integer;
  v_detalhes_lojas jsonb := '[]'::jsonb;
  v_cpd_loja_id uuid;
  r_loja record;
  r_traco record;
  v_usa_traco_massa boolean;
  v_equivalencia_traco integer;
BEGIN
  -- Obter data atual do servidor
  SELECT get_current_date() INTO v_data_hoje;
  
  -- Buscar informações do item
  SELECT 
    nome, 
    peso_unitario_g, 
    COALESCE(quantidade_minima_producao, 0),
    COALESCE(quantidade_por_lote, 1),
    COALESCE(usa_traco_massa, false),
    COALESCE(equivalencia_traco, 1)
  INTO 
    v_item_nome, 
    v_peso_unitario_g, 
    v_gatilho_minimo,
    v_quantidade_por_lote,
    v_usa_traco_massa,
    v_equivalencia_traco
  FROM itens_porcionados
  WHERE id = p_item_id;
  
  IF v_item_nome IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'erro'::text, jsonb_build_object('mensagem', 'Item não encontrado');
    RETURN;
  END IF;

  -- Buscar a loja do tipo CPD para esta organização
  SELECT id INTO v_cpd_loja_id
  FROM lojas
  WHERE organization_id = p_organization_id
    AND tipo = 'cpd'
  LIMIT 1;

  -- Buscar data de referência mais recente das contagens (excluindo CPD)
  SELECT MAX(dia_operacional)
  INTO v_data_referencia
  FROM contagem_porcionados cp
  JOIN lojas l ON l.id = cp.loja_id
  WHERE cp.item_porcionado_id = p_item_id
    AND cp.organization_id = p_organization_id
    AND l.tipo != 'cpd';
  
  -- Se não há contagens, usar data de hoje
  IF v_data_referencia IS NULL THEN
    v_data_referencia := v_data_hoje;
  END IF;

  -- Calcular demanda total das lojas (excluindo CPD)
  FOR r_loja IN
    SELECT 
      cp.loja_id,
      l.nome as loja_nome,
      COALESCE(cp.a_produzir, 0) as demanda
    FROM contagem_porcionados cp
    JOIN lojas l ON l.id = cp.loja_id
    WHERE cp.item_porcionado_id = p_item_id
      AND cp.organization_id = p_organization_id
      AND cp.dia_operacional = v_data_referencia
      AND l.tipo != 'cpd'
  LOOP
    v_demanda_total_lojas := v_demanda_total_lojas + r_loja.demanda;
    
    IF r_loja.demanda > 0 THEN
      v_detalhes_lojas := v_detalhes_lojas || jsonb_build_object(
        'loja_id', r_loja.loja_id,
        'loja_nome', r_loja.loja_nome,
        'demanda', r_loja.demanda
      );
    END IF;
  END LOOP;

  -- Somar incrementos de produção pendentes
  SELECT COALESCE(SUM(quantidade), 0)::integer
  INTO v_demanda_incrementos
  FROM incrementos_producao
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND status = 'pendente';

  -- Buscar reserva diária configurada
  SELECT CASE EXTRACT(DOW FROM v_data_hoje)
    WHEN 0 THEN domingo
    WHEN 1 THEN segunda
    WHEN 2 THEN terca
    WHEN 3 THEN quarta
    WHEN 4 THEN quinta
    WHEN 5 THEN sexta
    WHEN 6 THEN sabado
  END INTO v_reserva_dia
  FROM itens_reserva_diaria
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id;
  
  v_reserva_dia := COALESCE(v_reserva_dia, 0);

  -- CORREÇÃO: Buscar estoque do CPD da contagem_porcionados (fonte real)
  -- em vez da tabela estoque_cpd (desatualizada)
  IF v_cpd_loja_id IS NOT NULL THEN
    SELECT COALESCE(cp.final_sobra, 0)::integer
    INTO v_estoque_cpd
    FROM contagem_porcionados cp
    WHERE cp.item_porcionado_id = p_item_id
      AND cp.organization_id = p_organization_id
      AND cp.loja_id = v_cpd_loja_id
      AND cp.dia_operacional = v_data_hoje;
    
    -- Se não houver contagem do CPD para hoje, assumir estoque 0
    v_estoque_cpd := COALESCE(v_estoque_cpd, 0);
  ELSE
    v_estoque_cpd := 0;
  END IF;

  -- Calcular saldo líquido
  v_saldo_liquido := (v_demanda_total_lojas + v_demanda_incrementos + v_reserva_dia) - v_estoque_cpd;

  -- Verificar se já existe registro em andamento
  SELECT id INTO v_registro_existente
  FROM producao_registros
  WHERE item_id = p_item_id
    AND organization_id = p_organization_id
    AND status IN ('em_preparo', 'em_porcionamento')
  LIMIT 1;
  
  -- Se há registro em andamento, não modificar
  IF v_registro_existente IS NOT NULL THEN
    RETURN QUERY SELECT 
      v_registro_existente, 
      'bloqueado'::text, 
      jsonb_build_object(
        'mensagem', 'Registro em andamento, não modificado',
        'status_atual', 'em_preparo ou em_porcionamento'
      );
    RETURN;
  END IF;

  -- Deletar registros pendentes existentes para este item
  DELETE FROM producao_registros
  WHERE item_id = p_item_id
    AND organization_id = p_organization_id
    AND status IN ('a_produzir', 'aguardando', 'pendente');

  -- Se saldo líquido <= 0, não criar card
  IF v_saldo_liquido <= 0 THEN
    -- Deletar do backlog também se existir
    DELETE FROM backlog_producao
    WHERE item_id = p_item_id
      AND organization_id = p_organization_id;
    
    RETURN QUERY SELECT 
      NULL::uuid, 
      'sem_demanda'::text, 
      jsonb_build_object(
        'mensagem', 'Estoque CPD suficiente para atender demanda',
        'demanda_lojas', v_demanda_total_lojas,
        'incrementos', v_demanda_incrementos,
        'reserva', v_reserva_dia,
        'estoque_cpd', v_estoque_cpd,
        'saldo_liquido', v_saldo_liquido
      );
    RETURN;
  END IF;

  -- Verificar gatilho mínimo
  IF v_gatilho_minimo > 0 AND v_saldo_liquido < v_gatilho_minimo THEN
    -- Inserir/atualizar no backlog
    INSERT INTO backlog_producao (
      item_id, 
      item_nome, 
      organization_id, 
      quantidade_pendente,
      estoque_cpd,
      gatilho_minimo,
      saldo_liquido,
      data_referencia,
      status
    ) VALUES (
      p_item_id,
      v_item_nome,
      p_organization_id,
      v_saldo_liquido,
      v_estoque_cpd,
      v_gatilho_minimo,
      v_saldo_liquido,
      v_data_referencia,
      'aguardando_gatilho'
    )
    ON CONFLICT (item_id, organization_id, data_referencia) 
    DO UPDATE SET
      quantidade_pendente = EXCLUDED.quantidade_pendente,
      estoque_cpd = EXCLUDED.estoque_cpd,
      saldo_liquido = EXCLUDED.saldo_liquido,
      updated_at = now();
    
    RETURN QUERY SELECT 
      NULL::uuid, 
      'backlog'::text, 
      jsonb_build_object(
        'mensagem', 'Aguardando gatilho mínimo',
        'saldo_liquido', v_saldo_liquido,
        'gatilho_minimo', v_gatilho_minimo
      );
    RETURN;
  END IF;

  -- Remover do backlog se existir (vai criar card)
  DELETE FROM backlog_producao
  WHERE item_id = p_item_id
    AND organization_id = p_organization_id;

  -- Calcular número de traços/lotes
  IF v_usa_traco_massa AND v_equivalencia_traco > 0 THEN
    v_total_tracos := CEIL(v_saldo_liquido::numeric / v_equivalencia_traco::numeric)::integer;
    v_unidades_por_traco := v_equivalencia_traco;
  ELSIF v_quantidade_por_lote > 0 THEN
    v_total_tracos := CEIL(v_saldo_liquido::numeric / v_quantidade_por_lote::numeric)::integer;
    v_unidades_por_traco := v_quantidade_por_lote;
  ELSE
    v_total_tracos := 1;
    v_unidades_por_traco := v_saldo_liquido;
  END IF;

  -- Garantir pelo menos 1 traço
  v_total_tracos := GREATEST(v_total_tracos, 1);

  -- Gerar ID do lote de produção
  v_lote_producao_id := gen_random_uuid();

  -- Criar registros de produção (um por traço)
  FOR v_sequencia IN 1..v_total_tracos LOOP
    -- Calcular unidades para este traço
    IF v_sequencia = v_total_tracos THEN
      -- Último traço: pegar o restante
      v_unidades_por_traco := v_saldo_liquido - (v_unidades_por_traco * (v_total_tracos - 1));
      v_unidades_por_traco := GREATEST(v_unidades_por_traco, 1);
    END IF;

    -- Calcular peso programado
    v_peso_programado_kg := (v_unidades_por_traco * v_peso_unitario_g) / 1000.0;

    INSERT INTO producao_registros (
      item_id,
      item_nome,
      usuario_id,
      usuario_nome,
      organization_id,
      status,
      unidades_programadas,
      peso_programado_kg,
      demanda_lojas,
      reserva_configurada,
      detalhes_lojas,
      data_referencia,
      sequencia_traco,
      total_tracos_lote,
      lote_producao_id,
      bloqueado_por_traco_anterior,
      demanda_base_snapshot,
      is_incremental
    ) VALUES (
      p_item_id,
      v_item_nome,
      p_usuario_id,
      p_usuario_nome,
      p_organization_id,
      'a_produzir',
      v_unidades_por_traco,
      v_peso_programado_kg,
      v_demanda_total_lojas,
      v_reserva_dia,
      v_detalhes_lojas,
      v_data_referencia,
      v_sequencia,
      v_total_tracos,
      v_lote_producao_id,
      v_sequencia > 1,
      v_saldo_liquido,
      false
    )
    RETURNING id INTO v_novo_registro_id;
  END LOOP;

  -- Atualizar status dos incrementos para em_producao
  UPDATE incrementos_producao
  SET status = 'em_producao'
  WHERE item_porcionado_id = p_item_id
    AND organization_id = p_organization_id
    AND status = 'pendente';

  RETURN QUERY SELECT 
    v_novo_registro_id, 
    'criado'::text, 
    jsonb_build_object(
      'mensagem', 'Card(s) de produção criado(s)',
      'total_tracos', v_total_tracos,
      'demanda_lojas', v_demanda_total_lojas,
      'incrementos', v_demanda_incrementos,
      'reserva', v_reserva_dia,
      'estoque_cpd', v_estoque_cpd,
      'saldo_liquido', v_saldo_liquido,
      'lote_producao_id', v_lote_producao_id
    );
END;
$$;