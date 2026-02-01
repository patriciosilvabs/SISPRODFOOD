import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

interface IntegracaoCardapioWeb {
  id: string;
  organization_id: string;
  loja_id: string;
  token: string;
  ambiente: 'sandbox' | 'producao';
  ativo: boolean;
  url_webhook: string | null;
  cardapio_api_key: string | null;
  created_at: string;
  updated_at: string;
}

// Interface for integration with store data
export interface IntegracaoCardapioWebComLoja extends IntegracaoCardapioWeb {
  lojas: {
    id: string;
    nome: string;
    codigo_cardapio_web: string | null;
  } | null;
}

interface MapeamentoCardapioItem {
  id: string;
  organization_id: string;
  cardapio_item_id: number;
  cardapio_item_nome: string;
  item_porcionado_id: string | null;
  quantidade_consumida: number;
  ativo: boolean;
  created_at: string;
  tipo?: string | null;
  categoria?: string | null;
  // Joined data
  item_porcionado?: {
    id: string;
    nome: string;
  } | null;
}

// Interface for grouped mappings (one product can have multiple linked items)
export interface VinculoItem {
  id: string;
  item_porcionado_id: string | null;
  item_porcionado_nome: string | null;
  quantidade_consumida: number;
}

export interface MapeamentoCardapioItemAgrupado {
  cardapio_item_id: number;
  cardapio_item_nome: string;
  tipo: string | null;
  categoria: string | null;
  vinculos: VinculoItem[];
}

export interface ImportarMapeamentoItem {
  tipo: string;
  categoria: string;
  nome: string;
  codigo_interno: number;
}

interface CardapioWebPedidoLog {
  id: string;
  organization_id: string;
  loja_id: string;
  order_id: number;
  evento: string;
  payload: Record<string, unknown>;
  itens_processados: Record<string, unknown>[] | null;
  sucesso: boolean;
  erro: string | null;
  created_at: string;
}

export function useCardapioWebIntegracao() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  // Query: Get all integrations with store data
  const {
    data: integracoes,
    isLoading: loadingIntegracoes,
    refetch: refetchIntegracoes
  } = useQuery({
    queryKey: ['cardapio-web-integracoes', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('integracoes_cardapio_web')
        .select(`
          *,
          lojas(id, nome, codigo_cardapio_web)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as IntegracaoCardapioWebComLoja[];
    },
    enabled: !!organizationId,
  });

  // Query: Get all stores (to show stores without integration)
  const {
    data: todasLojas,
    isLoading: loadingLojas,
    refetch: refetchLojas
  } = useQuery({
    queryKey: ['lojas-integracao', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('lojas')
        .select('id, nome, tipo, codigo_cardapio_web')
        .eq('organization_id', organizationId)
        .neq('tipo', 'cpd')
        .order('nome');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Query: Get mappings
  const {
    data: mapeamentos,
    isLoading: loadingMapeamentos,
    refetch: refetchMapeamentos
  } = useQuery({
    queryKey: ['cardapio-web-mapeamentos', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('mapeamento_cardapio_itens')
        .select(`
          *,
          item_porcionado:itens_porcionados(id, nome)
        `)
        .eq('organization_id', organizationId)
        .order('cardapio_item_nome', { ascending: true });
      
      if (error) throw error;
      return (data || []) as MapeamentoCardapioItem[];
    },
    enabled: !!organizationId,
  });

  // Group mappings by cardapio_item_id for UI display (one product can have multiple linked items)
  const mapeamentosAgrupados = useMemo(() => {
    if (!mapeamentos || mapeamentos.length === 0) return [];
    
    const grouped = new Map<number, MapeamentoCardapioItemAgrupado>();
    
    for (const m of mapeamentos) {
      if (!grouped.has(m.cardapio_item_id)) {
        grouped.set(m.cardapio_item_id, {
          cardapio_item_id: m.cardapio_item_id,
          cardapio_item_nome: m.cardapio_item_nome,
          tipo: m.tipo || null,
          categoria: m.categoria || null,
          vinculos: []
        });
      }
      
      grouped.get(m.cardapio_item_id)!.vinculos.push({
        id: m.id,
        item_porcionado_id: m.item_porcionado_id,
        item_porcionado_nome: m.item_porcionado?.nome || null,
        quantidade_consumida: m.quantidade_consumida
      });
    }
    
    return Array.from(grouped.values());
  }, [mapeamentos]);

  // Query: Get logs (last 50)
  const {
    data: logs,
    isLoading: loadingLogs,
    refetch: refetchLogs
  } = useQuery({
    queryKey: ['cardapio-web-logs', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('cardapio_web_pedidos_log')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return (data || []) as CardapioWebPedidoLog[];
    },
    enabled: !!organizationId,
  });

  // Generate unique token
  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 40; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  // Mutation: Create/Update integration
  const createIntegracao = useMutation({
    mutationFn: async ({ loja_id, ambiente }: { loja_id: string; ambiente: 'sandbox' | 'producao' }) => {
      if (!organizationId) throw new Error('Organização não encontrada');
      
      const token = generateToken();
      const url_webhook = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cardapio-web-webhook`;
      
      const { data, error } = await supabase
        .from('integracoes_cardapio_web')
        .upsert({
          organization_id: organizationId,
          loja_id,
          token,
          ambiente,
          ativo: true,
          url_webhook,
        }, {
          onConflict: 'organization_id,loja_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracao'] });
      toast.success('Integração configurada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar integração:', error);
      toast.error('Erro ao configurar integração');
    }
  });

  // Mutation: Update integration status
  const updateIntegracaoStatus = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('integracoes_cardapio_web')
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracao'] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  });

  // Mutation: Regenerate token
  const regenerateToken = useMutation({
    mutationFn: async (id: string) => {
      const newToken = generateToken();
      
      const { error } = await supabase
        .from('integracoes_cardapio_web')
        .update({ 
          token: newToken, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
      
      if (error) throw error;
      return newToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracao'] });
      toast.success('Token regenerado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao regenerar token:', error);
      toast.error('Erro ao regenerar token');
    }
  });

  // Mutation: Update CardápioWeb API Key
  const updateCardapioApiKey = useMutation({
    mutationFn: async ({ id, cardapio_api_key }: { id: string; cardapio_api_key: string }) => {
      const { error } = await supabase
        .from('integracoes_cardapio_web')
        .update({ 
          cardapio_api_key, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracoes'] });
    },
    onError: (error) => {
      console.error('Erro ao atualizar API Key:', error);
      throw error;
    }
  });

  // Mutation: Test connection
  const testarConexao = useMutation({
    mutationFn: async (token: string) => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cardapio-web-test`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Falha na conexão');
      }
      
      return data as { success: boolean; message: string; ambiente: string; loja: string | null };
    },
  });

  // Mutation: Add mapping
  const addMapeamento = useMutation({
    mutationFn: async ({
      cardapio_item_id,
      cardapio_item_nome,
      item_porcionado_id,
      quantidade_consumida = 1
    }: {
      cardapio_item_id: number;
      cardapio_item_nome: string;
      item_porcionado_id: string;
      quantidade_consumida?: number;
    }) => {
      if (!organizationId) throw new Error('Organização não encontrada');
      
      const { data, error } = await supabase
        .from('mapeamento_cardapio_itens')
        .insert({
          organization_id: organizationId,
          cardapio_item_id,
          cardapio_item_nome,
          item_porcionado_id,
          quantidade_consumida,
          ativo: true
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
      toast.success('Mapeamento adicionado');
    },
    onError: (error: Error) => {
      console.error('Erro ao adicionar mapeamento:', error);
      if (error.message?.includes('unique')) {
        toast.error('Este mapeamento já existe');
      } else {
        toast.error('Erro ao adicionar mapeamento');
      }
    }
  });

  // Mutation: Update mapping
  const updateMapeamento = useMutation({
    mutationFn: async ({
      id,
      quantidade_consumida,
      ativo
    }: {
      id: string;
      quantidade_consumida?: number;
      ativo?: boolean;
    }) => {
      const updates: Record<string, unknown> = {};
      if (quantidade_consumida !== undefined) updates.quantidade_consumida = quantidade_consumida;
      if (ativo !== undefined) updates.ativo = ativo;
      
      const { error } = await supabase
        .from('mapeamento_cardapio_itens')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
      toast.success('Mapeamento atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar mapeamento:', error);
      toast.error('Erro ao atualizar mapeamento');
    }
  });

  // Mutation: Delete mapping
  const deleteMapeamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mapeamento_cardapio_itens')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
      toast.success('Mapeamento removido');
    },
    onError: (error) => {
      console.error('Erro ao remover mapeamento:', error);
      toast.error('Erro ao remover mapeamento');
    }
  });

  // Mutation: Import mappings in batch (creates base records without item_porcionado_id)
  // Using insert with conflict handling - if product already exists, we skip it
  const importarMapeamentos = useMutation({
    mutationFn: async (items: ImportarMapeamentoItem[]) => {
      if (!organizationId) throw new Error('Organização não encontrada');
      
      const mappings = items.map(item => ({
        organization_id: organizationId,
        cardapio_item_id: item.codigo_interno,
        cardapio_item_nome: item.nome,
        tipo: item.tipo,
        categoria: item.categoria,
        item_porcionado_id: null,
        quantidade_consumida: 1,
        ativo: true,
      }));

      // Use upsert with new constraint (org + item_cardapio + item_porc)
      // Since item_porcionado_id is null, this will create new base records
      const { data, error } = await supabase
        .from('mapeamento_cardapio_itens')
        .upsert(mappings, {
          onConflict: 'organization_id,cardapio_item_id,item_porcionado_id',
          ignoreDuplicates: false
        })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
      toast.success(`${data.length} itens importados/atualizados com sucesso!`);
    },
    onError: (error) => {
      console.error('Erro ao importar mapeamentos:', error);
      toast.error('Erro ao importar mapeamentos');
    }
  });

  // Mutation: Add additional item link to existing product (for multiple items per product)
  const adicionarVinculo = useMutation({
    mutationFn: async ({
      cardapio_item_id,
      cardapio_item_nome,
      tipo,
      categoria,
      item_porcionado_id,
      quantidade_consumida = 1
    }: {
      cardapio_item_id: number;
      cardapio_item_nome: string;
      tipo: string | null;
      categoria: string | null;
      item_porcionado_id: string;
      quantidade_consumida?: number;
    }) => {
      if (!organizationId) throw new Error('Organização não encontrada');
      
      const { data, error } = await supabase
        .from('mapeamento_cardapio_itens')
        .insert({
          organization_id: organizationId,
          cardapio_item_id,
          cardapio_item_nome,
          tipo,
          categoria,
          item_porcionado_id,
          quantidade_consumida,
          ativo: true
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
      toast.success('Item vinculado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao adicionar vínculo:', error);
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        toast.error('Este item já está vinculado a este produto');
      } else {
        toast.error('Erro ao adicionar vínculo');
      }
    }
  });

  // Mutation: Update mapping with item porcionado link
  const vincularItemPorcionado = useMutation({
    mutationFn: async ({
      id,
      item_porcionado_id,
    }: {
      id: string;
      item_porcionado_id: string;
    }) => {
      const { error } = await supabase
        .from('mapeamento_cardapio_itens')
        .update({ item_porcionado_id })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
      toast.success('Item vinculado com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao vincular item:', error);
      toast.error('Erro ao vincular item');
    }
  });

  return {
    // Data
    integracoes: integracoes || [],
    todasLojas: todasLojas || [],
    mapeamentos: mapeamentos || [],
    mapeamentosAgrupados,
    logs: logs || [],
    
    // Loading states
    loadingIntegracoes,
    loadingLojas,
    loadingMapeamentos,
    loadingLogs,
    
    // Refetch functions
    refetchIntegracoes,
    refetchLojas,
    refetchMapeamentos,
    refetchLogs,
    
    // Mutations
    createIntegracao,
    updateIntegracaoStatus,
    regenerateToken,
    updateCardapioApiKey,
    testarConexao,
    addMapeamento,
    updateMapeamento,
    deleteMapeamento,
    importarMapeamentos,
    vincularItemPorcionado,
    adicionarVinculo,
    
    // Utils
    generateToken,
  };
}
