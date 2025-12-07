import { useState, useEffect, useCallback } from 'react';
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
  const { user, isSuperAdmin } = useAuth();
  const { organizationId } = useOrganization();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Calcular uma vez como valor booleano para evitar loops
  const isSuperAdminUser = isSuperAdmin();

  const fetchPermissions = useCallback(async () => {
    // Apenas SuperAdmin tem bypass total - Admin depende dos checkboxes
    if (isSuperAdminUser) {
      setPermissions(['*']); // Wildcard para acesso total
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
        setPermissions([]);
      } else {
        const permKeys = data?.map(p => p.permission_key) || [];
        // Expandir com dependências
        const expanded = expandPermissionsWithDependencies(permKeys);
        setPermissions(expanded);
      }
    } catch (err) {
      console.error('Erro ao carregar permissões:', err);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isSuperAdminUser]);

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
