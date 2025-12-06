-- Adicionar coluna user_id à tabela ui_permissions
ALTER TABLE ui_permissions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Remover constraint UNIQUE existente
ALTER TABLE ui_permissions DROP CONSTRAINT IF EXISTS ui_permissions_organization_id_pagina_id_key;

-- Criar nova constraint UNIQUE incluindo user_id
ALTER TABLE ui_permissions ADD CONSTRAINT ui_permissions_org_user_page_key 
  UNIQUE(organization_id, user_id, pagina_id);

-- Remover políticas RLS existentes
DROP POLICY IF EXISTS "Admins can manage ui_permissions in their org" ON ui_permissions;
DROP POLICY IF EXISTS "Users can view ui_permissions from their org" ON ui_permissions;

-- Criar nova política para admins gerenciarem
CREATE POLICY "Admins can manage ui_permissions in their org"
  ON ui_permissions FOR ALL
  USING (organization_id = get_user_organization_id(auth.uid()) 
         AND has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) 
              AND has_role(auth.uid(), 'Admin'::app_role));

-- Criar política para usuários lerem suas próprias permissões ou o padrão da org
CREATE POLICY "Users can view their own or org default ui_permissions"
  ON ui_permissions FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()) 
         AND (user_id = auth.uid() OR user_id IS NULL));