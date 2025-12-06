import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { UIPermissionsConfig, getPageConfigById, getDefaultConfig } from '@/lib/ui-permissions-config';

interface UseUIPermissionsReturn {
  loading: boolean;
  pageConfig: UIPermissionsConfig | null;
  isPageActive: () => boolean;
  isSecaoActive: (secaoId: string) => boolean;
  isColunaActive: (colunaId: string) => boolean;
  isAcaoActive: (acaoId: string) => boolean;
  getActiveColunas: () => string[];
  getActiveSecoes: () => string[];
  refreshConfig: () => Promise<void>;
}

export const useUIPermissions = (paginaId: string): UseUIPermissionsReturn => {
  const { organizationId } = useOrganization();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pageConfig, setPageConfig] = useState<UIPermissionsConfig | null>(null);

  const fetchConfig = useCallback(async () => {
    // Admin e SuperAdmin veem tudo por padrão
    if (isAdmin() || isSuperAdmin()) {
      setPageConfig(null); // null = sem restrições
      setLoading(false);
      return;
    }

    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('ui_permissions')
        .select('config')
        .eq('organization_id', organizationId)
        .eq('pagina_id', paginaId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar UI permissions:', error);
      }

      // Se não encontrar configuração, usar padrão (tudo ativo)
      if (data?.config) {
        setPageConfig(data.config as unknown as UIPermissionsConfig);
      } else {
        setPageConfig(null); // null = usar padrão
      }
    } catch (err) {
      console.error('Erro ao carregar UI permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, paginaId, isAdmin, isSuperAdmin]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Se pageConfig é null = sem restrições (padrão - tudo ativo)
  const isPageActive = useCallback(() => {
    if (!pageConfig) return true;
    return pageConfig.ativo !== false;
  }, [pageConfig]);

  const isSecaoActive = useCallback((secaoId: string) => {
    if (!pageConfig) return true;
    if (!pageConfig.secoes) return true;
    return pageConfig.secoes[secaoId]?.ativo !== false;
  }, [pageConfig]);

  const isColunaActive = useCallback((colunaId: string) => {
    if (!pageConfig) return true;
    if (!pageConfig.colunas) return true;
    return pageConfig.colunas[colunaId]?.ativo !== false;
  }, [pageConfig]);

  const isAcaoActive = useCallback((acaoId: string) => {
    if (!pageConfig) return true;
    if (!pageConfig.acoes) return true;
    return pageConfig.acoes[acaoId]?.ativo !== false;
  }, [pageConfig]);

  const getActiveColunas = useCallback(() => {
    if (!pageConfig || !pageConfig.colunas) {
      // Retornar todas as colunas da página config
      const pageDefinition = getPageConfigById(paginaId);
      return pageDefinition?.colunas.map(c => c.id) || [];
    }
    return Object.entries(pageConfig.colunas)
      .filter(([_, config]) => config.ativo !== false)
      .map(([id]) => id);
  }, [pageConfig, paginaId]);

  const getActiveSecoes = useCallback(() => {
    if (!pageConfig || !pageConfig.secoes) {
      const pageDefinition = getPageConfigById(paginaId);
      return pageDefinition?.secoes.map(s => s.id) || [];
    }
    return Object.entries(pageConfig.secoes)
      .filter(([_, config]) => config.ativo !== false)
      .map(([id]) => id);
  }, [pageConfig, paginaId]);

  return {
    loading,
    pageConfig,
    isPageActive,
    isSecaoActive,
    isColunaActive,
    isAcaoActive,
    getActiveColunas,
    getActiveSecoes,
    refreshConfig: fetchConfig
  };
};
