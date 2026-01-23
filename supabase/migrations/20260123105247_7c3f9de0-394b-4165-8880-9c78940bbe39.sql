-- Corrigir RPC recalcular_producao_dia: usar coluna 'ativo' ao invés de 'status'
CREATE OR REPLACE FUNCTION public.recalcular_producao_dia(
    p_organization_id uuid,
    p_usuario_id uuid,
    p_usuario_nome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_hoje DATE;
    v_item RECORD;
    v_itens_processados INTEGER := 0;
    v_cards_criados INTEGER := 0;
    v_resultado jsonb;
BEGIN
    -- Buscar dia operacional do CPD
    SELECT calcular_dia_operacional(l.id) INTO v_hoje
    FROM lojas l
    WHERE l.organization_id = p_organization_id AND l.tipo = 'cpd'
    LIMIT 1;
    
    v_hoje := COALESCE(v_hoje, CURRENT_DATE);

    -- Para cada item ativo da organização (CORRIGIDO: ativo = true)
    FOR v_item IN 
        SELECT id, nome FROM itens_porcionados
        WHERE organization_id = p_organization_id AND ativo = true
    LOOP
        SELECT criar_ou_atualizar_producao_registro(
            v_item.id,
            p_organization_id,
            p_usuario_id,
            p_usuario_nome,
            v_hoje,
            false
        ) INTO v_resultado;
        
        v_itens_processados := v_itens_processados + 1;
        
        IF v_resultado IS NOT NULL AND (v_resultado->>'cards_criados') IS NOT NULL THEN
            v_cards_criados := v_cards_criados + COALESCE((v_resultado->>'cards_criados')::int, 0);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'itens_processados', v_itens_processados,
        'cards_criados', v_cards_criados,
        'dia_operacional', v_hoje
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'itens_processados', v_itens_processados
    );
END;
$$;