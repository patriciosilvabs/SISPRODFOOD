-- =====================================================
-- TRIGGERS PARA RECALCULAR PRODUÇÃO AUTOMATICAMENTE
-- Quando estoques ideais ou reserva diária são alterados
-- =====================================================

-- 1. Função que recalcula produção e atualiza ideal_amanha nas contagens
CREATE OR REPLACE FUNCTION trigger_recalcular_producao_apos_estoque_ideal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Atualizar ideal_amanha na contagem do dia atual para refletir novo estoque ideal
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

    -- Recalcular produção para o item afetado
    PERFORM criar_ou_atualizar_producao_registro(
        NEW.item_porcionado_id,
        NEW.organization_id,
        NULL,
        'Sistema - Estoque Ideal Atualizado'
    );
    
    RETURN NEW;
END;
$$;

-- 2. Função para trigger de reserva diária
CREATE OR REPLACE FUNCTION trigger_recalcular_producao_apos_reserva_diaria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Recalcular produção para o item afetado
    PERFORM criar_ou_atualizar_producao_registro(
        NEW.item_porcionado_id,
        NEW.organization_id,
        NULL,
        'Sistema - Reserva Diária Atualizada'
    );
    
    RETURN NEW;
END;
$$;

-- 3. Remover triggers antigos se existirem
DROP TRIGGER IF EXISTS trg_recalcular_apos_estoque_ideal ON estoques_ideais_semanais;
DROP TRIGGER IF EXISTS trg_recalcular_apos_reserva_diaria ON itens_reserva_diaria;

-- 4. Criar trigger em estoques_ideais_semanais
CREATE TRIGGER trg_recalcular_apos_estoque_ideal
AFTER INSERT OR UPDATE ON estoques_ideais_semanais
FOR EACH ROW
EXECUTE FUNCTION trigger_recalcular_producao_apos_estoque_ideal();

-- 5. Criar trigger em itens_reserva_diaria
CREATE TRIGGER trg_recalcular_apos_reserva_diaria
AFTER INSERT OR UPDATE ON itens_reserva_diaria
FOR EACH ROW
EXECUTE FUNCTION trigger_recalcular_producao_apos_reserva_diaria();

-- 6. Habilitar realtime para as tabelas de configuração
ALTER PUBLICATION supabase_realtime ADD TABLE estoques_ideais_semanais;
ALTER PUBLICATION supabase_realtime ADD TABLE itens_reserva_diaria;