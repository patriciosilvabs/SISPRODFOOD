-- 1. Atualizar função calcular_dia_operacional para remover lógica de cutoff
CREATE OR REPLACE FUNCTION public.calcular_dia_operacional(
  p_loja_id UUID,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fuso_horario TEXT;
BEGIN
  -- Buscar fuso horário da loja
  SELECT fuso_horario INTO v_fuso_horario
  FROM lojas WHERE id = p_loja_id;
  
  -- Se loja não encontrada, usar default
  IF v_fuso_horario IS NULL THEN
    v_fuso_horario := 'America/Sao_Paulo';
  END IF;
  
  -- Retornar data atual no fuso horário da loja (SEM lógica de cutoff)
  RETURN (p_timestamp AT TIME ZONE v_fuso_horario)::DATE;
END;
$$;

-- 2. Habilitar realtime para contagem_porcionados
ALTER PUBLICATION supabase_realtime ADD TABLE public.contagem_porcionados;