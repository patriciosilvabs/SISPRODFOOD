import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserLoja {
  loja_id: string;
  loja_nome: string;
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
          .select('loja_id, lojas(nome)')
          .eq('user_id', user.id);

        if (error) {
          console.error('Erro ao buscar lojas do usuário:', error);
          setLoading(false);
          return;
        }

        const lojas: UserLoja[] = (lojasAcesso || []).map((la: any) => ({
          loja_id: la.loja_id,
          loja_nome: la.lojas?.nome || 'Loja'
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

  const primaryLoja = userLojas.length > 0 ? userLojas[0] : null;

  return {
    userLojas,
    primaryLoja,
    loading,
    hasMultipleLojas: userLojas.length > 1
  };
};
