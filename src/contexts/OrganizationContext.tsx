import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrganizationContextType {
  organizationId: string | null;
  organizationName: string | null;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserOrganization();
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
        setLoading(false);
        return;
      }

      setOrganizationId(memberData.organization_id);
      setOrganizationName((memberData.organizations as any)?.nome || null);
    } catch (error) {
      console.error('Erro ao carregar organização:', error);
      setOrganizationId(null);
      setOrganizationName(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <OrganizationContext.Provider value={{ organizationId, organizationName, loading }}>
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
