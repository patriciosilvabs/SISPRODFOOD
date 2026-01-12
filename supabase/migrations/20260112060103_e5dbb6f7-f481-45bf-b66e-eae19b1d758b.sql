-- Tabela para log de execuções do cron job
CREATE TABLE IF NOT EXISTS public.cron_execucao_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  resultado JSONB,
  erro TEXT,
  executado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscas por função e data
CREATE INDEX idx_cron_log_funcao ON cron_execucao_log(funcao, executado_em DESC);

-- RLS para cron_execucao_log (apenas admins podem ver)
ALTER TABLE public.cron_execucao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs de cron"
  ON public.cron_execucao_log
  FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR 
    (organization_id IS NOT NULL AND organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'Admin'))
  );

-- Função para verificar e congelar cutoffs automaticamente
CREATE OR REPLACE FUNCTION public.verificar_e_congelar_cutoffs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org RECORD;
  v_hora_local TIME;
  v_cutoff TIME;
  v_fuso TEXT;
  v_resultado JSONB := '[]'::jsonb;
  v_orgs_processadas UUID[] := '{}';
  v_congelamento_result JSONB;
  v_hoje DATE;
BEGIN
  -- Para cada organização, buscar a loja CPD ou primeira loja com cutoff
  FOR v_org IN 
    SELECT DISTINCT ON (organization_id)
      organization_id, 
      COALESCE(cutoff_operacional, '03:00:00'::TIME) as cutoff_operacional, 
      COALESCE(fuso_horario, 'America/Sao_Paulo') as fuso_horario
    FROM lojas
    WHERE organization_id IS NOT NULL
    ORDER BY organization_id, tipo = 'cpd' DESC, created_at ASC
  LOOP
    -- Calcular hora local da organização
    v_hora_local := (NOW() AT TIME ZONE v_org.fuso_horario)::TIME;
    v_cutoff := v_org.cutoff_operacional;
    v_hoje := (NOW() AT TIME ZONE v_org.fuso_horario)::DATE;
    
    -- Verificar se está no intervalo do cutoff (ex: 03:00-03:05)
    -- E se ainda não foi congelado hoje
    IF v_hora_local >= v_cutoff 
       AND v_hora_local < (v_cutoff + interval '5 minutes')::TIME
       AND NOT v_org.organization_id = ANY(v_orgs_processadas)
    THEN
      -- Verificar se já foi congelado hoje
      IF NOT EXISTS (
        SELECT 1 FROM demanda_congelada 
        WHERE organization_id = v_org.organization_id 
          AND dia_producao = v_hoje
        LIMIT 1
      ) THEN
        -- Congelar demanda para esta organização
        v_congelamento_result := congelar_demanda_cutoff(v_org.organization_id, v_hoje);
        
        v_orgs_processadas := array_append(v_orgs_processadas, v_org.organization_id);
        
        -- Registrar log
        INSERT INTO cron_execucao_log (funcao, organization_id, resultado)
        VALUES ('congelar_demanda_cutoff', v_org.organization_id, v_congelamento_result);
        
        v_resultado := v_resultado || jsonb_build_object(
          'organization_id', v_org.organization_id,
          'cutoff', v_cutoff::TEXT,
          'fuso', v_org.fuso_horario,
          'itens_congelados', v_congelamento_result->'itens_congelados',
          'processado_em', NOW()
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'organizacoes_processadas', jsonb_array_length(v_resultado),
    'detalhes', v_resultado
  );
END;
$$;