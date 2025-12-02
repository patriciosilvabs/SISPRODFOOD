import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrganizationContextType {
  organizationId: string | null;
  organizationName: string | null;
  loading: boolean;
  needsOnboarding: boolean;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchUserOrganization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!isMounted) return;
        
        if (!user) {
          setOrganizationId(null);
          setOrganizationName(null);
          setNeedsOnboarding(false);
          setLoading(false);
          return;
        }

        // Buscar organização do usuário via organization_members
        const { data: memberData, error: memberError } = await supabase
          .from('organization_members')
          .select('organization_id, organizations(nome)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (memberError || !memberData) {
          console.error('Erro ao buscar organização do usuário:', memberError);
          setOrganizationId(null);
          setOrganizationName(null);
          setNeedsOnboarding(true);
        } else {
          setOrganizationId(memberData.organization_id);
          setOrganizationName((memberData.organizations as any)?.nome || null);
          setNeedsOnboarding(false);
        }
      } catch (error) {
        console.error('Erro ao carregar organização:', error);
        if (isMounted) {
          setOrganizationId(null);
          setOrganizationName(null);
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
        
        // Só recarregar se for um evento relevante
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          // Defer fetchUserOrganization to prevent deadlock
          setTimeout(() => {
            fetchUserOrganization();
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setOrganizationId(null);
          setOrganizationName(null);
          setNeedsOnboarding(false);
          setLoading(false);
        }
      }
    );

    // Chamada inicial para garantir que loading seja false
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

  const refreshOrganization = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setOrganizationId(null);
        setOrganizationName(null);
        setNeedsOnboarding(false);
        return;
      }

      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(nome)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError || !memberData) {
        setOrganizationId(null);
        setOrganizationName(null);
        setNeedsOnboarding(true);
      } else {
        setOrganizationId(memberData.organization_id);
        setOrganizationName((memberData.organizations as any)?.nome || null);
        setNeedsOnboarding(false);
      }
    } catch (error) {
      console.error('Erro ao recarregar organização:', error);
      setOrganizationId(null);
      setOrganizationName(null);
      setNeedsOnboarding(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <OrganizationContext.Provider value={{ organizationId, organizationName, loading, needsOnboarding, refreshOrganization }}>
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
