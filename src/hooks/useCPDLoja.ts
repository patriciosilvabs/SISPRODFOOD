import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface CPDLoja {
  id: string;
  nome: string;
  responsavel: string;
}

export const useCPDLoja = () => {
  const { organizationId } = useOrganization();
  const [cpdLoja, setCpdLoja] = useState<CPDLoja | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCPDLoja = async () => {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('lojas')
          .select('id, nome, responsavel')
          .eq('organization_id', organizationId)
          .eq('tipo', 'cpd')
          .maybeSingle();

        if (error) {
          console.error('Erro ao buscar loja CPD:', error);
          setLoading(false);
          return;
        }

        setCpdLoja(data);
      } catch (error) {
        console.error('Erro ao buscar loja CPD:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCPDLoja();
  }, [organizationId]);

  return {
    cpdLoja,
    cpdLojaId: cpdLoja?.id || null,
    loading,
  };
};
