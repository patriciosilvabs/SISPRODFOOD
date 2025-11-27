-- Adicionar foreign key de lojas_acesso.loja_id para lojas.id (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lojas_acesso_loja_id_fkey'
  ) THEN
    ALTER TABLE public.lojas_acesso
    ADD CONSTRAINT lojas_acesso_loja_id_fkey 
    FOREIGN KEY (loja_id) REFERENCES public.lojas(id) ON DELETE CASCADE;
  END IF;
END $$;