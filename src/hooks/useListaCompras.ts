import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { subDays, format } from 'date-fns';

export type UrgencyStatus = 'critico' | 'urgente' | 'alerta' | 'ok';
export type ItemTipo = 'insumo' | 'produto' | 'porcionado';

export interface ItemCompra {
  id: string;
  nome: string;
  tipo: ItemTipo;
  estoqueAtual: number;
  unidade: string;
  consumoMedioDiario: number;
  diasCobertura: number;
  leadTime: number;
  pontoPedido: number;
  quantidadeComprar: number;
  coberturaAtual: number;
  status: UrgencyStatus;
  classificacao: string | null;
}

interface UseListaComprasReturn {
  itens: ItemCompra[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  resumo: {
    critico: number;
    urgente: number;
    alerta: number;
    ok: number;
  };
}

export const useListaCompras = (): UseListaComprasReturn => {
  const { organizationId } = useOrganization();
  const [itens, setItens] = useState<ItemCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calcularStatus = (estoqueAtual: number, consumoDiario: number, leadTime: number, pontoPedido: number): UrgencyStatus => {
    if (consumoDiario === 0) return 'ok';
    
    const estoqueNecessarioLeadTime = consumoDiario * leadTime;
    
    if (estoqueAtual < estoqueNecessarioLeadTime) {
      return 'critico'; // Já deveria ter pedido!
    }
    if (estoqueAtual <= pontoPedido) {
      return 'urgente'; // Pedir HOJE
    }
    if (estoqueAtual <= pontoPedido + (consumoDiario * 2)) {
      return 'alerta'; // Pedir em breve
    }
    return 'ok';
  };

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    setError(null);

    try {
      const data30DiasAtras = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      // Buscar insumos
      const { data: insumos, error: insumosError } = await supabase
        .from('insumos')
        .select('id, nome, quantidade_em_estoque, unidade_medida, dias_cobertura_desejado, lead_time_real_dias, estoque_minimo, classificacao')
        .eq('organization_id', organizationId);

      if (insumosError) throw insumosError;

      // Buscar logs de insumos dos últimos 30 dias para calcular consumo
      const { data: insumosLog, error: logError } = await supabase
        .from('insumos_log')
        .select('insumo_id, quantidade, tipo')
        .eq('organization_id', organizationId)
        .eq('tipo', 'saida')
        .gte('data', data30DiasAtras);

      if (logError) throw logError;

      // Calcular consumo médio por insumo
      const consumoInsumos: Record<string, number> = {};
      insumosLog?.forEach(log => {
        const id = log.insumo_id;
        consumoInsumos[id] = (consumoInsumos[id] || 0) + Math.abs(log.quantidade);
      });

      // Buscar produtos
      const { data: produtos, error: produtosError } = await supabase
        .from('produtos')
        .select('id, nome, unidade_consumo, dias_cobertura_desejado, lead_time_real_dias, classificacao')
        .eq('organization_id', organizationId)
        .eq('ativo', true);

      if (produtosError) throw produtosError;

      // Buscar estoque CPD de produtos
      const { data: estoqueCPD, error: estoqueError } = await supabase
        .from('estoque_cpd_produtos')
        .select('produto_id, quantidade')
        .eq('organization_id', organizationId);

      if (estoqueError) throw estoqueError;

      const estoqueMap: Record<string, number> = {};
      estoqueCPD?.forEach(e => {
        estoqueMap[e.produto_id] = e.quantidade;
      });

      // Buscar movimentações de produtos dos últimos 30 dias
      const { data: movsProdutos, error: movsError } = await supabase
        .from('movimentacoes_cpd_produtos')
        .select('produto_id, quantidade, tipo')
        .eq('organization_id', organizationId)
        .eq('tipo', 'saida')
        .gte('created_at', data30DiasAtras);

      if (movsError) throw movsError;

      const consumoProdutos: Record<string, number> = {};
      movsProdutos?.forEach(mov => {
        const id = mov.produto_id;
        consumoProdutos[id] = (consumoProdutos[id] || 0) + Math.abs(mov.quantidade);
      });

      // Montar lista de compras
      const listaCompras: ItemCompra[] = [];

      // Processar insumos
      insumos?.forEach(insumo => {
        const estoqueAtual = insumo.quantidade_em_estoque || 0;
        const consumoTotal30Dias = consumoInsumos[insumo.id] || 0;
        const consumoMedioDiario = consumoTotal30Dias / 30;
        const diasCobertura = insumo.dias_cobertura_desejado || 7;
        const leadTime = insumo.lead_time_real_dias || 2;
        const estoqueSeguranca = insumo.estoque_minimo || 0;
        
        const pontoPedido = (consumoMedioDiario * leadTime) + estoqueSeguranca;
        const quantidadeComprar = Math.max(0, (consumoMedioDiario * diasCobertura) - estoqueAtual);
        const coberturaAtual = consumoMedioDiario > 0 ? estoqueAtual / consumoMedioDiario : 999;
        
        const status = calcularStatus(estoqueAtual, consumoMedioDiario, leadTime, pontoPedido);

        listaCompras.push({
          id: insumo.id,
          nome: insumo.nome,
          tipo: 'insumo',
          estoqueAtual,
          unidade: insumo.unidade_medida,
          consumoMedioDiario,
          diasCobertura,
          leadTime,
          pontoPedido,
          quantidadeComprar: Math.ceil(quantidadeComprar * 10) / 10,
          coberturaAtual: Math.round(coberturaAtual * 10) / 10,
          status,
          classificacao: insumo.classificacao || 'C'
        });
      });

      // Processar produtos
      produtos?.forEach(produto => {
        const estoqueAtual = estoqueMap[produto.id] || 0;
        const consumoTotal30Dias = consumoProdutos[produto.id] || 0;
        const consumoMedioDiario = consumoTotal30Dias / 30;
        const diasCobertura = produto.dias_cobertura_desejado || 7;
        const leadTime = produto.lead_time_real_dias || 2;
        
        const pontoPedido = consumoMedioDiario * leadTime;
        const quantidadeComprar = Math.max(0, (consumoMedioDiario * diasCobertura) - estoqueAtual);
        const coberturaAtual = consumoMedioDiario > 0 ? estoqueAtual / consumoMedioDiario : 999;
        
        const status = calcularStatus(estoqueAtual, consumoMedioDiario, leadTime, pontoPedido);

        listaCompras.push({
          id: produto.id,
          nome: produto.nome,
          tipo: 'produto',
          estoqueAtual,
          unidade: produto.unidade_consumo || 'un',
          consumoMedioDiario,
          diasCobertura,
          leadTime,
          pontoPedido,
          quantidadeComprar: Math.ceil(quantidadeComprar * 10) / 10,
          coberturaAtual: Math.round(coberturaAtual * 10) / 10,
          status,
          classificacao: produto.classificacao || 'C'
        });
      });

      // Ordenar por urgência
      const statusOrder: Record<UrgencyStatus, number> = {
        critico: 0,
        urgente: 1,
        alerta: 2,
        ok: 3
      };

      listaCompras.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

      setItens(listaCompras);
    } catch (err: any) {
      console.error('Erro ao carregar lista de compras:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resumo = {
    critico: itens.filter(i => i.status === 'critico').length,
    urgente: itens.filter(i => i.status === 'urgente').length,
    alerta: itens.filter(i => i.status === 'alerta').length,
    ok: itens.filter(i => i.status === 'ok').length
  };

  return {
    itens,
    loading,
    error,
    refresh: fetchData,
    resumo
  };
};
