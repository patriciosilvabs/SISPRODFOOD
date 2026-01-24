
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_total_a_produzir INTEGER;
  v_reserva_diaria INTEGER;
  v_demanda_lojas INTEGER;
  v_peso_programado_kg NUMERIC;
  v_unidades_programadas INTEGER;
  v_lotes_masseira INTEGER;
  v_detalhes_lojas JSONB;
  v_existing_registro RECORD;
  v_data_referencia DATE;
  v_margem_percentual NUMERIC;
  v_usuario_sistema UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Buscar a data de referência mais recente das contagens
  SELECT MAX(dia_operacional::date) INTO v_data_referencia
  FROM contagem_porcionados
  WHERE organization_id = NEW.organization_id;

  -- Se não houver contagens, usar a data atual
  IF v_data_referencia IS NULL THEN
    v_data_referencia := CURRENT_DATE;
  END IF;

  -- Buscar dados do item porcionado com nome correto da coluna
  SELECT id, nome, peso_unitario_g, usa_traco_massa, equivalencia_traco, 
         farinha_por_lote_kg, quantidade_por_lote, margem_lote_percentual
  INTO v_item
  FROM itens_porcionados
  WHERE id = NEW.item_porcionado_id AND organization_id = NEW.organization_id;

  IF v_item IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar se já existe um registro de produção para este item e data
  SELECT * INTO v_existing_registro
  FROM producao_registros
  WHERE item_id = NEW.item_porcionado_id
    AND organization_id = NEW.organization_id
    AND data_referencia = v_data_referencia;

  -- Se existe e está em um status protegido, não atualizar
  IF v_existing_registro IS NOT NULL AND 
     v_existing_registro.status IN ('em_preparo', 'em_porcionamento', 'finalizado', 'expedido') THEN
    RETURN NEW;
  END IF;

  -- Calcular total a produzir de todas as lojas para este item e data
  SELECT 
    COALESCE(SUM(a_produzir), 0),
    jsonb_agg(
      jsonb_build_object(
        'loja_id', cp.loja_id,
        'loja_nome', l.nome,
        'final_sobra', cp.final_sobra,
        'ideal_amanha', cp.ideal_amanha,
        'a_produzir', cp.a_produzir
      )
    )
  INTO v_demanda_lojas, v_detalhes_lojas
  FROM contagem_porcionados cp
  JOIN lojas l ON l.id = cp.loja_id
  WHERE cp.item_porcionado_id = NEW.item_porcionado_id
    AND cp.organization_id = NEW.organization_id
    AND cp.dia_operacional::date = v_data_referencia;

  -- Buscar reserva diária para o dia da semana
  SELECT 
    CASE EXTRACT(DOW FROM v_data_referencia)
      WHEN 0 THEN domingo
      WHEN 1 THEN segunda
      WHEN 2 THEN terca
      WHEN 3 THEN quarta
      WHEN 4 THEN quinta
      WHEN 5 THEN sexta
      WHEN 6 THEN sabado
    END
  INTO v_reserva_diaria
  FROM itens_reserva_diaria
  WHERE item_porcionado_id = NEW.item_porcionado_id
    AND organization_id = NEW.organization_id;

  v_reserva_diaria := COALESCE(v_reserva_diaria, 0);
  v_total_a_produzir := v_demanda_lojas + v_reserva_diaria;

  -- Calcular peso programado
  v_peso_programado_kg := (v_total_a_produzir * COALESCE(v_item.peso_unitario_g, 0)) / 1000.0;

  -- Calcular unidades e lotes com margem - usando nome correto da coluna
  v_margem_percentual := COALESCE(v_item.margem_lote_percentual, 0);
  
  IF v_item.usa_traco_massa AND v_item.quantidade_por_lote IS NOT NULL AND v_item.quantidade_por_lote > 0 THEN
    v_lotes_masseira := CEIL((v_total_a_produzir * (1 + v_margem_percentual / 100.0)) / v_item.quantidade_por_lote);
    v_unidades_programadas := v_lotes_masseira * v_item.quantidade_por_lote;
  ELSE
    v_unidades_programadas := CEIL(v_total_a_produzir * (1 + v_margem_percentual / 100.0));
    v_lotes_masseira := NULL;
  END IF;

  -- Criar ou atualizar registro de produção
  IF v_existing_registro IS NULL THEN
    -- Criar novo registro
    INSERT INTO producao_registros (
      item_id, item_nome, organization_id, data_referencia,
      demanda_lojas, reserva_configurada, unidades_programadas,
      peso_programado_kg, lotes_masseira, detalhes_lojas,
      status, usuario_id, usuario_nome
    ) VALUES (
      v_item.id, v_item.nome, NEW.organization_id, v_data_referencia,
      v_demanda_lojas, v_reserva_diaria, v_unidades_programadas,
      v_peso_programado_kg, v_lotes_masseira, v_detalhes_lojas,
      'pendente', v_usuario_sistema, 'Sistema'
    );
  ELSE
    -- Atualizar registro existente (apenas se status permitir)
    UPDATE producao_registros
    SET 
      demanda_lojas = v_demanda_lojas,
      reserva_configurada = v_reserva_diaria,
      unidades_programadas = v_unidades_programadas,
      peso_programado_kg = v_peso_programado_kg,
      lotes_masseira = v_lotes_masseira,
      detalhes_lojas = v_detalhes_lojas
    WHERE id = v_existing_registro.id
      AND status IN ('pendente', 'aguardando', 'a_produzir');
  END IF;

  RETURN NEW;
END;
$$;
