import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShoppingCart, CheckCircle, AlertTriangle, XCircle, ChevronDown, RefreshCw, Info } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  estoque_minimo: number;
  consumo_previsto: number;
  saldo_apos_producao: number;
  status: 'ok' | 'alerta' | 'critico';
  quantidade_comprar: number;
}

interface ResumoNecessidadeCompraProps {
  insumos: InsumoAtual[];
  organizationId: string | null;
}

export const ResumoNecessidadeCompra = ({ insumos, organizationId }: ResumoNecessidadeCompraProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [necessidades, setNecessidades] = useState<NecessidadeInsumo[]>([]);

  const calcularNecessidades = async () => {
    if (!organizationId || insumos.length === 0) return;
    
    setLoading(true);
    try {
      // 1. Buscar demandas de produção (a_produzir) das contagens
      // Incluir ontem e hoje para capturar demandas pendentes
      const hoje = new Date();
      const ontem = new Date(hoje);
      ontem.setDate(ontem.getDate() - 1);
      const dataInicio = ontem.toISOString().split('T')[0];
      
      const { data: contagens, error: contagemError } = await supabase
        .from('contagem_porcionados')
        .select('item_porcionado_id, a_produzir')
        .eq('organization_id', organizationId)
        .gte('dia_operacional', dataInicio)
        .gt('a_produzir', 0);

      if (contagemError) throw contagemError;

      // 2. Agrupar demandas por item_porcionado_id
      const demandasPorItem: Record<string, number> = {};
      (contagens || []).forEach(c => {
        if (c.item_porcionado_id && c.a_produzir) {
          demandasPorItem[c.item_porcionado_id] = 
            (demandasPorItem[c.item_porcionado_id] || 0) + c.a_produzir;
        }
      });

      const itemIds = Object.keys(demandasPorItem);
      if (itemIds.length === 0) {
        setNecessidades([]);
        setLoading(false);
        return;
      }

      // 3. Buscar vínculos insumos_extras e itens_porcionados
      const { data: insumosExtras, error: extrasError } = await supabase
        .from('insumos_extras')
        .select('item_porcionado_id, insumo_id, quantidade, escala_configuracao')
        .eq('organization_id', organizationId)
        .in('item_porcionado_id', itemIds);

      if (extrasError) throw extrasError;

      // 4. Buscar dados dos itens porcionados para equivalência de traço
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

      // 5. Calcular consumo previsto por insumo
      const consumoPorInsumo: Record<string, number> = {};
      
      (insumosExtras || []).forEach(ext => {
        if (!ext.insumo_id || !ext.item_porcionado_id) return;
        
        const demanda = demandasPorItem[ext.item_porcionado_id] || 0;
        if (demanda === 0) return;
        
        const itemConfig = itensMap[ext.item_porcionado_id];
        const quantidade = Number(ext.quantidade) || 0;
        // A quantidade no insumos_extras está em gramas, 
        // mas o estoque está em kg, então dividimos por 1000
        const quantidadeEmKg = quantidade / 1000;
        let consumo = 0;

        if (ext.escala_configuracao === 'por_unidade') {
          // Consumo por unidade produzida
          consumo = demanda * quantidadeEmKg;
        } else if (ext.escala_configuracao === 'por_lote') {
          // Consumo por lote - precisa calcular quantos lotes
          const unidadesPorLote = itemConfig?.equivalencia_traco || itemConfig?.quantidade_por_lote || 1;
          const lotes = Math.ceil(demanda / unidadesPorLote);
          consumo = lotes * quantidadeEmKg;
        } else {
          // Default: por unidade
          consumo = demanda * quantidadeEmKg;
        }

        consumoPorInsumo[ext.insumo_id] = (consumoPorInsumo[ext.insumo_id] || 0) + consumo;
      });

      // 6. Mapear para lista de necessidades
      const listaFinal: NecessidadeInsumo[] = insumos
        .filter(ins => consumoPorInsumo[ins.id] !== undefined)
        .map(ins => {
          const estoqueAtual = Number(ins.quantidade_em_estoque) || 0;
          const estoqueMinimo = Number(ins.estoque_minimo) || 0;
          const consumoPrevisto = consumoPorInsumo[ins.id] || 0;
          const saldoAposProducao = estoqueAtual - consumoPrevisto;
          
          let status: 'ok' | 'alerta' | 'critico' = 'ok';
          let quantidadeComprar = 0;

          if (saldoAposProducao <= 0) {
            status = 'critico';
            quantidadeComprar = Math.abs(saldoAposProducao) + estoqueMinimo;
          } else if (saldoAposProducao <= estoqueMinimo) {
            status = 'alerta';
            quantidadeComprar = estoqueMinimo - saldoAposProducao;
          }

          return {
            insumo_id: ins.id,
            insumo_nome: ins.nome,
            unidade: ins.unidade_medida,
            estoque_atual: estoqueAtual,
            estoque_minimo: estoqueMinimo,
            consumo_previsto: consumoPrevisto,
            saldo_apos_producao: saldoAposProducao,
            status,
            quantidade_comprar: quantidadeComprar
          };
        })
        .sort((a, b) => {
          // Ordenar: crítico primeiro, depois alerta, depois ok
          const ordem = { critico: 0, alerta: 1, ok: 2 };
          return ordem[a.status] - ordem[b.status];
        });

      setNecessidades(listaFinal);
    } catch (error) {
      console.error('Erro ao calcular necessidades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calcularNecessidades();
  }, [organizationId, insumos]);

  // Estatísticas resumidas
  const resumo = useMemo(() => {
    return {
      ok: necessidades.filter(n => n.status === 'ok').length,
      alerta: necessidades.filter(n => n.status === 'alerta').length,
      critico: necessidades.filter(n => n.status === 'critico').length,
      total: necessidades.length
    };
  }, [necessidades]);

  const getStatusBadge = (status: 'ok' | 'alerta' | 'critico', quantidadeComprar: number, unidade: string) => {
    if (status === 'critico') {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          COMPRAR {quantidadeComprar.toFixed(2)} {unidade}
        </Badge>
      );
    }
    if (status === 'alerta') {
      return (
        <Badge className="bg-amber-500 text-white gap-1">
          <AlertTriangle className="h-3 w-3" />
          Repor {quantidadeComprar.toFixed(2)} {unidade}
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

  return (
    <Card className="border-dashed border-2 border-muted-foreground/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Resumo de Necessidade de Compra</CardTitle>
                  <CardDescription className="text-xs">
                    Baseado na demanda de produção das lojas (a_produzir)
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    calcularNecessidades();
                  }}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Analisado</p>
                  <p className="text-lg font-bold">{resumo.total}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Suficiente</p>
                  <p className="text-lg font-bold text-green-600">{resumo.ok}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Alerta</p>
                  <p className="text-lg font-bold text-amber-600">{resumo.alerta}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Crítico</p>
                  <p className="text-lg font-bold text-destructive">{resumo.critico}</p>
                </div>
              </div>
            </div>

            {/* Tabela de Necessidades */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : necessidades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhuma demanda de produção encontrada</p>
                <p className="text-sm">As contagens das lojas aparecerão aqui quando houver "a_produzir" preenchido</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead>Unid.</TableHead>
                      <TableHead className="text-right">Estoque Atual</TableHead>
                      <TableHead className="text-right">Consumo Previsto</TableHead>
                      <TableHead className="text-right">Saldo Após Produção</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {necessidades.map((item) => (
                      <TableRow key={item.insumo_id} className={getRowClass(item.status)}>
                        <TableCell className="font-medium">{item.insumo_nome}</TableCell>
                        <TableCell>{item.unidade}</TableCell>
                        <TableCell className="text-right font-mono">
                          {item.estoque_atual.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-600">
                          -{item.consumo_previsto.toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${
                          item.saldo_apos_producao < 0 ? 'text-destructive' : 
                          item.saldo_apos_producao <= item.estoque_minimo ? 'text-amber-600' : 
                          'text-green-600'
                        }`}>
                          {item.saldo_apos_producao.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(item.status, item.quantidade_comprar, item.unidade)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Nota de rodapé */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Este resumo é <strong>apenas demonstrativo</strong> e não influencia nenhuma função do sistema. 
                Os cálculos são baseados nos valores de "a_produzir" das contagens das lojas e nos vínculos de insumos configurados.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
