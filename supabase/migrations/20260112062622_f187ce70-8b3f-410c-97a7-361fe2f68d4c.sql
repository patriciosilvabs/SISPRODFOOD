CREATE OR REPLACE FUNCTION public.verificar_e_congelar_cutoffs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    
    -- CORREÇÃO: Verificar apenas se passou do cutoff (sem limite de janela de 5 minutos)
    -- Isso garante que mesmo se o cron rodar atrasado, o cutoff será processado
    IF v_hora_local >= v_cutoff 
       AND NOT v_org.organization_id = ANY(v_orgs_processadas)
    THEN
      -- Verificar se já foi congelado hoje (evita duplicatas)
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
$function$;