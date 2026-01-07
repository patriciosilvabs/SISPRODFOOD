import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrganizationContextType {
  organizationId: string | null;
  organizationName: string | null;
  loading: boolean;
  needsOnboarding: boolean;
  subscriptionStatus: string | null;
  trialEndDate: string | null;
  subscriptionExpiresAt: string | null;
  subscriptionPlan: string | null;
  refreshOrganization: () => Promise<boolean>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const clearState = () => {
    setOrganizationId(null);
    setOrganizationName(null);
    setSubscriptionStatus(null);
    setTrialEndDate(null);
    setSubscriptionExpiresAt(null);
    setSubscriptionPlan(null);
    setNeedsOnboarding(false);
  };

  useEffect(() => {
    let isMounted = true;
    
    const fetchUserOrganization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!isMounted) return;
        
        if (!user) {
          clearState();
          setLoading(false);
          return;
        }

        // Buscar organização do usuário via organization_members com campos de assinatura
        // Usa limit(1) para suportar usuários em múltiplas organizações
        const { data: memberDataArray, error: memberError } = await supabase
          .from('organization_members')
          .select('organization_id, organizations(nome, subscription_status, trial_end_date, subscription_expires_at, subscription_plan)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const memberData = memberDataArray?.[0] || null;

        if (!isMounted) return;

        if (memberError || !memberData) {
          console.error('Erro ao buscar organização do usuário:', memberError);
          clearState();
          setNeedsOnboarding(true);
        } else {
          const org = memberData.organizations as any;
          setOrganizationId(memberData.organization_id);
          setOrganizationName(org?.nome || null);
          setSubscriptionStatus(org?.subscription_status || 'trial');
          setTrialEndDate(org?.trial_end_date || null);
          setSubscriptionExpiresAt(org?.subscription_expires_at || null);
          setSubscriptionPlan(org?.subscription_plan || null);
          setNeedsOnboarding(false);
        }
      } catch (error) {
        console.error('Erro ao carregar organização:', error);
        if (isMounted) {
          clearState();
          setNeedsOnboarding(true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Escutar mudanças de auth para re-verificar organização
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          setTimeout(() => {
            fetchUserOrganization();
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          clearState();
          setLoading(false);
        }
      }
    );

    // Chamada inicial
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          return fetchUserOrganization();
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('Erro ao obter sessão:', error);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshOrganization = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        clearState();
        return false;
      }

      const { data: memberDataArray, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(nome, subscription_status, trial_end_date, subscription_expires_at, subscription_plan)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const memberData = memberDataArray?.[0] || null;

      if (memberError || !memberData) {
        clearState();
        setNeedsOnboarding(true);
        return false;
      } else {
        const org = memberData.organizations as any;
        setOrganizationId(memberData.organization_id);
        setOrganizationName(org?.nome || null);
        setSubscriptionStatus(org?.subscription_status || 'trial');
        setTrialEndDate(org?.trial_end_date || null);
        setSubscriptionExpiresAt(org?.subscription_expires_at || null);
        setSubscriptionPlan(org?.subscription_plan || null);
        setNeedsOnboarding(false);
        return true;
      }
    } catch (error) {
      console.error('Erro ao recarregar organização:', error);
      clearState();
      setNeedsOnboarding(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <OrganizationContext.Provider value={{ 
      organizationId, 
      organizationName, 
      loading, 
      needsOnboarding,
      subscriptionStatus,
      trialEndDate,
      subscriptionExpiresAt,
      subscriptionPlan,
      refreshOrganization 
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
