-- Remover funções duplicadas/obsoletas de criar_ou_atualizar_producao_registro
-- Isso resolve o erro "function is not unique" que causa 400 Bad Request

-- Remover versão antiga com 8 parâmetros (inclui p_item_nome, p_quantidade_por_lote, etc.)
DROP FUNCTION IF EXISTS public.criar_ou_atualizar_producao_registro(
    uuid, text, uuid, uuid, text, integer, numeric, numeric
);

-- Remover versão intermediária com 6 parâmetros (inclui p_dia_operacional, p_is_incremental)
DROP FUNCTION IF EXISTS public.criar_ou_atualizar_producao_registro(
    uuid, uuid, uuid, text, date, boolean
);