-- Limpeza de lojas duplicadas (manter apenas as que têm hífen no nome, padrão correto)
-- Primeiro, transferir dados de lojas_acesso para as lojas corretas antes de deletar

-- Atualizar lojas_acesso: UNIDADE ALEIXO -> UNIDADE - ALEIXO
UPDATE lojas_acesso 
SET loja_id = '7499f690-65ac-49c3-a005-c85baff9b56f' 
WHERE loja_id = 'd968a2b6-cdb6-40b8-a484-4dc579b98da0';

-- Atualizar lojas_acesso: UNIDADE CACHOEIRINHA -> UNIDADE - CACHOEIRINHA
UPDATE lojas_acesso 
SET loja_id = '84a6cd25-5378-41a5-9222-99b138e87c7a' 
WHERE loja_id = '43d5894f-8b83-4f4b-ba61-13c4ed124701';

-- Atualizar estoque_loja_itens: UNIDADE ALEIXO -> UNIDADE - ALEIXO
UPDATE estoque_loja_itens 
SET loja_id = '7499f690-65ac-49c3-a005-c85baff9b56f' 
WHERE loja_id = 'd968a2b6-cdb6-40b8-a484-4dc579b98da0';

-- Atualizar estoque_loja_itens: UNIDADE CACHOEIRINHA -> UNIDADE - CACHOEIRINHA
UPDATE estoque_loja_itens 
SET loja_id = '84a6cd25-5378-41a5-9222-99b138e87c7a' 
WHERE loja_id = '43d5894f-8b83-4f4b-ba61-13c4ed124701';

-- Atualizar contagem_porcionados das lojas duplicadas
UPDATE contagem_porcionados 
SET loja_id = '7499f690-65ac-49c3-a005-c85baff9b56f' 
WHERE loja_id = 'd968a2b6-cdb6-40b8-a484-4dc579b98da0';

UPDATE contagem_porcionados 
SET loja_id = '84a6cd25-5378-41a5-9222-99b138e87c7a' 
WHERE loja_id = '43d5894f-8b83-4f4b-ba61-13c4ed124701';

-- Atualizar romaneios das lojas duplicadas
UPDATE romaneios 
SET loja_id = '7499f690-65ac-49c3-a005-c85baff9b56f' 
WHERE loja_id = 'd968a2b6-cdb6-40b8-a484-4dc579b98da0';

UPDATE romaneios 
SET loja_id = '84a6cd25-5378-41a5-9222-99b138e87c7a' 
WHERE loja_id = '43d5894f-8b83-4f4b-ba61-13c4ed124701';

-- Agora deletar as lojas duplicadas (sem hífen)
DELETE FROM lojas WHERE id = 'd968a2b6-cdb6-40b8-a484-4dc579b98da0'; -- UNIDADE ALEIXO
DELETE FROM lojas WHERE id = '43d5894f-8b83-4f4b-ba61-13c4ed124701'; -- UNIDADE CACHOEIRINHA

-- Deletar CPD duplicado (manter apenas o primeiro: d928500a-...)
DELETE FROM lojas WHERE id = '172102ea-80cf-46ac-9975-ce34cb2dc7dc';