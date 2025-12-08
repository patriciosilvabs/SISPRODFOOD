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
  perdaPercentual: number;
  pedidoEmAberto: boolean;
  romaneioEmTransito: boolean;
  bloqueado: boolean;
  motivoBloqueio: string | null;
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

  const calcularStatus = (estoqueAtual: number, consumoDiario: number, leadTime: number, pontoPedido: number, estoqueMinimo: number): UrgencyStatus => {
    if (consumoDiario === 0) return 'ok';
    
    // Regra de segurança: Se estoque <= estoque mínimo → CRÍTICO
    if (estoqueAtual <= estoqueMinimo && estoqueMinimo > 0) {
      return 'critico';
    }
    
    const estoqueNecessarioLeadTime = consumoDiario * leadTime;
    
    // Regra de segurança: Se estoque <= consumo × lead time → CRÍTICO
    if (estoqueAtual <= estoqueNecessarioLeadTime) {
      return 'critico';
    }
    if (estoqueAtual <= pontoPedido) {
      return 'urgente';
    }
    if (estoqueAtual <= pontoPedido + (consumoDiario * 2)) {
      return 'alerta';
    }
    return 'ok';
  };

  // Arredondamento inteligente baseado na unidade
  const arredondarQuantidade = (quantidade: number, unidade: string): number => {
    if (quantidade <= 0) return 0;
    
    // Unidades que devem ser arredondadas para cima (produtos fechados)
    const unidadesFechadas = ['un', 'unidade', 'unidades', 'pc', 'pcs', 'peça', 'peças', 'cx', 'caixa', 'caixas', 'fd', 'fardo', 'fardos', 'pct', 'pacote', 'pacotes'];
    
    if (unidadesFechadas.includes(unidade.toLowerCase())) {
      return Math.ceil(quantidade);
    }
    
    // Unidades fracionadas mantém uma casa decimal
    return Math.ceil(quantidade * 10) / 10;
  };

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    setError(null);

    try {
      const data30DiasAtras = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      // Buscar pedidos de compra em aberto (pendente ou em_transito)
      const { data: pedidosAbertos, error: pedidosError } = await supabase
        .from('pedidos_compra')
        .select('id')
        .eq('organization_id', organizationId)
        .in('status', ['pendente', 'em_transito']);

      if (pedidosError) throw pedidosError;

      // Buscar itens dos pedidos em aberto
      const pedidoIds = pedidosAbertos?.map(p => p.id) || [];
      let itensPedidosAbertos: Record<string, boolean> = {};
      
      if (pedidoIds.length > 0) {
        const { data: itensPedidos, error: itensPedidosError } = await supabase
          .from('pedidos_compra_itens')
          .select('produto_id')
          .in('pedido_id', pedidoIds);

        if (itensPedidosError) throw itensPedidosError;

        itensPedidos?.forEach(item => {
          itensPedidosAbertos[item.produto_id] = true;
        });
      }

      // Buscar romaneios de produtos em trânsito (pendente ou enviado)
      const { data: romaneiosEmTransito, error: romaneiosError } = await supabase
        .from('romaneios_produtos')
        .select('id')
        .eq('organization_id', organizationId)
        .in('status', ['pendente', 'enviado']);

      if (romaneiosError) throw romaneiosError;

      // Buscar itens dos romaneios em trânsito
      const romaneioIds = romaneiosEmTransito?.map(r => r.id) || [];
      let itensRomaneiosTransito: Record<string, boolean> = {};
      
      if (romaneioIds.length > 0) {
        const { data: itensRomaneios, error: itensRomError } = await supabase
          .from('romaneios_produtos_itens')
          .select('produto_id')
          .in('romaneio_id', romaneioIds);

        if (itensRomError) throw itensRomError;

        itensRomaneios?.forEach(item => {
          itensRomaneiosTransito[item.produto_id] = true;
        });
      }

      // Buscar insumos (com perda_percentual)
      const { data: insumos, error: insumosError } = await supabase
        .from('insumos')
        .select('id, nome, quantidade_em_estoque, unidade_medida, dias_cobertura_desejado, lead_time_real_dias, estoque_minimo, classificacao, perda_percentual')
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
        .select('id, nome, unidade_consumo, dias_cobertura_desejado, lead_time_real_dias, classificacao, modo_envio')
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
        const estoqueMinimo = insumo.estoque_minimo || 0;
        const perdaPercentual = insumo.perda_percentual || 0;
        
        const pontoPedido = (consumoMedioDiario * leadTime) + estoqueMinimo;
        
        // Estoque Ideal = Consumo Diário × Dias de Cobertura
        const estoqueIdeal = consumoMedioDiario * diasCobertura;
        
        // Quantidade Base = MAX(0, Estoque Ideal - Estoque Atual)
        const quantidadeBase = Math.max(0, estoqueIdeal - estoqueAtual);
        
        // Quantidade Final = Quantidade Base × (1 + Perda%)
        const quantidadeFinal = quantidadeBase * (1 + perdaPercentual / 100);
        
        const coberturaAtual = consumoMedioDiario > 0 ? estoqueAtual / consumoMedioDiario : 999;
        
        const status = calcularStatus(estoqueAtual, consumoMedioDiario, leadTime, pontoPedido, estoqueMinimo);

        // Insumos não têm pedidos/romaneios (são comprados diretamente)
        const pedidoEmAberto = false;
        const romaneioEmTransito = false;
        const bloqueado = false;

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
          quantidadeComprar: arredondarQuantidade(quantidadeFinal, insumo.unidade_medida),
          coberturaAtual: Math.round(coberturaAtual * 10) / 10,
          status,
          classificacao: insumo.classificacao || 'C',
          perdaPercentual,
          pedidoEmAberto,
          romaneioEmTransito,
          bloqueado,
          motivoBloqueio: null
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
        
        // Estoque Ideal = Consumo Diário × Dias de Cobertura
        const estoqueIdeal = consumoMedioDiario * diasCobertura;
        
        // Quantidade Base = MAX(0, Estoque Ideal - Estoque Atual)
        const quantidadeBase = Math.max(0, estoqueIdeal - estoqueAtual);
        
        // Produtos não têm perda percentual cadastrada ainda, usar 0
        const quantidadeFinal = quantidadeBase;
        
        const coberturaAtual = consumoMedioDiario > 0 ? estoqueAtual / consumoMedioDiario : 999;
        
        const status = calcularStatus(estoqueAtual, consumoMedioDiario, leadTime, pontoPedido, 0);

        // Verificar bloqueios
        const pedidoEmAberto = itensPedidosAbertos[produto.id] || false;
        const romaneioEmTransito = itensRomaneiosTransito[produto.id] || false;
        const bloqueado = pedidoEmAberto || romaneioEmTransito;
        
        let motivoBloqueio: string | null = null;
        if (pedidoEmAberto) {
          motivoBloqueio = 'Pedido em aberto';
        } else if (romaneioEmTransito) {
          motivoBloqueio = 'Em trânsito';
        }

        // Determinar unidade para arredondamento
        const unidadeProduto = produto.unidade_consumo || 'un';
        const usarArredondamentoInteiro = produto.modo_envio === 'unidade';

        listaCompras.push({
          id: produto.id,
          nome: produto.nome,
          tipo: 'produto',
          estoqueAtual,
          unidade: unidadeProduto,
          consumoMedioDiario,
          diasCobertura,
          leadTime,
          pontoPedido,
          quantidadeComprar: usarArredondamentoInteiro 
            ? Math.ceil(quantidadeFinal) 
            : arredondarQuantidade(quantidadeFinal, unidadeProduto),
          coberturaAtual: Math.round(coberturaAtual * 10) / 10,
          status,
          classificacao: produto.classificacao || 'C',
          perdaPercentual: 0,
          pedidoEmAberto,
          romaneioEmTransito,
          bloqueado,
          motivoBloqueio
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
