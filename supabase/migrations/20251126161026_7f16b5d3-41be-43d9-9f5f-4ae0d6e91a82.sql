-- Corrigir estoques negativos no estoque_cpd
UPDATE estoque_cpd 
SET quantidade = 0 
WHERE quantidade < 0;