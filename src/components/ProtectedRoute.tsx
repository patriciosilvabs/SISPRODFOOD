import { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePageAccess } from '@/hooks/usePageAccess';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const { user, roles, loading } = useAuth();
  const { needsOnboarding, loading: orgLoading } = useOrganization();
  const { canAccess, subscriptionLoading } = useSubscription();
  const { hasPageAccess, accessiblePages, loading: pageAccessLoading } = usePageAccess();
  const navigate = useNavigate();
  const location = useLocation();

  // Memoize static values
  const userIsSuperAdmin = useMemo(() => roles.includes('SuperAdmin'), [roles]);
  const currentPath = location.pathname;
  const isSuperAdminRoute = currentPath.startsWith('/super-admin');

  // Calcular primeira rota permitida
  const firstAllowedRoute = useMemo(() => {
    if (userIsSuperAdmin) return '/dashboard';
    if (accessiblePages.length > 0) {
      return accessiblePages.includes('/') ? '/' : accessiblePages[0];
    }
    return '/assinatura';
  }, [userIsSuperAdmin, accessiblePages]);

  useEffect(() => {
    // Redirecionar para auth se não estiver logado
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    // Super Admin tem acesso total
    if (!loading && user && userIsSuperAdmin) {
      if (currentPath === '/onboarding' || currentPath === '/assinatura') {
        navigate('/super-admin');
        return;
      }
      return;
    }

    // Se é rota de super admin mas usuário não é super admin
    if (!loading && user && isSuperAdminRoute && !userIsSuperAdmin) {
      navigate('/');
      return;
    }

    // Redirecionar para onboarding se precisar
    let hasPendingInvite = false;
    try {
      hasPendingInvite = typeof window !== 'undefined' && !!localStorage.getItem('pendingInviteToken');
    } catch {
      // localStorage may not be accessible
    }
    if (!loading && !orgLoading && user && needsOnboarding && !hasPendingInvite && currentPath !== '/onboarding') {
      navigate('/onboarding');
      return;
    }

    // Redirecionar para assinatura se trial expirou
    if (!loading && !orgLoading && !subscriptionLoading && user && !needsOnboarding && !canAccess && currentPath !== '/assinatura') {
      navigate('/assinatura');
      return;
    }

    // Verificar acesso à página usando novo sistema de perfis
    if (!loading && !orgLoading && !pageAccessLoading && user && !needsOnboarding && canAccess) {
      if (userIsSuperAdmin) return;
      if (isSuperAdminRoute) return;
      
      // Rotas públicas não precisam de verificação
      const publicRoutes = ['/assinatura', '/aceitar-convite'];
      const isPublicRoute = publicRoutes.includes(currentPath);
      
      if (!isPublicRoute && !hasPageAccess(currentPath)) {
        navigate(firstAllowedRoute);
        return;
      }
      
      // Verificação legacy de roles (para compatibilidade)
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
        if (!hasRequiredRole && !hasPageAccess(currentPath)) {
          navigate('/');
        }
      }
    }
  }, [user, loading, orgLoading, pageAccessLoading, subscriptionLoading, needsOnboarding, canAccess, roles, requiredRoles, navigate, currentPath, userIsSuperAdmin, isSuperAdminRoute, hasPageAccess, firstAllowedRoute]);

  // Loading
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

  // Super Admin não precisa esperar page access
  if (user && userIsSuperAdmin) {
    return <>{children}</>;
  }

  // Outros usuários precisam esperar loading de page access
  if (pageAccessLoading) {
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
