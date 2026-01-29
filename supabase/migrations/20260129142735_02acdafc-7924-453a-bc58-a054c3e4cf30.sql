-- Otimizar trigger para evitar UPDATE redundante que causa loop infinito
-- A função agora só atualiza contagem_porcionados.ideal_amanha se o valor realmente mudou

CREATE OR REPLACE FUNCTION public.trigger_recalcular_producao_apos_estoque_ideal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_novo_ideal integer;
BEGIN
    -- Calcular o novo valor ideal baseado no dia da semana
    SELECT CASE EXTRACT(DOW FROM CURRENT_DATE)
        WHEN 0 THEN COALESCE(NEW.domingo, 0)
        WHEN 1 THEN COALESCE(NEW.segunda, 0)
        WHEN 2 THEN COALESCE(NEW.terca, 0)
        WHEN 3 THEN COALESCE(NEW.quarta, 0)
        WHEN 4 THEN COALESCE(NEW.quinta, 0)
        WHEN 5 THEN COALESCE(NEW.sexta, 0)
        WHEN 6 THEN COALESCE(NEW.sabado, 0)
    END INTO v_novo_ideal;

    -- CORREÇÃO: Só atualizar se o valor for DIFERENTE para evitar loop de triggers
    UPDATE contagem_porcionados cp
    SET ideal_amanha = v_novo_ideal
    WHERE cp.item_porcionado_id = NEW.item_porcionado_id
      AND cp.loja_id = NEW.loja_id
      AND cp.dia_operacional = CURRENT_DATE
      AND cp.organization_id = NEW.organization_id
      AND COALESCE(cp.ideal_amanha, 0) != v_novo_ideal;

    -- Cast explícito para resolver ambiguidade
    PERFORM criar_ou_atualizar_producao_registro(
        NEW.item_porcionado_id,
        NEW.organization_id,
        NULL::uuid,
        'Sistema - Estoque Ideal Atualizado'::text
    );
    
    RETURN NEW;
END;
$function$;