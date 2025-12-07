import { useEffect, useRef } from 'react';
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
  const { accessiblePages, loading: pageAccessLoading } = usePageAccess();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Ref para evitar navegação duplicada
  const hasCheckedAccess = useRef(false);
  const lastCheckedPath = useRef<string | null>(null);

  const userIsSuperAdmin = roles.includes('SuperAdmin');
  const currentPath = location.pathname;
  const isSuperAdminRoute = currentPath.startsWith('/super-admin');

  // Reset flag quando path muda
  useEffect(() => {
    if (lastCheckedPath.current !== currentPath) {
      hasCheckedAccess.current = false;
      lastCheckedPath.current = currentPath;
    }
  }, [currentPath]);

  useEffect(() => {
    // Aguardar loading terminar
    const isLoading = loading || orgLoading;
    if (isLoading) {
      return;
    }

    // Redirecionar para auth se não estiver logado
    if (!user) {
      navigate('/auth');
      return;
    }

    // Super Admin tem acesso total
    if (userIsSuperAdmin) {
      if (currentPath === '/onboarding' || currentPath === '/assinatura') {
        navigate('/super-admin');
      }
      return;
    }

    // Se é rota de super admin mas usuário não é super admin
    if (isSuperAdminRoute) {
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
    if (needsOnboarding && !hasPendingInvite && currentPath !== '/onboarding') {
      navigate('/onboarding');
      return;
    }

    // Aguardar subscription loading
    if (subscriptionLoading) {
      return;
    }

    // Redirecionar para assinatura se trial expirou
    if (!needsOnboarding && !canAccess && currentPath !== '/assinatura') {
      navigate('/assinatura');
      return;
    }

    // Aguardar page access loading
    if (pageAccessLoading) {
      return;
    }

    // Evitar verificação duplicada para mesmo path
    if (hasCheckedAccess.current) {
      return;
    }

    // Verificar acesso à página
    if (!needsOnboarding && canAccess) {
      // Guard: se accessiblePages está vazio, aguardar carregamento real
      if (accessiblePages.length === 0) {
        return;
      }
      
      const publicRoutes = ['/assinatura', '/aceitar-convite'];
      const isPublicRoute = publicRoutes.includes(currentPath);
      
      if (!isPublicRoute && !accessiblePages.includes(currentPath)) {
        hasCheckedAccess.current = true;
        // Calcular rota alvo inline
        const targetRoute = accessiblePages.length > 0 
          ? (accessiblePages.includes('/') ? '/' : accessiblePages[0])
          : '/assinatura';
        navigate(targetRoute);
        return;
      }
      
      // Verificação legacy de roles
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
        if (!hasRequiredRole && !accessiblePages.includes(currentPath)) {
          hasCheckedAccess.current = true;
          navigate('/');
          return;
        }
      }
      
      hasCheckedAccess.current = true;
    }
  }, [user, loading, orgLoading, pageAccessLoading, subscriptionLoading, needsOnboarding, canAccess, roles, requiredRoles, navigate, currentPath, userIsSuperAdmin, isSuperAdminRoute]);

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

  // Se não temos user após loading terminar, mostrar spinner enquanto redirect acontece
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Renderizar children imediatamente - useEffect cuida dos redirects
  // Isso evita flash/flicker do menu durante navegação
  return <>{children}</>;
};
