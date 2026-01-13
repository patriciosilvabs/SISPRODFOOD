import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SessaoContagem {
  id: string;
  loja_id: string;
  dia_operacional: string;
  status: 'pendente' | 'em_andamento' | 'encerrada';
  iniciado_em: string | null;
  iniciado_por_nome: string | null;
  encerrado_em: string | null;
  encerrado_por_nome: string | null;
}

interface UseSessaoContagemProps {
  organizationId: string | null;
  userId: string | undefined;
  diasOperacionaisPorLoja: Record<string, string>;
}

export const useSessaoContagem = ({
  organizationId,
  userId,
  diasOperacionaisPorLoja,
}: UseSessaoContagemProps) => {
  const [sessoes, setSessoes] = useState<Record<string, SessaoContagem>>({});
  const [camposTocados, setCamposTocados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Carregar sessões existentes
  const loadSessoes = useCallback(async (lojaIds: string[]) => {
    if (!organizationId || lojaIds.length === 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessoes_contagem')
        .select('*')
        .eq('organization_id', organizationId)
        .in('loja_id', lojaIds);

      if (error) throw error;

      const sessoesMap: Record<string, SessaoContagem> = {};
      (data || []).forEach((sessao: any) => {
        // Verificar se é do dia operacional atual
        const diaOpLoja = diasOperacionaisPorLoja[sessao.loja_id];
        if (diaOpLoja === sessao.dia_operacional) {
          sessoesMap[sessao.loja_id] = sessao;
        }
      });

      setSessoes(sessoesMap);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, diasOperacionaisPorLoja]);

  // Iniciar sessão de contagem
  const iniciarSessao = async (
    lojaId: string,
    userName: string
  ): Promise<{ success: boolean }> => {
    if (!organizationId || !userId) {
      toast.error('Sessão inválida. Faça login novamente.');
      return { success: false };
    }

    const diaOperacional = diasOperacionaisPorLoja[lojaId];
    if (!diaOperacional) {
      toast.error('Dia operacional não encontrado para esta loja.');
      return { success: false };
    }

    try {
      // Criar/atualizar sessão
      const { error } = await supabase.from('sessoes_contagem').upsert(
        {
          loja_id: lojaId,
          dia_operacional: diaOperacional,
          organization_id: organizationId,
          status: 'em_andamento',
          iniciado_em: new Date().toISOString(),
          iniciado_por_id: userId,
          iniciado_por_nome: userName,
        },
        { onConflict: 'loja_id,dia_operacional' }
      );

      if (error) throw error;

      // Atualizar estado local
      setSessoes((prev) => ({
        ...prev,
        [lojaId]: {
          id: '', // Será preenchido pelo realtime ou reload
          loja_id: lojaId,
          dia_operacional: diaOperacional,
          status: 'em_andamento',
          iniciado_em: new Date().toISOString(),
          iniciado_por_nome: userName,
          encerrado_em: null,
          encerrado_por_nome: null,
        },
      }));

      // Limpar campos tocados desta loja
      setCamposTocados((prev) => {
        const newSet = new Set(prev);
        [...newSet].filter((k) => k.startsWith(lojaId)).forEach((k) => newSet.delete(k));
        return newSet;
      });

      toast.success('Sessão de contagem iniciada! Preencha todos os itens.');
      return { success: true };
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
      toast.error('Erro ao iniciar sessão de contagem.');
      return { success: false };
    }
  };

  // Encerrar sessão de contagem
  const encerrarSessao = async (
    lojaId: string,
    userName: string
  ): Promise<boolean> => {
    if (!organizationId || !userId) {
      toast.error('Sessão inválida.');
      return false;
    }

    const diaOperacional = diasOperacionaisPorLoja[lojaId];
    if (!diaOperacional) {
      toast.error('Dia operacional não encontrado.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('sessoes_contagem')
        .update({
          status: 'encerrada',
          encerrado_em: new Date().toISOString(),
          encerrado_por_id: userId,
          encerrado_por_nome: userName,
        })
        .eq('loja_id', lojaId)
        .eq('dia_operacional', diaOperacional);

      if (error) throw error;

      // Atualizar estado local
      setSessoes((prev) => ({
        ...prev,
        [lojaId]: {
          ...prev[lojaId],
          status: 'encerrada',
          encerrado_em: new Date().toISOString(),
          encerrado_por_nome: userName,
        },
      }));

      return true;
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      toast.error('Erro ao encerrar sessão.');
      return false;
    }
  };

  // Marcar campo como tocado
  const marcarCampoTocado = (lojaId: string, itemId: string, field: string) => {
    setCamposTocados((prev) => new Set([...prev, `${lojaId}-${itemId}-${field}`]));
  };

  // Verificar se campo foi tocado na sessão atual
  const isCampoTocado = (lojaId: string, itemId: string, field: string): boolean => {
    return camposTocados.has(`${lojaId}-${itemId}-${field}`);
  };

  // Verificar se todos os itens de uma loja foram preenchidos
  const todosItensPreenchidos = (lojaId: string, itemIds: string[]): boolean => {
    const sessao = sessoes[lojaId];
    if (sessao?.status !== 'em_andamento') return false;

    return itemIds.every((itemId) => isCampoTocado(lojaId, itemId, 'final_sobra'));
  };

  // Contar itens pendentes
  const contarItensPendentes = (lojaId: string, itemIds: string[]): number => {
    return itemIds.filter((itemId) => !isCampoTocado(lojaId, itemId, 'final_sobra')).length;
  };

  // Limpar campos tocados de uma loja
  const limparCamposTocados = (lojaId: string) => {
    setCamposTocados((prev) => {
      const newSet = new Set(prev);
      [...newSet].filter((k) => k.startsWith(lojaId)).forEach((k) => newSet.delete(k));
      return newSet;
    });
  };

  // Realtime subscription
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('sessoes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessoes_contagem',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'loja_id' in payload.new) {
            const newSessao = payload.new as SessaoContagem;
            // Verificar se é do dia operacional atual
            const diaOpLoja = diasOperacionaisPorLoja[newSessao.loja_id];
            if (diaOpLoja === newSessao.dia_operacional) {
              setSessoes((prev) => ({
                ...prev,
                [newSessao.loja_id]: newSessao,
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, diasOperacionaisPorLoja]);

  return {
    sessoes,
    camposTocados,
    loading,
    loadSessoes,
    iniciarSessao,
    encerrarSessao,
    marcarCampoTocado,
    isCampoTocado,
    todosItensPreenchidos,
    contarItensPendentes,
    limparCamposTocados,
  };
};
