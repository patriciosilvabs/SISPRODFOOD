import { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePermissions } from '@/hooks/usePermissions';
import { hasRoutePermission, ROUTE_PERMISSIONS } from '@/lib/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const { user, roles, loading } = useAuth();
  const { needsOnboarding, loading: orgLoading } = useOrganization();
  const { canAccess, subscriptionLoading } = useSubscription();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  // Memoize static values - usar roles diretamente, não função
  const userIsSuperAdmin = useMemo(() => roles.includes('SuperAdmin'), [roles]);
  const currentPath = location.pathname;
  const isSuperAdminRoute = currentPath.startsWith('/super-admin');
  
  // Calcular rota permitida usando função pura (não hook)
  const routeAccessAllowed = useMemo(() => {
    if (userIsSuperAdmin) return true;
    if (permissions.includes('*')) return true;
    return hasRoutePermission(currentPath, permissions, userIsSuperAdmin);
  }, [userIsSuperAdmin, permissions, currentPath]);
  
  // Calcular primeira rota permitida usando função pura
  const firstAllowedRoute = useMemo(() => {
    if (userIsSuperAdmin || permissions.includes('*')) return '/dashboard';
    const allowedRoute = Object.keys(ROUTE_PERMISSIONS).find(
      (route: string) => route !== '/' && hasRoutePermission(route, permissions, userIsSuperAdmin)
    );
    return allowedRoute || '/assinatura';
  }, [userIsSuperAdmin, permissions]);

  useEffect(() => {
    // Redirecionar para auth se não estiver logado
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    // Super Admin tem acesso total - redireciona para painel super admin se logado
    if (!loading && user && userIsSuperAdmin) {
      // Se Super Admin está em rota normal, deixar acessar (para debug)
      // Se está tentando acessar onboarding ou assinatura, redirecionar para painel
      if (currentPath === '/onboarding' || currentPath === '/assinatura') {
        navigate('/super-admin');
        return;
      }
      // Super Admin pode acessar qualquer rota
      return;
    }

    // Se é rota de super admin mas usuário não é super admin
    if (!loading && user && isSuperAdminRoute && !userIsSuperAdmin) {
      navigate('/');
      return;
    }

    // Redirecionar para onboarding se precisar (exceto se já estiver lá ou tiver convite pendente)
    let hasPendingInvite = false;
    try {
      hasPendingInvite = typeof window !== 'undefined' && !!localStorage.getItem('pendingInviteToken');
    } catch {
      // localStorage may not be accessible in insecure contexts
    }
    if (!loading && !orgLoading && user && needsOnboarding && !hasPendingInvite && currentPath !== '/onboarding') {
      navigate('/onboarding');
      return;
    }

    // Redirecionar para assinatura se trial expirou e não está na página de assinatura
    // Aguarda subscriptionLoading terminar para evitar redirecionamento prematuro
    if (!loading && !orgLoading && !subscriptionLoading && user && !needsOnboarding && !canAccess && currentPath !== '/assinatura') {
      navigate('/assinatura');
      return;
    }

    // Verificar permissões granulares para a rota atual
    if (!loading && !orgLoading && !permissionsLoading && user && !needsOnboarding && canAccess) {
      // Apenas SuperAdmin tem bypass - Admin depende das permissões granulares
      if (userIsSuperAdmin) return;
      
      // Rotas super admin já são protegidas pela verificação de role acima - pular permissões granulares
      if (isSuperAdminRoute) return;
      
      // Verificar permissão de rota usando o sistema granular
      // Rotas que não precisam de permissão específica (auth-related apenas)
      const publicRoutes = ['/assinatura', '/aceitar-convite'];
      const isPublicRoute = publicRoutes.includes(currentPath);
      
      if (!isPublicRoute && !routeAccessAllowed) {
        // Usuário não tem permissão para esta rota - redirecionar para primeira rota permitida
        navigate(firstAllowedRoute);
        return;
      }
      
      // Verificação legacy de roles (para compatibilidade)
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
        if (!hasRequiredRole) {
          navigate('/');
        }
      }
    }
  }, [user, loading, orgLoading, permissionsLoading, subscriptionLoading, needsOnboarding, canAccess, roles, requiredRoles, navigate, currentPath, userIsSuperAdmin, isSuperAdminRoute, routeAccessAllowed, firstAllowedRoute]);

  // Loading básico (auth e org)
  if (loading || orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Apenas Super Admin não precisa esperar permissões granulares
  if (user && userIsSuperAdmin) {
    return <>{children}</>;
  }

  // Outros usuários precisam esperar loading de permissões
  if (permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
