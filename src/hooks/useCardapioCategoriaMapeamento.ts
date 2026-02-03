import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface MapeamentoCategoria {
  id: string;
  organization_id: string;
  loja_id: string | null;
  categoria: string;
  tipo: string | null;
  item_porcionado_id: string;
  quantidade_consumida: number;
  ativo: boolean;
  created_at: string;
  // Joined data
  item_porcionado?: {
    id: string;
    nome: string;
  } | null;
}

// Grouped view: one category can have multiple linked items
export interface CategoriaAgrupada {
  categoria: string;
  tipo: string | null;
  loja_id: string | null;
  vinculos: {
    id: string;
    item_porcionado_id: string;
    item_porcionado_nome: string | null;
    quantidade_consumida: number;
  }[];
}

export function useCardapioCategoriaMapeamento(lojaId?: string) {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  // Query: Get all category mappings
  const {
    data: mapeamentosCategorias,
    isLoading: loadingCategorias,
    refetch: refetchCategorias
  } = useQuery({
    queryKey: ['cardapio-web-mapeamentos-categorias', organizationId, lojaId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from('mapeamento_cardapio_categorias')
        .select(`
          *,
          item_porcionado:itens_porcionados(id, nome)
        `)
        .eq('organization_id', organizationId)
        .eq('ativo', true)
        .order('categoria', { ascending: true });
      
      if (lojaId) {
        query = query.eq('loja_id', lojaId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MapeamentoCategoria[];
    },
    enabled: !!organizationId,
  });

  // Group by categoria for UI display
  const categoriasAgrupadas: CategoriaAgrupada[] = (() => {
    if (!mapeamentosCategorias || mapeamentosCategorias.length === 0) return [];
    
    const grouped = new Map<string, CategoriaAgrupada>();
    
    for (const m of mapeamentosCategorias) {
      const key = `${m.loja_id || 'null'}-${m.categoria}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          categoria: m.categoria,
          tipo: m.tipo,
          loja_id: m.loja_id,
          vinculos: []
        });
      }
      
      grouped.get(key)!.vinculos.push({
        id: m.id,
        item_porcionado_id: m.item_porcionado_id,
        item_porcionado_nome: m.item_porcionado?.nome || null,
        quantidade_consumida: m.quantidade_consumida
      });
    }
    
    return Array.from(grouped.values());
  })();

  // Get unique categories from existing product mappings (for suggestions)
  const {
    data: categoriasDisponiveis,
    isLoading: loadingCategoriasDisponiveis
  } = useQuery({
    queryKey: ['cardapio-web-categorias-disponiveis', organizationId, lojaId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from('mapeamento_cardapio_itens')
        .select('categoria, tipo')
        .eq('organization_id', organizationId)
        .not('categoria', 'is', null);
      
      if (lojaId) {
        query = query.eq('loja_id', lojaId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Get unique categories
      const unique = new Map<string, { categoria: string; tipo: string | null }>();
      for (const item of data || []) {
        if (item.categoria && !unique.has(item.categoria)) {
          unique.set(item.categoria, { categoria: item.categoria, tipo: item.tipo });
        }
      }
      
      return Array.from(unique.values()).sort((a, b) => a.categoria.localeCompare(b.categoria));
    },
    enabled: !!organizationId,
  });

  // Mutation: Create category mapping
  const addMapeamentoCategoria = useMutation({
    mutationFn: async ({
      loja_id,
      categoria,
      tipo,
      item_porcionado_id,
      quantidade_consumida = 1
    }: {
      loja_id: string;
      categoria: string;
      tipo: string | null;
      item_porcionado_id: string;
      quantidade_consumida?: number;
    }) => {
      if (!organizationId) throw new Error('Organização não encontrada');
      
      const { data, error } = await supabase
        .from('mapeamento_cardapio_categorias')
        .insert({
          organization_id: organizationId,
          loja_id,
          categoria,
          tipo,
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
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos-categorias'] });
      toast.success('Regra de categoria criada!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar regra de categoria:', error);
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        toast.error('Esta regra já existe para esta categoria');
      } else {
        toast.error('Erro ao criar regra de categoria');
      }
    }
  });

  // Mutation: Update category mapping
  const updateMapeamentoCategoria = useMutation({
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
        .from('mapeamento_cardapio_categorias')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos-categorias'] });
      toast.success('Regra atualizada');
    },
    onError: (error) => {
      console.error('Erro ao atualizar regra:', error);
      toast.error('Erro ao atualizar regra');
    }
  });

  // Mutation: Delete category mapping
  const deleteMapeamentoCategoria = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mapeamento_cardapio_categorias')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos-categorias'] });
      toast.success('Regra removida');
    },
    onError: (error) => {
      console.error('Erro ao remover regra:', error);
      toast.error('Erro ao remover regra');
    }
  });

  // Mutation: Delete all category mappings for a loja
  const deleteAllMapeamentosCategorias = useMutation({
    mutationFn: async (lojaId: string) => {
      if (!organizationId) throw new Error('Organização não encontrada');
      
      const { error } = await supabase
        .from('mapeamento_cardapio_categorias')
        .delete()
        .eq('organization_id', organizationId)
        .eq('loja_id', lojaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos-categorias'] });
      toast.success('Todas as regras de categoria foram removidas');
    },
    onError: (error) => {
      console.error('Erro ao remover regras:', error);
      toast.error('Erro ao remover regras');
    }
  });

  return {
    // Data
    mapeamentosCategorias: mapeamentosCategorias || [],
    categoriasAgrupadas,
    categoriasDisponiveis: categoriasDisponiveis || [],
    
    // Loading states
    loadingCategorias,
    loadingCategoriasDisponiveis,
    
    // Refetch
    refetchCategorias,
    
    // Mutations
    addMapeamentoCategoria,
    updateMapeamentoCategoria,
    deleteMapeamentoCategoria,
    deleteAllMapeamentosCategorias,
  };
}
