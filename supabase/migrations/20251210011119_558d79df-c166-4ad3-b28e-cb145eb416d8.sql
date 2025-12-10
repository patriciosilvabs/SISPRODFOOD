-- Adicionar ON DELETE CASCADE para todas as foreign keys que referenciam lojas

-- 1. contagem_porcionados
ALTER TABLE contagem_porcionados 
DROP CONSTRAINT contagem_porcionados_loja_id_fkey,
ADD CONSTRAINT contagem_porcionados_loja_id_fkey 
    FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;

-- 2. erros_devolucoes  
ALTER TABLE erros_devolucoes 
DROP CONSTRAINT erros_devolucoes_loja_id_fkey,
ADD CONSTRAINT erros_devolucoes_loja_id_fkey 
    FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;

-- 3. romaneios
ALTER TABLE romaneios 
DROP CONSTRAINT romaneios_loja_id_fkey,
ADD CONSTRAINT romaneios_loja_id_fkey 
    FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;

-- 4. estoque_loja_itens
ALTER TABLE estoque_loja_itens 
DROP CONSTRAINT estoque_loja_itens_loja_id_fkey,
ADD CONSTRAINT estoque_loja_itens_loja_id_fkey 
    FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;

-- 5. estoque_loja_produtos
ALTER TABLE estoque_loja_produtos 
DROP CONSTRAINT estoque_loja_produtos_loja_id_fkey,
ADD CONSTRAINT estoque_loja_produtos_loja_id_fkey 
    FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;

-- 6. estoques_ideais_semanais
ALTER TABLE estoques_ideais_semanais 
DROP CONSTRAINT estoques_ideais_semanais_loja_id_fkey,
ADD CONSTRAINT estoques_ideais_semanais_loja_id_fkey 
    FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;

-- 7. lojas_acesso
ALTER TABLE lojas_acesso 
DROP CONSTRAINT lojas_acesso_loja_id_fkey,
ADD CONSTRAINT lojas_acesso_loja_id_fkey 
    FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;

-- 8. produtos_estoque_minimo_semanal
ALTER TABLE produtos_estoque_minimo_semanal 
DROP CONSTRAINT produtos_estoque_minimo_semanal_loja_id_fkey,
ADD CONSTRAINT produtos_estoque_minimo_semanal_loja_id_fkey 
    FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;

-- 9. romaneios_avulsos (origem e destino)
ALTER TABLE romaneios_avulsos 
DROP CONSTRAINT romaneios_avulsos_loja_origem_id_fkey,
ADD CONSTRAINT romaneios_avulsos_loja_origem_id_fkey 
    FOREIGN KEY (loja_origem_id) REFERENCES lojas(id) ON DELETE CASCADE;

ALTER TABLE romaneios_avulsos 
DROP CONSTRAINT romaneios_avulsos_loja_destino_id_fkey,
ADD CONSTRAINT romaneios_avulsos_loja_destino_id_fkey 
    FOREIGN KEY (loja_destino_id) REFERENCES lojas(id) ON DELETE CASCADE;