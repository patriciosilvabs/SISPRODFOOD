import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { 
  expandPermissionsWithDependencies, 
  hasRoutePermission,
  ROUTE_PERMISSIONS 
} from '@/lib/permissions';

interface UsePermissionsReturn {
  permissions: string[];
  loading: boolean;
  hasPermission: (permissionKey: string) => boolean;
  hasAnyPermission: (permissionKeys: string[]) => boolean;
  hasAllPermissions: (permissionKeys: string[]) => boolean;
  hasRouteAccess: (route: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

export const usePermissions = (): UsePermissionsReturn => {
  const { user, roles } = useAuth();
  const { organizationId } = useOrganization();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Calcular uma vez como valor booleano memoizado para evitar loops
  const isSuperAdminUser = useMemo(() => roles.includes('SuperAdmin'), [roles]);

  // Verificar se usuário é Admin (dono da organização)
  const isAdminUser = useMemo(() => roles.includes('Admin'), [roles]);

  const fetchPermissions = useCallback(async () => {
    // SuperAdmin tem bypass total
    if (isSuperAdminUser) {
      setPermissions(['*']);
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission_key')
        .eq('user_id', user.id)
        .eq('granted', true);

      if (error) {
        console.error('Erro ao carregar permissões:', error);
        // Admin sem permissões configuradas = acesso total
        if (isAdminUser) {
          setPermissions(['*']);
        } else {
          setPermissions([]);
        }
      } else {
        const permKeys = data?.map(p => p.permission_key) || [];
        
        // Se é Admin e não tem permissões granulares configuradas, conceder acesso total
        if (permKeys.length === 0 && isAdminUser) {
          setPermissions(['*']);
        } else if (permKeys.length === 0) {
          setPermissions([]);
        } else {
          const expanded = expandPermissionsWithDependencies(permKeys);
          setPermissions(expanded);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar permissões:', err);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isSuperAdminUser, isAdminUser]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((permissionKey: string): boolean => {
    if (isSuperAdminUser) return true;
    if (permissions.includes('*')) return true;
    return permissions.includes(permissionKey);
  }, [permissions, isSuperAdminUser]);

  const hasAnyPermission = useCallback((permissionKeys: string[]): boolean => {
    if (isSuperAdminUser) return true;
    if (permissions.includes('*')) return true;
    return permissionKeys.some(key => permissions.includes(key));
  }, [permissions, isSuperAdminUser]);

  const hasAllPermissions = useCallback((permissionKeys: string[]): boolean => {
    if (isSuperAdminUser) return true;
    if (permissions.includes('*')) return true;
    return permissionKeys.every(key => permissions.includes(key));
  }, [permissions, isSuperAdminUser]);

  const hasRouteAccess = useCallback((route: string): boolean => {
    return hasRoutePermission(route, permissions, isSuperAdminUser);
  }, [permissions, isSuperAdminUser]);

  const refreshPermissions = useCallback(async () => {
    setLoading(true);
    await fetchPermissions();
  }, [fetchPermissions]);

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRouteAccess,
    refreshPermissions
  };
};
