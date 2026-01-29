-- Corrigir FK contagem_porcionados_audit_loja_id_fkey para incluir ON DELETE CASCADE
-- Isso permitirá a exclusão de lojas sem erro 409

-- 1. Remover a constraint atual (sem CASCADE)
ALTER TABLE public.contagem_porcionados_audit
DROP CONSTRAINT contagem_porcionados_audit_loja_id_fkey;

-- 2. Recriar com ON DELETE CASCADE
ALTER TABLE public.contagem_porcionados_audit
ADD CONSTRAINT contagem_porcionados_audit_loja_id_fkey
FOREIGN KEY (loja_id) REFERENCES public.lojas(id) ON DELETE CASCADE;