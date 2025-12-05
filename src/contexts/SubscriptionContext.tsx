import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useOrganization } from './OrganizationContext';

interface SubscriptionContextType {
  subscriptionStatus: string | null;
  trialEndDate: string | null;
  subscriptionExpiresAt: string | null;
  subscriptionPlan: string | null;
  daysRemaining: number | null;
  isTrialExpired: boolean;
  isSubscriptionActive: boolean;
  canAccess: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { subscriptionStatus, trialEndDate, subscriptionExpiresAt, subscriptionPlan, refreshOrganization } = useOrganization();

  const { daysRemaining, isTrialExpired, isSubscriptionActive, canAccess } = useMemo(() => {
    const now = new Date();
    
    // Calcular dias restantes do trial
    let days: number | null = null;
    let trialExpired = false;
    
    if (trialEndDate) {
      const endDate = new Date(trialEndDate);
      const diffTime = endDate.getTime() - now.getTime();
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      trialExpired = days <= 0;
    }
    
    // Verificar se assinatura está ativa
    const subActive = subscriptionStatus === 'active' && 
      (!subscriptionExpiresAt || new Date(subscriptionExpiresAt) > now);
    
    // Pode acessar se: assinatura ativa OU trial não expirado
    const access = subActive || (subscriptionStatus === 'trial' && !trialExpired);
    
    return {
      daysRemaining: days,
      isTrialExpired: trialExpired,
      isSubscriptionActive: subActive,
      canAccess: access
    };
  }, [subscriptionStatus, trialEndDate, subscriptionExpiresAt]);

  const refreshSubscription = useCallback(async () => {
    await refreshOrganization();
  }, [refreshOrganization]);

  return (
    <SubscriptionContext.Provider value={{
      subscriptionStatus,
      trialEndDate,
      subscriptionExpiresAt,
      subscriptionPlan,
      daysRemaining,
      isTrialExpired,
      isSubscriptionActive,
      canAccess,
      refreshSubscription
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
