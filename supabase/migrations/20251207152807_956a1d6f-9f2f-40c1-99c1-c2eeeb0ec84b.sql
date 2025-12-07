
-- 1. Corrigir role de todos os usuários vinculados a lojas CPD que estão com role incorreto
UPDATE organization_members om
SET role = 'Produção'
FROM lojas_acesso la
JOIN lojas l ON l.id = la.loja_id
WHERE om.user_id = la.user_id
  AND l.tipo = 'cpd'
  AND om.role NOT IN ('Produção', 'Admin');

-- 2. Criar função para sincronizar role automaticamente baseado no tipo de loja
CREATE OR REPLACE FUNCTION sync_role_on_loja_acesso()
RETURNS TRIGGER AS $$
DECLARE
  v_loja_tipo TEXT;
  v_new_role app_role;
  v_is_admin BOOLEAN;
BEGIN
  -- Buscar tipo da loja
  SELECT tipo INTO v_loja_tipo FROM lojas WHERE id = NEW.loja_id;
  
  -- Verificar se usuário é admin (não alterar role de admins)
  SELECT is_admin INTO v_is_admin 
  FROM organization_members 
  WHERE user_id = NEW.user_id AND organization_id = NEW.organization_id;
  
  -- Se é admin, não alterar
  IF v_is_admin = true THEN
    RETURN NEW;
  END IF;
  
  -- Determinar novo role baseado no tipo da loja
  IF v_loja_tipo = 'cpd' THEN
    v_new_role := 'Produção';
  ELSE
    v_new_role := 'Loja';
  END IF;
  
  -- Atualizar role do usuário
  UPDATE organization_members 
  SET role = v_new_role 
  WHERE user_id = NEW.user_id
    AND organization_id = NEW.organization_id
    AND is_admin = false;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Criar trigger para sincronização automática
DROP TRIGGER IF EXISTS trg_sync_role_on_loja_acesso ON lojas_acesso;
CREATE TRIGGER trg_sync_role_on_loja_acesso
AFTER INSERT OR UPDATE ON lojas_acesso
FOR EACH ROW EXECUTE FUNCTION sync_role_on_loja_acesso();
