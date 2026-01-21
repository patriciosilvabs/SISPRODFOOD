import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  FileSearch,
  Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface ConferenciaProducaoTabProps {
  organizationId: string | null;
}

interface ProducaoConferencia {
  id: string;
  item_id: string;
  item_nome: string;
  data_fim: string;
  lotes_masseira: number;
  sequencia_traco: number | null;
  insumos: InsumoConferencia[];
}

interface InsumoConferencia {
  insumo_id: string;
  insumo_nome: string;
  esperado_kg: number;
  realizado_kg: number;
  divergencia_kg: number;
  status: 'ok' | 'falta' | 'excesso';
}

interface MovimentacaoLog {
  id: string;
  entidade_id: string;
  entidade_nome: string;
  quantidade: number;
  observacao: string | null;
  data_hora_servidor: string;
}

export const ConferenciaProducaoTab = ({ organizationId }: ConferenciaProducaoTabProps) => {
  const { isMobile } = useIsMobile();
  const [conferencias, setConferencias] = useState<ProducaoConferencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [periodoFilter, setPeriodoFilter] = useState('7');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const calcularConferencias = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const diasAtras = parseInt(periodoFilter);
      const dataInicio = subDays(new Date(), diasAtras).toISOString();

      // 1. Buscar produções finalizadas no período
      const { data: producoes, error: prodError } = await supabase
        .from('producao_registros')
        .select('id, item_id, item_nome, data_fim, lotes_masseira, sequencia_traco')
        .eq('organization_id', organizationId)
        .eq('status', 'finalizado')
        .gte('data_fim', dataInicio)
        .order('data_fim', { ascending: false });

      if (prodError) throw prodError;

      if (!producoes || producoes.length === 0) {
        setConferencias([]);
        setUltimaAtualizacao(new Date());
        return;
      }

      // 2. Buscar todos os insumos_extras para os itens das produções
      const itemIds = [...new Set(producoes.map(p => p.item_id))];
      const { data: insumosExtras, error: insumosError } = await supabase
        .from('insumos_extras')
        .select('item_porcionado_id, insumo_id, nome, quantidade, unidade')
        .in('item_porcionado_id', itemIds);

      if (insumosError) throw insumosError;

      // 3. Buscar movimentações de consumo no período
      const { data: movimentacoes, error: movError } = await supabase
        .from('movimentacoes_estoque_log')
        .select('id, entidade_id, entidade_nome, quantidade, observacao, data_hora_servidor')
        .eq('organization_id', organizationId)
        .eq('entidade_tipo', 'insumo')
        .eq('tipo_movimentacao', 'consumo_producao')
        .gte('data_hora_servidor', dataInicio)
        .order('data_hora_servidor', { ascending: false });

      if (movError) throw movError;

      // 4. Processar cada produção
      const conferenciasCalculadas: ProducaoConferencia[] = producoes.map(producao => {
        const insumosDoItem = insumosExtras?.filter(ie => ie.item_porcionado_id === producao.item_id) || [];
        const lotesMultiplier = producao.lotes_masseira || 1;

        // Calcular esperado por insumo
        const insumoMap = new Map<string, InsumoConferencia>();

        for (const insumo of insumosDoItem) {
          // Calcular quantidade esperada em kg
          let esperadoKg = 0;
          if (insumo.unidade === 'kg') {
            esperadoKg = (insumo.quantidade || 0) * lotesMultiplier;
          } else {
            // g -> kg
            esperadoKg = ((insumo.quantidade || 0) / 1000) * lotesMultiplier;
          }

          insumoMap.set(insumo.insumo_id, {
            insumo_id: insumo.insumo_id,
            insumo_nome: insumo.nome,
            esperado_kg: esperadoKg,
            realizado_kg: 0,
            divergencia_kg: 0,
            status: 'ok'
          });
        }

        // Buscar movimentações relacionadas a esta produção
        // Usa a observação para identificar (contém o nome do item)
        const movimentacoesRelacionadas = movimentacoes?.filter(m => {
          if (!m.observacao) return false;
          // Verifica se a observação menciona o item E se a data é próxima
          const mencionaItem = m.observacao.includes(producao.item_nome);
          const dataMovimentacao = new Date(m.data_hora_servidor);
          const dataFim = new Date(producao.data_fim);
          // Janela de 5 minutos antes e depois
          const dentroJanela = Math.abs(dataMovimentacao.getTime() - dataFim.getTime()) < 5 * 60 * 1000;
          return mencionaItem && dentroJanela;
        }) || [];

        // Somar quantidades realizadas por insumo
        for (const mov of movimentacoesRelacionadas) {
          const existing = insumoMap.get(mov.entidade_id);
          if (existing) {
            existing.realizado_kg += mov.quantidade;
          }
        }

        // Calcular divergência e status
        for (const insumo of insumoMap.values()) {
          insumo.divergencia_kg = insumo.esperado_kg - insumo.realizado_kg;
          
          // Tolerância de 1% para considerar OK
          const tolerancia = insumo.esperado_kg * 0.01;
          
          if (Math.abs(insumo.divergencia_kg) <= tolerancia) {
            insumo.status = 'ok';
            insumo.divergencia_kg = 0; // Zerar pequenas diferenças
          } else if (insumo.divergencia_kg > 0) {
            insumo.status = 'falta';
          } else {
            insumo.status = 'excesso';
          }
        }

        return {
          id: producao.id,
          item_id: producao.item_id,
          item_nome: producao.item_nome,
          data_fim: producao.data_fim,
          lotes_masseira: producao.lotes_masseira || 1,
          sequencia_traco: producao.sequencia_traco,
          insumos: Array.from(insumoMap.values())
        };
      });

      setConferencias(conferenciasCalculadas);
      setUltimaAtualizacao(new Date());
    } catch (error) {
      console.error('Erro ao calcular conferências:', error);
      toast.error('Erro ao carregar dados de conferência');
    } finally {
      setLoading(false);
    }
  }, [organizationId, periodoFilter]);

  useEffect(() => {
    calcularConferencias();
  }, [calcularConferencias]);

  // Filtrar conferências por status
  const conferenciasFiltradas = useMemo(() => {
    if (statusFilter === 'todos') return conferencias;
    
    return conferencias.filter(c => {
      const temDivergencia = c.insumos.some(i => i.status !== 'ok');
      if (statusFilter === 'ok') return !temDivergencia;
      if (statusFilter === 'divergencia') return temDivergencia;
      return true;
    });
  }, [conferencias, statusFilter]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = conferencias.length;
    const comDivergencia = conferencias.filter(c => c.insumos.some(i => i.status !== 'ok')).length;
    const ok = total - comDivergencia;
    
    // Calcular divergência total
    let divergenciaTotalKg = 0;
    for (const conf of conferencias) {
      for (const insumo of conf.insumos) {
        if (insumo.status === 'falta') {
          divergenciaTotalKg += insumo.divergencia_kg;
        }
      }
    }
    
    return {
      total,
      ok,
      comDivergencia,
      percentOk: total > 0 ? Math.round((ok / total) * 100) : 0,
      divergenciaTotalKg
    };
  }, [conferencias]);

  const toggleExpanded = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getStatusIcon = (status: 'ok' | 'falta' | 'excesso') => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'falta':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'excesso':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (producao: ProducaoConferencia) => {
    const temFalta = producao.insumos.some(i => i.status === 'falta');
    const temExcesso = producao.insumos.some(i => i.status === 'excesso');
    
    if (temFalta) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Falta Débito
        </Badge>
      );
    }
    if (temExcesso) {
      return (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          Débito Excedente
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-primary text-primary">
        <CheckCircle className="h-3 w-3 mr-1" />
        OK
      </Badge>
    );
  };

  if (!organizationId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Selecione uma organização para visualizar
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com filtros */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último dia</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ok">Apenas OK</SelectItem>
              <SelectItem value="divergencia">Com Divergência</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {ultimaAtualizacao && (
            <span className="text-xs text-muted-foreground">
              Atualizado: {format(ultimaAtualizacao, 'HH:mm', { locale: ptBR })}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={calcularConferencias}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-0">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Produções</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
              <FileSearch className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">OK</p>
                <p className="text-xl font-bold text-primary">{stats.ok}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Divergências</p>
                <p className="text-xl font-bold text-destructive">{stats.comDivergencia}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Taxa OK</p>
                <p className="text-xl font-bold">{stats.percentOk}%</p>
              </div>
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de divergência total */}
      {stats.divergenciaTotalKg > 0 && (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                Divergência total detectada: {stats.divergenciaTotalKg.toFixed(2)} kg de insumos não foram debitados
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de conferências */}
      <Card>
        <CardHeader className="py-3 md:py-4">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Conferência por Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
              <p>Calculando conferências...</p>
            </div>
          ) : conferenciasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSearch className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhuma produção encontrada no período</p>
            </div>
          ) : isMobile ? (
            /* Mobile: Card list with collapsible details */
            <div className="space-y-3 max-h-[60vh] overflow-auto">
              {conferenciasFiltradas.map((producao) => (
                <Collapsible 
                  key={producao.id} 
                  open={expandedRows.has(producao.id)}
                  onOpenChange={() => toggleExpanded(producao.id)}
                >
                  <Card className="p-0 overflow-hidden">
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{producao.item_nome}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{format(new Date(producao.data_fim), 'dd/MM HH:mm', { locale: ptBR })}</span>
                            {producao.sequencia_traco && (
                              <span>• Lote {producao.sequencia_traco}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(producao)}
                          {expandedRows.has(producao.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t p-3 bg-muted/30 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Insumos ({producao.lotes_masseira} lote{producao.lotes_masseira > 1 ? 's' : ''} masseira)
                        </p>
                        {producao.insumos.map((insumo) => (
                          <div 
                            key={insumo.insumo_id} 
                            className={`flex items-center justify-between p-2 rounded text-sm ${
                              insumo.status !== 'ok' ? 'bg-destructive/10' : 'bg-background'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {getStatusIcon(insumo.status)}
                              <span className="truncate">{insumo.insumo_nome}</span>
                            </div>
                            <div className="text-right text-xs">
                              <div className="font-mono">
                                <span className="text-muted-foreground">Esp: </span>
                                <span>{insumo.esperado_kg.toFixed(2)}</span>
                              </div>
                              <div className="font-mono">
                                <span className="text-muted-foreground">Real: </span>
                                <span className={insumo.status !== 'ok' ? 'text-destructive font-semibold' : ''}>
                                  {insumo.realizado_kg.toFixed(2)}
                                </span>
                              </div>
                              {insumo.status !== 'ok' && (
                                <div className="font-mono text-destructive font-semibold">
                                  Δ {insumo.divergencia_kg > 0 ? '+' : ''}{insumo.divergencia_kg.toFixed(2)} kg
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          ) : (
            /* Desktop: Table with expandable rows */
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Item Produzido</TableHead>
                    <TableHead className="text-center">Lotes</TableHead>
                    <TableHead className="text-center">Insumos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conferenciasFiltradas.map((producao) => (
                    <>
                      <TableRow 
                        key={producao.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpanded(producao.id)}
                      >
                        <TableCell className="p-2">
                          {expandedRows.has(producao.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(producao.data_fim), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {producao.item_nome}
                          {producao.sequencia_traco && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (Lote {producao.sequencia_traco})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {producao.lotes_masseira}
                        </TableCell>
                        <TableCell className="text-center">
                          {producao.insumos.length}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(producao)}
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(producao.id) && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={6} className="p-0">
                            <div className="p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Insumo</TableHead>
                                    <TableHead className="text-right">Esperado (kg)</TableHead>
                                    <TableHead className="text-right">Realizado (kg)</TableHead>
                                    <TableHead className="text-right">Divergência</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {producao.insumos.map((insumo) => (
                                    <TableRow 
                                      key={insumo.insumo_id}
                                      className={insumo.status !== 'ok' ? 'bg-destructive/10' : ''}
                                    >
                                      <TableCell>{insumo.insumo_nome}</TableCell>
                                      <TableCell className="text-right font-mono">
                                        {insumo.esperado_kg.toFixed(3)}
                                      </TableCell>
                                      <TableCell className="text-right font-mono">
                                        {insumo.realizado_kg.toFixed(3)}
                                      </TableCell>
                                      <TableCell className={`text-right font-mono font-semibold ${
                                        insumo.status === 'falta' ? 'text-destructive' : 
                                        insumo.status === 'excesso' ? 'text-muted-foreground' : ''
                                      }`}>
                                        {insumo.status !== 'ok' ? (
                                          <>
                                            {insumo.divergencia_kg > 0 ? '+' : ''}
                                            {insumo.divergencia_kg.toFixed(3)}
                                          </>
                                        ) : (
                                          '-'
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {getStatusIcon(insumo.status)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
