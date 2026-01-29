import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCallback } from 'react';
import type { Json } from '@/integrations/supabase/types';

type AuditAction = 
  | 'role.assign' 
  | 'role.remove' 
  | 'permission.grant' 
  | 'permission.revoke'
  | 'user.invite' 
  | 'user.remove'
  | 'user.update'
  | 'invite.cancel'
  | 'superadmin.promote'
  | 'superadmin.demote'
  | 'producao.limpar'
  | 'producao.confirmar_estoque';

type EntityType = 'user' | 'role' | 'permission' | 'invite' | 'producao_registros';

interface AuditLogDetails {
  target_email?: string;
  target_name?: string;
  role?: string;
  previous_roles?: string[];
  removed_roles?: string[];
  removed_permissions?: string[];
  invited_email?: string;
  roles?: string[];
  lojas_ids?: string[];
  inviter_name?: string;
  new_permissions?: string[];
  new_lojas?: string[];
  [key: string]: string | string[] | undefined;
}

export const useAuditLog = () => {
  const { user } = useAuth();
  const { organizationId } = useOrganization();

  const log = useCallback(async (
    action: AuditAction,
    entityType: EntityType,
    entityId: string | null,
    details: AuditLogDetails
  ) => {
    if (!user) {
      console.warn('useAuditLog: No user available for logging');
      return;
    }

    try {
      const logData: {
        user_id: string;
        user_email: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        details: Json;
        organization_id?: string;
      } = {
        user_id: user.id,
        user_email: user.email || '',
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: details as unknown as Json,
      };
      
      if (organizationId) {
        logData.organization_id = organizationId;
      }
      
      const { error } = await supabase.from('audit_logs').insert([logData]);

      if (error) {
        console.error('Erro ao gravar log de auditoria:', error);
      }
    } catch (error) {
      console.error('Erro ao gravar log de auditoria:', error);
    }
  }, [user, organizationId]);

  return { log };
};
