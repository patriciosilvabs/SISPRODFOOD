import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const { user, roles, loading } = useAuth();
  const { needsOnboarding, loading: orgLoading } = useOrganization();
  const { canAccess, isTrialExpired } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirecionar para auth se não estiver logado
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    // Redirecionar para onboarding se precisar (exceto se já estiver lá)
    if (!loading && !orgLoading && user && needsOnboarding && location.pathname !== '/onboarding') {
      navigate('/onboarding');
      return;
    }

    // Redirecionar para assinatura se trial expirou e não está na página de assinatura
    if (!loading && !orgLoading && user && !needsOnboarding && !canAccess && location.pathname !== '/assinatura') {
      navigate('/assinatura');
      return;
    }

    // Verificar roles após onboarding e assinatura
    if (!loading && !orgLoading && user && !needsOnboarding && canAccess && requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
      if (!hasRequiredRole) {
        navigate('/');
      }
    }
  }, [user, loading, orgLoading, needsOnboarding, canAccess, isTrialExpired, roles, requiredRoles, navigate, location.pathname]);

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

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
