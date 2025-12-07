import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserLoja {
  loja_id: string;
  loja_nome: string;
  tipo?: string;
}

export const useUserLoja = () => {
  const [userLojas, setUserLojas] = useState<UserLoja[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserLojas = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: lojasAcesso, error } = await supabase
          .from('lojas_acesso')
          .select('loja_id, lojas(nome, tipo)')
          .eq('user_id', user.id);

        if (error) {
          console.error('Erro ao buscar lojas do usuário:', error);
          setLoading(false);
          return;
        }

        const lojas: UserLoja[] = (lojasAcesso || []).map((la: any) => ({
          loja_id: la.loja_id,
          loja_nome: la.lojas?.nome || 'Loja',
          tipo: la.lojas?.tipo || 'loja'
        }));

        setUserLojas(lojas);
      } catch (error) {
        console.error('Erro ao buscar lojas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserLojas();
  }, []);

  // Loja principal: primeira loja que não seja CPD
  const primaryLoja = userLojas.find(l => l.tipo !== 'cpd') || null;
  
  // CPD do usuário (se tiver acesso)
  const userCPD = userLojas.find(l => l.tipo === 'cpd') || null;

  return {
    userLojas,
    primaryLoja,
    userCPD,
    loading,
    hasMultipleLojas: userLojas.filter(l => l.tipo !== 'cpd').length > 1,
    hasCPDAccess: !!userCPD
  };
};
