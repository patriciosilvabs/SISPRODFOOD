-- Criar loja CPD para organizações existentes que não possuem
INSERT INTO lojas (nome, responsavel, tipo, organization_id, fuso_horario, cutoff_operacional)
SELECT 
  'CPD - Centro de Produção e Distribuição',
  'Administrador',
  'cpd',
  o.id,
  'America/Sao_Paulo',
  '03:00:00'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM lojas l 
  WHERE l.organization_id = o.id AND l.tipo = 'cpd'
);

-- Vincular admins existentes às suas lojas CPD (se ainda não vinculados)
INSERT INTO lojas_acesso (user_id, loja_id, organization_id)
SELECT 
  om.user_id,
  l.id,
  om.organization_id
FROM organization_members om
JOIN lojas l ON l.organization_id = om.organization_id AND l.tipo = 'cpd'
WHERE om.is_admin = true
  AND NOT EXISTS (
    SELECT 1 FROM lojas_acesso la 
    WHERE la.user_id = om.user_id AND la.loja_id = l.id
  );