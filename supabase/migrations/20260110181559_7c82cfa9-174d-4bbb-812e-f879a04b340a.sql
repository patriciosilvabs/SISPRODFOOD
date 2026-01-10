-- 1. Adicionar coluna codigo_lote à tabela producao_registros
ALTER TABLE producao_registros 
ADD COLUMN IF NOT EXISTS codigo_lote TEXT UNIQUE;

-- 2. Criar função para gerar código único de lote
CREATE OR REPLACE FUNCTION gerar_codigo_lote(p_organization_id UUID, p_data_referencia DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_data_str TEXT;
  v_sequencia INT;
  v_codigo TEXT;
BEGIN
  -- Formatar data: YYYYMMDD
  v_data_str := TO_CHAR(COALESCE(p_data_referencia, CURRENT_DATE), 'YYYYMMDD');
  
  -- Contar produções do dia para a organização e obter próxima sequência
  SELECT COALESCE(MAX(
    CAST(NULLIF(SUBSTRING(codigo_lote FROM '[0-9]+$'), '') AS INTEGER)
  ), 0) + 1
  INTO v_sequencia
  FROM producao_registros
  WHERE organization_id = p_organization_id
    AND codigo_lote LIKE 'LOTE-' || v_data_str || '-%';
  
  -- Montar código: LOTE-YYYYMMDD-###
  v_codigo := 'LOTE-' || v_data_str || '-' || LPAD(v_sequencia::TEXT, 3, '0');
  
  RETURN v_codigo;
END;
$$;

-- 3. Criar função trigger para gerar código automaticamente
CREATE OR REPLACE FUNCTION trigger_gerar_codigo_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Gerar código apenas se não foi fornecido
  IF NEW.codigo_lote IS NULL THEN
    NEW.codigo_lote := gerar_codigo_lote(
      NEW.organization_id, 
      COALESCE(NEW.data_referencia::DATE, CURRENT_DATE)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Criar trigger na tabela producao_registros
DROP TRIGGER IF EXISTS before_insert_producao_codigo_lote ON producao_registros;

CREATE TRIGGER before_insert_producao_codigo_lote
BEFORE INSERT ON producao_registros
FOR EACH ROW
EXECUTE FUNCTION trigger_gerar_codigo_lote();

-- 5. Gerar códigos para registros existentes que não possuem
UPDATE producao_registros pr
SET codigo_lote = gerar_codigo_lote(pr.organization_id, COALESCE(pr.data_referencia::DATE, CURRENT_DATE))
WHERE pr.codigo_lote IS NULL;