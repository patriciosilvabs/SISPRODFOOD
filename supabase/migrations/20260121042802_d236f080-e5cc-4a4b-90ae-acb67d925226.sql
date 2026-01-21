
-- Atualizar função calcular_dia_operacional para considerar janelas que cruzam meia-noite
CREATE OR REPLACE FUNCTION public.calcular_dia_operacional(p_loja_id uuid, p_timestamp timestamp with time zone DEFAULT now())
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fuso_horario TEXT;
  v_hora_local TIME;
  v_data_local DATE;
  v_dia_semana INTEGER;
  v_janela_inicio TIME;
  v_janela_fim TIME;
  v_janela_ativa BOOLEAN;
BEGIN
  -- Buscar fuso horário da loja
  SELECT fuso_horario 
  INTO v_fuso_horario
  FROM lojas WHERE id = p_loja_id;
  
  -- Se loja não encontrada, usar default
  IF v_fuso_horario IS NULL THEN
    v_fuso_horario := 'America/Sao_Paulo';
  END IF;
  
  -- Calcular data e hora local
  v_data_local := (p_timestamp AT TIME ZONE v_fuso_horario)::DATE;
  v_hora_local := (p_timestamp AT TIME ZONE v_fuso_horario)::TIME;
  
  -- Calcular dia da semana (0 = domingo, 6 = sábado)
  -- EXTRACT(DOW) retorna 0 para domingo
  v_dia_semana := EXTRACT(DOW FROM (p_timestamp AT TIME ZONE v_fuso_horario));
  
  -- Buscar janela do dia atual
  SELECT janela_inicio, janela_fim, ativo
  INTO v_janela_inicio, v_janela_fim, v_janela_ativa
  FROM janelas_contagem_por_dia
  WHERE loja_id = p_loja_id 
    AND dia_semana = v_dia_semana
    AND ativo = true;
  
  -- Se não encontrou janela para hoje, tentar a janela de ontem (que pode ter cruzado meia-noite)
  IF v_janela_inicio IS NULL THEN
    -- Buscar janela do dia anterior
    SELECT janela_inicio, janela_fim, ativo
    INTO v_janela_inicio, v_janela_fim, v_janela_ativa
    FROM janelas_contagem_por_dia
    WHERE loja_id = p_loja_id 
      AND dia_semana = CASE WHEN v_dia_semana = 0 THEN 6 ELSE v_dia_semana - 1 END
      AND ativo = true;
  END IF;
  
  -- Se ainda não tem janela configurada, retornar data local simples
  IF v_janela_inicio IS NULL THEN
    RETURN v_data_local;
  END IF;
  
  -- Verificar se a janela cruza meia-noite (início > fim, ex: 23:30 > 01:00)
  IF v_janela_inicio > v_janela_fim THEN
    -- Janela cruza meia-noite
    -- Se hora atual está entre meia-noite e o fim da janela (ex: 00:12 < 01:00)
    -- Significa que estamos na "continuação" da janela do dia anterior
    -- Portanto, o dia operacional deve ser o dia anterior
    IF v_hora_local < v_janela_fim THEN
      RETURN v_data_local - INTERVAL '1 day';
    END IF;
  END IF;
  
  -- Caso padrão: retornar a data local
  RETURN v_data_local;
END;
$function$;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION public.calcular_dia_operacional IS 'Calcula o dia operacional considerando janelas de contagem que cruzam meia-noite. Se a hora atual estiver entre 00:00 e o fim de uma janela que iniciou no dia anterior (ex: 23:30-01:00), retorna o dia anterior como dia operacional.';
