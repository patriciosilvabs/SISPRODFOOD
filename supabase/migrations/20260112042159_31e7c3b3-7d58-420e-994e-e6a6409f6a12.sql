-- Corrigir função calcular_dia_operacional para considerar cutoff corretamente
CREATE OR REPLACE FUNCTION public.calcular_dia_operacional(
  p_loja_id UUID,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fuso_horario TEXT;
  v_cutoff_operacional TIME;
  v_hora_local TIME;
  v_data_local DATE;
BEGIN
  -- Buscar fuso horário e cutoff da loja
  SELECT fuso_horario, cutoff_operacional 
  INTO v_fuso_horario, v_cutoff_operacional
  FROM lojas WHERE id = p_loja_id;
  
  -- Se loja não encontrada, usar defaults
  IF v_fuso_horario IS NULL THEN
    v_fuso_horario := 'America/Sao_Paulo';
  END IF;
  IF v_cutoff_operacional IS NULL THEN
    v_cutoff_operacional := '03:00:00'::TIME;
  END IF;
  
  -- Calcular data e hora no fuso local
  v_data_local := (p_timestamp AT TIME ZONE v_fuso_horario)::DATE;
  v_hora_local := (p_timestamp AT TIME ZONE v_fuso_horario)::TIME;
  
  -- O dia operacional é simplesmente a data local
  -- O cutoff define quando a demanda é "congelada", não quando o dia muda
  RETURN v_data_local;
END;
$$;

-- Para corrigir os dados, precisamos:
-- 1. Identificar registros com dia_operacional errado
-- 2. Deletar registros que seriam duplicatas após correção
-- 3. Atualizar os restantes

-- Deletar registros antigos que já existem no dia correto (evitar duplicatas)
DELETE FROM contagem_porcionados cp1
WHERE cp1.created_at > NOW() - INTERVAL '7 days'
  AND cp1.dia_operacional != (cp1.created_at AT TIME ZONE (
    SELECT fuso_horario FROM lojas WHERE id = cp1.loja_id
  ))::DATE
  AND EXISTS (
    SELECT 1 FROM contagem_porcionados cp2
    WHERE cp2.loja_id = cp1.loja_id
      AND cp2.item_porcionado_id = cp1.item_porcionado_id
      AND cp2.dia_operacional = (cp1.created_at AT TIME ZONE (
        SELECT fuso_horario FROM lojas WHERE id = cp1.loja_id
      ))::DATE
      AND cp2.id != cp1.id
  );

-- Agora atualizar os registros restantes que têm dia errado
UPDATE contagem_porcionados cp
SET dia_operacional = (cp.created_at AT TIME ZONE l.fuso_horario)::DATE
FROM lojas l
WHERE cp.loja_id = l.id
  AND cp.dia_operacional != (cp.created_at AT TIME ZONE l.fuso_horario)::DATE
  AND cp.created_at > NOW() - INTERVAL '7 days';