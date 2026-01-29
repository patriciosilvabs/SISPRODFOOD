-- 1. Remover versões duplicadas da função (não utilizadas)
DROP FUNCTION IF EXISTS criar_ou_atualizar_producao_registro(
    uuid, uuid, text, uuid, text, date, integer, integer
);

DROP FUNCTION IF EXISTS criar_ou_atualizar_producao_registro(
    uuid, uuid, date, integer
);

-- 2. Atualizar trigger para usar cast explícito - Estoque Ideal
CREATE OR REPLACE FUNCTION trigger_recalcular_producao_apos_estoque_ideal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE contagem_porcionados cp
    SET ideal_amanha = (
        SELECT CASE EXTRACT(DOW FROM CURRENT_DATE)
            WHEN 0 THEN COALESCE(eis.domingo, 0)
            WHEN 1 THEN COALESCE(eis.segunda, 0)
            WHEN 2 THEN COALESCE(eis.terca, 0)
            WHEN 3 THEN COALESCE(eis.quarta, 0)
            WHEN 4 THEN COALESCE(eis.quinta, 0)
            WHEN 5 THEN COALESCE(eis.sexta, 0)
            WHEN 6 THEN COALESCE(eis.sabado, 0)
        END
        FROM estoques_ideais_semanais eis
        WHERE eis.item_porcionado_id = cp.item_porcionado_id
          AND eis.loja_id = cp.loja_id
    )
    WHERE cp.item_porcionado_id = NEW.item_porcionado_id
      AND cp.loja_id = NEW.loja_id
      AND cp.dia_operacional = CURRENT_DATE
      AND cp.organization_id = NEW.organization_id;

    -- Cast explícito para resolver ambiguidade
    PERFORM criar_ou_atualizar_producao_registro(
        NEW.item_porcionado_id,
        NEW.organization_id,
        NULL::uuid,
        'Sistema - Estoque Ideal Atualizado'::text
    );
    
    RETURN NEW;
END;
$$;

-- 3. Atualizar trigger para usar cast explícito - Reserva Diária
CREATE OR REPLACE FUNCTION trigger_recalcular_producao_apos_reserva_diaria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Cast explícito para resolver ambiguidade
    PERFORM criar_ou_atualizar_producao_registro(
        NEW.item_porcionado_id,
        NEW.organization_id,
        NULL::uuid,
        'Sistema - Reserva Diária Atualizada'::text
    );
    
    RETURN NEW;
END;
$$;