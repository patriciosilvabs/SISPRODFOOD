import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { UserProfile, PROFILE_DEFAULT_PAGES, SYSTEM_PAGES } from '@/lib/page-access-config';

interface PageAccessOverride {
  page_route: string;
  enabled: boolean;
}

interface UsePageAccessReturn {
  profile: UserProfile | null;
  loading: boolean;
  hasPageAccess: (route: string) => boolean;
  accessiblePages: string[];
  refreshAccess: () => Promise<void>;
}

// Cache estático para persistir entre navegações
const accessCache = new Map<string, { 
  profile: UserProfile; 
  overrides: PageAccessOverride[]; 
  timestamp: number 
}>();
const CACHE_TTL = 60000; // 1 minuto

export const usePageAccess = (): UsePageAccessReturn => {
  const { user, roles, loading: authLoading } = useAuth();
  const { organizationId } = useOrganization();
  
  // Verificar cache antes de inicializar estado
  const cacheKey = `${user?.id}_${organizationId}`;
  const cachedData = accessCache.get(cacheKey);
  const hasValidCache = !!(cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL));
  
  // Se auth ainda está carregando, não usar cache
  const useCache = hasValidCache && !authLoading;
  
  const [profile, setProfile] = useState<UserProfile | null>(useCache ? cachedData!.profile : null);
  const [overrides, setOverrides] = useState<PageAccessOverride[]>(useCache ? cachedData!.overrides : []);
  const [loading, setLoading] = useState(!useCache);
  const hasFetched = useRef(useCache);

  // Calcular se é SuperAdmin usando roles array (estável)
  const userIsSuperAdmin = roles.includes('SuperAdmin');

  const fetchAccess = useCallback(async (forceRefresh = false) => {
    // Aguardar AuthContext terminar de carregar
    if (authLoading) {
      return;
    }
    
    // SuperAdmin tem acesso total
    if (userIsSuperAdmin) {
      setProfile('admin');
      setOverrides([]);
      setLoading(false);
      hasFetched.current = true;
      return;
    }

    if (!user?.id || !organizationId) {
      setProfile('loja'); // Fallback seguro ao invés de null para evitar loading infinito
      setOverrides([]);
      setLoading(false);
      hasFetched.current = true;
      return;
    }
    
    // Se já buscou e não é refresh forçado, não refazer
    if (hasFetched.current && !forceRefresh) {
      return;
    }

    try {
      // 1. Buscar se usuário é admin (is_admin na organization_members)
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('is_admin')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (memberError) {
        console.error('Erro ao buscar membership:', memberError);
      }

      const isAdmin = memberData?.is_admin === true;

      if (isAdmin) {
        setProfile('admin');
        // Admin não precisa de overrides - tem acesso a tudo
        setOverrides([]);
        setLoading(false);
        return;
      }

      // 2. Se não é admin, verificar tipo de loja vinculada
      const { data: lojasData, error: lojasError } = await supabase
        .from('lojas_acesso')
        .select('loja_id, lojas!inner(tipo)')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId);

      if (lojasError) {
        console.error('Erro ao buscar lojas do usuário:', lojasError);
      }

      // Determinar perfil baseado no tipo de loja
      const hasCPD = lojasData?.some((la: any) => la.lojas?.tipo === 'cpd');
      const detectedProfile: UserProfile = hasCPD ? 'cpd' : 'loja';
      setProfile(detectedProfile);

      // 3. Buscar overrides de páginas
      const { data: pageAccessData, error: pageAccessError } = await supabase
        .from('user_page_access')
        .select('page_route, enabled')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId);

      if (pageAccessError) {
        console.error('Erro ao buscar page access:', pageAccessError);
      }

      setOverrides(pageAccessData || []);
      
      // Salvar no cache
      const cacheKey = `${user.id}_${organizationId}`;
      accessCache.set(cacheKey, {
        profile: detectedProfile,
        overrides: pageAccessData || [],
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Erro ao carregar acesso:', err);
      setProfile(null);
      setOverrides([]);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, [user?.id, organizationId, userIsSuperAdmin, authLoading]);

  useEffect(() => {
    // Só buscar se auth carregou e não temos cache válido
    if (!authLoading && !hasFetched.current) {
      fetchAccess();
    }
  }, [fetchAccess, authLoading]);

  // Função para verificar acesso a uma página
  const hasPageAccess = useCallback((route: string): boolean => {
    // SuperAdmin tem acesso total
    if (userIsSuperAdmin) return true;

    // Sem perfil = sem acesso
    if (!profile) return false;

    // Verificar override específico primeiro
    const override = overrides.find(o => o.page_route === route);
    if (override !== undefined) {
      return override.enabled;
    }

    // Usar default do perfil
    const defaultPages = PROFILE_DEFAULT_PAGES[profile] || [];
    return defaultPages.includes(route);
  }, [profile, overrides, userIsSuperAdmin]);

  // Lista de páginas acessíveis
  const accessiblePages = useMemo(() => {
    if (userIsSuperAdmin) {
      return SYSTEM_PAGES.map(p => p.route);
    }

    if (!profile) return [];

    const defaultPages = new Set(PROFILE_DEFAULT_PAGES[profile] || []);

    // Aplicar overrides
    for (const override of overrides) {
      if (override.enabled) {
        defaultPages.add(override.page_route);
      } else {
        defaultPages.delete(override.page_route);
      }
    }

    return Array.from(defaultPages);
  }, [profile, overrides, userIsSuperAdmin]);

  return {
    profile,
    // Removida condição de profile === null que causava deadlock
    loading: authLoading || loading,
    hasPageAccess,
    accessiblePages,
    refreshAccess: fetchAccess,
  };
};
