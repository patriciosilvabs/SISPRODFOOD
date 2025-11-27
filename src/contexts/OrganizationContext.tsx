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
    // Escutar mudanças de auth para re-verificar organização
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await fetchUserOrganization();
        } else {
          setOrganizationId(null);
          setOrganizationName(null);
          setNeedsOnboarding(false);
          setLoading(false);
        }
      }
    );

    // Verificação inicial
    fetchUserOrganization();

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setOrganizationId(null);
        setOrganizationName(null);
        setLoading(false);
        return;
      }

      // Buscar organização do usuário via organization_members
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(nome)')
        .eq('user_id', user.id)
        .single();

      if (memberError) {
        console.error('Erro ao buscar organização do usuário:', memberError);
        setOrganizationId(null);
        setOrganizationName(null);
        setNeedsOnboarding(true); // Usuário precisa de onboarding
        setLoading(false);
        return;
      }

      setOrganizationId(memberData.organization_id);
      setOrganizationName((memberData.organizations as any)?.nome || null);
      setNeedsOnboarding(false);
    } catch (error) {
      console.error('Erro ao carregar organização:', error);
      setOrganizationId(null);
      setOrganizationName(null);
      setNeedsOnboarding(true);
    } finally {
      setLoading(false);
    }
  };

  const refreshOrganization = async () => {
    await fetchUserOrganization();
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
