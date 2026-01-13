-- ========================================
-- REMOÇÃO COMPLETA DO CUTOFF OPERACIONAL
-- ========================================

-- 1. Remover coluna cutoff_operacional da tabela lojas
ALTER TABLE lojas DROP COLUMN IF EXISTS cutoff_operacional;

-- 2. Remover coluna iniciado_apos_cutoff da tabela sessoes_contagem
ALTER TABLE sessoes_contagem DROP COLUMN IF EXISTS iniciado_apos_cutoff;

-- 3. Remover tabela demanda_congelada (usada exclusivamente pelo cutoff)
DROP TABLE IF EXISTS demanda_congelada;

-- 4. Remover funções relacionadas ao cutoff
DROP FUNCTION IF EXISTS verificar_cutoff_loja(UUID);
DROP FUNCTION IF EXISTS verificar_e_congelar_cutoffs();
DROP FUNCTION IF EXISTS congelar_demanda_cutoff(UUID, DATE);
DROP FUNCTION IF EXISTS congelar_demanda_cutoff(DATE, UUID);

-- 5. Simplificar função calcular_dia_operacional (remover referência ao cutoff)
CREATE OR REPLACE FUNCTION calcular_dia_operacional(
  p_loja_id UUID,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fuso_horario TEXT;
BEGIN
  -- Buscar apenas fuso horário da loja (sem cutoff)
  SELECT fuso_horario 
  INTO v_fuso_horario
  FROM lojas WHERE id = p_loja_id;
  
  -- Se loja não encontrada, usar default
  IF v_fuso_horario IS NULL THEN
    v_fuso_horario := 'America/Sao_Paulo';
  END IF;
  
  -- Retornar a data no fuso local
  RETURN (p_timestamp AT TIME ZONE v_fuso_horario)::DATE;
END;
$$;