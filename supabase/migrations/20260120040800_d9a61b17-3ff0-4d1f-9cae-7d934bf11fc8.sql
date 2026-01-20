-- Adicionar coluna para configurar horário de limpeza da coluna FINALIZADO
ALTER TABLE lojas 
ADD COLUMN IF NOT EXISTS horario_limpeza_finalizado TIME DEFAULT '00:00:00';

COMMENT ON COLUMN lojas.horario_limpeza_finalizado IS 
  'Horário em que itens finalizados são removidos da coluna FINALIZADO do Kanban';

-- Função para verificar se já passou do horário de limpeza
CREATE OR REPLACE FUNCTION verificar_limpeza_finalizado(
  p_organization_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hora_atual TIME;
  v_horario_limpeza TIME;
  v_fuso_horario TEXT;
BEGIN
  -- Buscar configuração do CPD
  SELECT 
    COALESCE(horario_limpeza_finalizado, '00:00:00'::TIME),
    COALESCE(fuso_horario, 'America/Manaus')
  INTO v_horario_limpeza, v_fuso_horario
  FROM lojas
  WHERE organization_id = p_organization_id
    AND tipo = 'cpd'
  LIMIT 1;
  
  -- Se não encontrou CPD, usar defaults
  IF v_horario_limpeza IS NULL THEN
    v_horario_limpeza := '00:00:00'::TIME;
    v_fuso_horario := 'America/Manaus';
  END IF;
  
  -- Obter hora atual no fuso horário do CPD
  v_hora_atual := (NOW() AT TIME ZONE v_fuso_horario)::TIME;
  
  -- Retorna TRUE se já passou do horário de limpeza
  RETURN v_hora_atual >= v_horario_limpeza;
END;
$$;

-- Atualizar CPD existente com horário padrão razoável (08:30 - início da janela de contagem invertida)
UPDATE lojas 
SET horario_limpeza_finalizado = '08:30:00'
WHERE tipo = 'cpd' AND horario_limpeza_finalizado IS NULL;