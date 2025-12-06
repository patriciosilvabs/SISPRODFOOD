-- Adicionar campos modo_envio e peso_por_unidade_kg à tabela produtos
ALTER TABLE public.produtos 
ADD COLUMN modo_envio TEXT DEFAULT 'peso' CHECK (modo_envio IN ('peso', 'unidade')),
ADD COLUMN peso_por_unidade_kg NUMERIC;

-- Criar função de validação
CREATE OR REPLACE FUNCTION public.validar_peso_por_unidade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.modo_envio = 'unidade' AND (NEW.peso_por_unidade_kg IS NULL OR NEW.peso_por_unidade_kg <= 0) THEN
    RAISE EXCEPTION 'peso_por_unidade_kg é obrigatório e deve ser maior que zero para produtos com modo_envio = unidade';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger de validação
CREATE TRIGGER tr_validar_peso_por_unidade
BEFORE INSERT OR UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.validar_peso_por_unidade();