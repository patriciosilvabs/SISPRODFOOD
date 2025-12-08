import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingDown, TrendingUp, AlertCircle, Activity, Clock, User, History } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConsumoInsumo {
  insumo_id: string;
  insumo_nome: string;
  total_saidas: number;
  total_entradas: number;
  consumo_medio_diario: number;
  dias_cobertura: number;
  variacao_percentual: number;
  status: 'normal' | 'alerta' | 'critico';
  ultima_movimentacao_data: string | null;
  ultima_movimentacao_usuario: string | null;
}

interface MovimentacaoInsumo {
  id: string;
  insumo_nome: string;
  tipo: string;
  quantidade: number;
  data: string;
  usuario_nome: string;
}

const MonitoramentoConsumo = () => {
  const [consumos, setConsumos] = useState<ConsumoInsumo[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoInsumo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonitoramento();
  }, []);

  const loadMonitoramento = async () => {
    try {
      setLoading(true);

      // Buscar movimentações dos últimos 30 dias
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 30);

      const { data: logs, error: logsError } = await supabase
        .from('insumos_log')
        .select('id, insumo_id, insumo_nome, tipo, quantidade, data, usuario_nome')
        .gte('data', dataInicio.toISOString())
        .order('data', { ascending: false });

      if (logsError) throw logsError;

      // Guardar últimas 50 movimentações para exibição
      setMovimentacoes((logs || []).slice(0, 50));

      // Buscar estoque atual
      const { data: insumos, error: insumosError } = await supabase
        .from('insumos')
        .select('id, nome, quantidade_em_estoque');

      if (insumosError) throw insumosError;

      // Processar dados
      const consumoMap = new Map<string, ConsumoInsumo>();

      logs?.forEach((log) => {
        if (!consumoMap.has(log.insumo_id)) {
          consumoMap.set(log.insumo_id, {
            insumo_id: log.insumo_id,
            insumo_nome: log.insumo_nome,
            total_saidas: 0,
            total_entradas: 0,
            consumo_medio_diario: 0,
            dias_cobertura: 0,
            variacao_percentual: 0,
            status: 'normal',
            ultima_movimentacao_data: null,
            ultima_movimentacao_usuario: null,
          });
        }

        const consumo = consumoMap.get(log.insumo_id)!;
        if (log.tipo === 'saida') {
          consumo.total_saidas += Number(log.quantidade);
        } else {
          consumo.total_entradas += Number(log.quantidade);
        }

        // Guardar última movimentação (já ordenado por data desc)
        if (!consumo.ultima_movimentacao_data) {
          consumo.ultima_movimentacao_data = log.data;
          consumo.ultima_movimentacao_usuario = log.usuario_nome;
        }
      });

      // Calcular métricas
      const consumosArray: ConsumoInsumo[] = [];
      consumoMap.forEach((consumo) => {
        const insumo = insumos?.find((i) => i.id === consumo.insumo_id);
        const estoqueAtual = Number(insumo?.quantidade_em_estoque || 0);

        consumo.consumo_medio_diario = consumo.total_saidas / 30;
        consumo.dias_cobertura = consumo.consumo_medio_diario > 0 
          ? estoqueAtual / consumo.consumo_medio_diario 
          : 999;

        // Calcular variação (comparar últimos 15 dias vs 15 dias anteriores)
        consumo.variacao_percentual = 0; // Simplificado

        // Determinar status
        if (consumo.dias_cobertura < 3) {
          consumo.status = 'critico';
        } else if (consumo.dias_cobertura < 7) {
          consumo.status = 'alerta';
        }

        consumosArray.push(consumo);
      });

      // Ordenar por dias de cobertura (menor primeiro)
      consumosArray.sort((a, b) => a.dias_cobertura - b.dias_cobertura);

      setConsumos(consumosArray);
    } catch (error) {
      console.error('Erro ao carregar monitoramento:', error);
      toast.error('Erro ao carregar dados de monitoramento');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critico': return 'destructive';
      case 'alerta': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critico': return <AlertCircle className="h-4 w-4" />;
      case 'alerta': return <TrendingDown className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'entrada':
        return <Badge variant="default" className="bg-green-600">Entrada</Badge>;
      case 'saida':
        return <Badge variant="destructive">Saída</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando dados de monitoramento...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Monitoramento de Consumo (IA)</h1>
          <p className="text-muted-foreground">Análise inteligente de consumo de insumos</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Insumos</p>
                  <p className="text-2xl font-bold">{consumos.length}</p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status Crítico</p>
                  <p className="text-2xl font-bold text-destructive">
                    {consumos.filter((c) => c.status === 'critico').length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Alerta</p>
                  <p className="text-2xl font-bold text-secondary">
                    {consumos.filter((c) => c.status === 'alerta').length}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status Normal</p>
                  <p className="text-2xl font-bold text-primary">
                    {consumos.filter((c) => c.status === 'normal').length}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Monitoramento */}
        <Card>
          <CardHeader>
            <CardTitle>Análise Detalhada de Consumo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {consumos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum dado de consumo disponível nos últimos 30 dias
                </p>
              ) : (
                consumos.map((consumo) => (
                  <div
                    key={consumo.insumo_id}
                    className="flex flex-col p-4 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4 flex-1">
                        {getStatusIcon(consumo.status)}
                        <div className="flex-1">
                          <p className="font-medium">{consumo.insumo_nome}</p>
                          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                            <span>Consumo médio: {consumo.consumo_medio_diario.toFixed(2)}/dia</span>
                            <span>Total saídas: {consumo.total_saidas.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">
                            {consumo.dias_cobertura > 999 
                              ? '∞' 
                              : `${consumo.dias_cobertura.toFixed(1)} dias`}
                          </p>
                          <p className="text-xs text-muted-foreground">Cobertura</p>
                        </div>
                        <Badge variant={getStatusColor(consumo.status)}>
                          {consumo.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    {/* Data, Hora e Usuário */}
                    <div className="flex flex-wrap gap-4 pt-3 border-t text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Última movimentação: {formatDateTime(consumo.ultima_movimentacao_data)}</span>
                      </div>
                      {consumo.ultima_movimentacao_usuario && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>por {consumo.ultima_movimentacao_usuario}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Movimentações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Últimas Movimentações de Insumos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Data/Hora
                    </div>
                  </TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Usuário
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma movimentação registrada nos últimos 30 dias
                    </TableCell>
                  </TableRow>
                ) : (
                  movimentacoes.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="text-sm">{formatDateTime(mov.data)}</TableCell>
                      <TableCell className="font-medium">{mov.insumo_nome}</TableCell>
                      <TableCell>{getTipoBadge(mov.tipo)}</TableCell>
                      <TableCell className="text-right font-medium">{Number(mov.quantidade).toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{mov.usuario_nome}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MonitoramentoConsumo;