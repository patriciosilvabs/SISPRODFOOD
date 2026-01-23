-- Corrigir recalcular_producao_dia para trabalhar com retorno UUID
-- A função criar_ou_atualizar_producao_registro retorna UUID, não jsonb

CREATE OR REPLACE FUNCTION public.recalcular_producao_dia(
    p_organization_id uuid,
    p_usuario_id uuid,
    p_usuario_nome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_item RECORD;
    v_itens_processados INTEGER := 0;
    v_cards_criados INTEGER := 0;
    v_resultado_id UUID;
BEGIN
    -- Para cada item ativo da organização
    FOR v_item IN 
        SELECT id, nome FROM itens_porcionados
        WHERE organization_id = p_organization_id AND ativo = true
    LOOP
        -- Capturar como UUID (tipo correto)
        SELECT criar_ou_atualizar_producao_registro(
            v_item.id,
            p_organization_id,
            p_usuario_id,
            p_usuario_nome
        ) INTO v_resultado_id;
        
        v_itens_processados := v_itens_processados + 1;
        
        -- Se retornou um ID, significa que criou ou atualizou
        IF v_resultado_id IS NOT NULL THEN
            v_cards_criados := v_cards_criados + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'itens_processados', v_itens_processados,
        'cards_criados', v_cards_criados
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'itens_processados', v_itens_processados
    );
END;
$function$;