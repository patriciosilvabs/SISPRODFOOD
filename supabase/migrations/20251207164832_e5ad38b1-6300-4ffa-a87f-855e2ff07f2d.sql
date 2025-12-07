-- Criar função para retornar data atual do servidor
CREATE OR REPLACE FUNCTION public.get_current_date()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CURRENT_DATE;
$$;

-- Limpar registro de contagem de teste de CACHOEIRINHA
DELETE FROM contagem_porcionados 
WHERE id = 'f79f5420-2dc9-4cf2-bdeb-78d0617c3ceb';

-- Atualizar registro de produção para remover CACHOEIRINHA do detalhes_lojas
UPDATE producao_registros 
SET 
  detalhes_lojas = '[{"loja_id": "6292fdc1-66ab-4a55-866d-d0b3c1c10d5c", "loja_nome": "UNIDADE - JAPIIM", "quantidade": 20}]'::jsonb,
  unidades_programadas = 20,
  demanda_lojas = 20
WHERE id = 'e686a89d-4254-4d14-a966-465c3a780ee5';

-- Deletar registro de produção duplicado/vazio se existir
DELETE FROM producao_registros 
WHERE id = '14197446-646e-4c8e-bf2a-41851e7d0240';