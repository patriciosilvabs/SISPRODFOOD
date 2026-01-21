import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShoppingCart, CheckCircle, AlertTriangle, XCircle, ChevronDown, RefreshCw, Info } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
interface InsumoAtual {
  id: string;
  nome: string;
  quantidade_em_estoque: number | null;
  unidade_medida: string;
  estoque_minimo: number | null;
}

interface NecessidadeInsumo {
  insumo_id: string;
  insumo_nome: string;
  unidade: string;
  estoque_atual: number;
  consumo_previsto: number;
  status: 'ok' | 'alerta' | 'critico';
}

interface ResumoNecessidadeCompraProps {
  insumos: InsumoAtual[];
  organizationId: string | null;
}

export const ResumoNecessidadeCompra = ({ insumos, organizationId }: ResumoNecessidadeCompraProps) => {
  const { isMobile } = useIsMobile();
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [necessidades, setNecessidades] = useState<NecessidadeInsumo[]>([]);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const calcularNecessidades = useCallback(async () => {
    if (!organizationId || insumos.length === 0) return;
    
    setLoading(true);
    try {
      // 1. Buscar registros de produção ATIVOS (não finalizados/cancelados)
      const { data: registrosProducao, error: registrosError } = await supabase
        .from('producao_registros')
        .select('item_id, unidades_programadas')
        .eq('organization_id', organizationId)
        .not('status', 'in', '("finalizado","concluido","expedido","cancelado")')
        .gt('unidades_programadas', 0);

      if (registrosError) throw registrosError;

      // 2. Agrupar demandas por item_id
      const demandasPorItem: Record<string, number> = {};
      (registrosProducao || []).forEach(r => {
        if (r.item_id && r.unidades_programadas) {
          demandasPorItem[r.item_id] = 
            (demandasPorItem[r.item_id] || 0) + r.unidades_programadas;
        }
      });

      const itemIds = Object.keys(demandasPorItem);
      if (itemIds.length === 0) {
        // Não há produções ativas, mas ainda mostra todos os insumos com consumo = 0
        const listaVazia: NecessidadeInsumo[] = insumos.map(ins => ({
          insumo_id: ins.id,
          insumo_nome: ins.nome,
          unidade: ins.unidade_medida,
          estoque_atual: Number(ins.quantidade_em_estoque) || 0,
          consumo_previsto: 0,
          status: 'ok' as const
        }));
        setNecessidades(listaVazia);
        setUltimaAtualizacao(new Date());
        setLoading(false);
        return;
      }

      // 3. Buscar vínculos insumos_extras para os itens em produção
      const { data: insumosExtras, error: extrasError } = await supabase
        .from('insumos_extras')
        .select('item_porcionado_id, insumo_id, quantidade, unidade, escala_configuracao')
        .eq('organization_id', organizationId)
        .in('item_porcionado_id', itemIds);

      if (extrasError) throw extrasError;

      // 4. Buscar dados dos itens porcionados para equivalência de traço/lote
      const { data: itensData, error: itensError } = await supabase
        .from('itens_porcionados')
        .select('id, equivalencia_traco, quantidade_por_lote')
        .in('id', itemIds);

      if (itensError) throw itensError;

      const itensMap: Record<string, { equivalencia_traco: number | null; quantidade_por_lote: number | null }> = {};
      (itensData || []).forEach(item => {
        itensMap[item.id] = {
          equivalencia_traco: item.equivalencia_traco,
          quantidade_por_lote: item.quantidade_por_lote
        };
      });

      // 5. Calcular consumo previsto por insumo (mesma lógica do ResumoDaProducao)
      const consumoPorInsumo: Record<string, number> = {};
      
      (insumosExtras || []).forEach(ext => {
        if (!ext.insumo_id || !ext.item_porcionado_id) return;
        
        const demanda = demandasPorItem[ext.item_porcionado_id] || 0;
        if (demanda === 0) return;
        
        const itemConfig = itensMap[ext.item_porcionado_id];
        const quantidade = Number(ext.quantidade) || 0;
        const escalaInsumo = ext.escala_configuracao || 'por_unidade';
        const unidadeInsumo = (ext.unidade || 'kg').toLowerCase();
        
        let quantidadeNecessaria = 0;

        if (escalaInsumo === 'por_lote' || escalaInsumo === 'por_traco') {
          // Insumo configurado para consumir por lote/traço
          const unidadesPorLote = itemConfig?.equivalencia_traco || itemConfig?.quantidade_por_lote || 1;
          const lotes = Math.ceil(demanda / unidadesPorLote);
          quantidadeNecessaria = lotes * quantidade;
        } else {
          // por_unidade: cada unidade produzida consome a quantidade configurada
          quantidadeNecessaria = demanda * quantidade;
        }

        // Converter gramas para kg se a unidade da receita for gramas
        // O estoque sempre está em kg
        if (unidadeInsumo === 'g') {
          quantidadeNecessaria = quantidadeNecessaria / 1000;
        }

        consumoPorInsumo[ext.insumo_id] = (consumoPorInsumo[ext.insumo_id] || 0) + quantidadeNecessaria;
      });

      // 6. Mapear para lista de necessidades (TODOS os insumos, não filtrar)
      const listaFinal: NecessidadeInsumo[] = insumos
        .map(ins => {
          const estoqueAtual = Number(ins.quantidade_em_estoque) || 0;
          const consumoPrevisto = consumoPorInsumo[ins.id] || 0;
          
          // Status baseado apenas em: consumo > estoque (só calcula se há consumo previsto)
          let status: 'ok' | 'alerta' | 'critico' = 'ok';
          if (consumoPrevisto > 0) {
            if (consumoPrevisto > estoqueAtual) {
              status = 'critico';
            } else if (consumoPrevisto > estoqueAtual * 0.8) {
              status = 'alerta';
            }
          }

          return {
            insumo_id: ins.id,
            insumo_nome: ins.nome,
            unidade: ins.unidade_medida,
            estoque_atual: estoqueAtual,
            consumo_previsto: consumoPrevisto,
            status
          };
        })
        .sort((a, b) => {
          // Primeiro: itens COM consumo previsto no topo
          if (a.consumo_previsto > 0 && b.consumo_previsto === 0) return -1;
          if (a.consumo_previsto === 0 && b.consumo_previsto > 0) return 1;
          
          // Segundo: ordenar por status (crítico primeiro)
          const ordem = { critico: 0, alerta: 1, ok: 2 };
          return ordem[a.status] - ordem[b.status];
        });

      setNecessidades(listaFinal);
      setUltimaAtualizacao(new Date());
    } catch (error) {
      console.error('Erro ao calcular necessidades:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, insumos]);

  // Função com debounce para evitar múltiplas chamadas
  const calcularComDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      calcularNecessidades();
    }, 500);
  }, [calcularNecessidades]);

  // Carregar dados iniciais
  useEffect(() => {
    calcularNecessidades();
  }, [calcularNecessidades]);

  // Realtime subscriptions
  useEffect(() => {
    if (!organizationId) return;

    // Canal para producao_registros
    const channelProducao = supabase
      .channel('producao-necessidades-compra')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'producao_registros',
          filter: `organization_id=eq.${organizationId}`
        },
        () => calcularComDebounce()
      )
      .subscribe();

    // Canal para insumos (estoque atualizado)
    const channelInsumos = supabase
      .channel('insumos-necessidades-compra')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'insumos',
          filter: `organization_id=eq.${organizationId}`
        },
        () => calcularComDebounce()
      )
      .subscribe();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channelProducao);
      supabase.removeChannel(channelInsumos);
    };
  }, [organizationId, calcularComDebounce]);

  // Formatar horário
  const formatarHorario = (data: Date) => {
    return format(data, 'HH:mm:ss');
  };

  // Estatísticas resumidas
  const resumo = useMemo(() => {
    return {
      ok: necessidades.filter(n => n.status === 'ok').length,
      alerta: necessidades.filter(n => n.status === 'alerta').length,
      critico: necessidades.filter(n => n.status === 'critico').length,
      total: necessidades.length
    };
  }, [necessidades]);

  const getStatusBadge = (status: 'ok' | 'alerta' | 'critico') => {
    if (status === 'critico') {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Insuficiente
        </Badge>
      );
    }
    if (status === 'alerta') {
      return (
        <Badge className="bg-amber-500 text-white gap-1">
          <AlertTriangle className="h-3 w-3" />
          Atenção
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-600 text-white gap-1">
        <CheckCircle className="h-3 w-3" />
        OK
      </Badge>
    );
  };

  const getRowClass = (status: 'ok' | 'alerta' | 'critico') => {
    if (status === 'critico') return 'bg-destructive/10';
    if (status === 'alerta') return 'bg-amber-500/10';
    return '';
  };

  const formatarValor = (valor: number, unidade: string) => {
    const unidadeLower = unidade.toLowerCase();
    if (unidadeLower === 'unidade' || unidadeLower === 'un') {
      return valor % 1 === 0 ? valor.toFixed(0) : valor.toFixed(2);
    }
    return valor.toFixed(2);
  };

  return (
    <Card className="border-dashed border-2 border-muted-foreground/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3 px-3 md:px-6">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2 md:gap-3">
                <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <div>
                  <CardTitle className="text-sm md:text-lg">
                    {isMobile ? 'Necessidade de Compra' : 'Resumo de Necessidade de Compra'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {ultimaAtualizacao 
                      ? `Atualizado às ${formatarHorario(ultimaAtualizacao)} • Consumo previsto`
                      : 'Consumo previsto baseado nas produções ativas'
                    }
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    calcularNecessidades();
                  }}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <ChevronDown className={`h-4 w-4 md:h-5 md:w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 md:space-y-4 px-3 md:px-6">
            {/* Cards de Resumo - Grid 2x2 no mobile */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-muted/50">
                <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-base md:text-lg font-bold">{resumo.total}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Suficiente</p>
                  <p className="text-base md:text-lg font-bold text-green-600">{resumo.ok}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Atenção</p>
                  <p className="text-base md:text-lg font-bold text-amber-600">{resumo.alerta}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-destructive/10">
                <XCircle className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Insuficiente</p>
                  <p className="text-base md:text-lg font-bold text-destructive">{resumo.critico}</p>
                </div>
              </div>
            </div>

            {/* Tabela/Cards de Necessidades */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : necessidades.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma produção ativa encontrada</p>
                <p className="text-xs">Os insumos aparecerão aqui quando houver produções</p>
              </div>
            ) : isMobile ? (
              /* Mobile: Row-based list view */
              <div className="space-y-1">
                {/* Cabeçalho */}
                <div className="grid grid-cols-[1fr_80px_80px] gap-1 px-2 py-1 text-xs text-muted-foreground font-medium">
                  <div>Insumo</div>
                  <div className="text-center">Estoque</div>
                  <div className="text-center">Consumo Prev.</div>
                </div>
                
                {/* Linhas de dados */}
                {necessidades.map((item) => (
                  <div 
                    key={item.insumo_id}
                    className={`grid grid-cols-[1fr_80px_80px] gap-1 items-center px-2 py-2 rounded-md border-l-4 ${
                      item.status === 'critico' ? 'border-l-destructive bg-destructive/10' :
                      item.status === 'alerta' ? 'border-l-amber-500 bg-amber-500/10' :
                      'border-l-green-500 bg-green-500/10'
                    }`}
                  >
                    {/* Nome do Insumo */}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.insumo_nome}</p>
                      <p className="text-xs text-muted-foreground">{item.unidade}</p>
                      {ultimaAtualizacao && (
                        <p className="text-[10px] text-muted-foreground/60">
                          Atualizado às {formatarHorario(ultimaAtualizacao)}
                        </p>
                      )}
                    </div>
                    
                    {/* Estoque */}
                    <div className="text-center bg-background rounded px-1 py-1 shadow-sm border">
                      <p className="text-[10px] text-muted-foreground">Estoque</p>
                      <p className="font-mono font-bold text-base">
                        {formatarValor(item.estoque_atual, item.unidade)}
                      </p>
                    </div>
                    
                    {/* Consumo Previsto */}
                    <div className="text-center bg-background rounded px-1 py-1 shadow-sm border">
                      <p className="text-[10px] text-amber-600">Consumo</p>
                      <p className="font-mono font-bold text-base text-amber-600">
                        {formatarValor(item.consumo_previsto, item.unidade)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: Table view */
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead>Unid.</TableHead>
                      <TableHead className="text-right">Estoque Atual</TableHead>
                      <TableHead className="text-right">Consumo Previsto</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {necessidades.map((item) => (
                      <TableRow key={item.insumo_id} className={getRowClass(item.status)}>
                        <TableCell className="font-medium">{item.insumo_nome}</TableCell>
                        <TableCell>{item.unidade}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatarValor(item.estoque_atual, item.unidade)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-600 font-semibold">
                          {formatarValor(item.consumo_previsto, item.unidade)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(item.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Nota de rodapé */}
            <div className="flex items-start gap-2 p-2 md:p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p>
                  {isMobile 
                    ? 'Consumo previsto baseado nas produções ativas.'
                    : 'Este resumo é apenas demonstrativo e mostra o consumo previsto baseado nos registros de produção ativos no Kanban.'
                  }
                </p>
                {ultimaAtualizacao && (
                  <p className="mt-1 font-medium text-foreground/70">
                    Atualizado às {formatarHorario(ultimaAtualizacao)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
