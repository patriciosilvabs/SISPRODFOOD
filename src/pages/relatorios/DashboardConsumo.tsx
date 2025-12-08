import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle, 
  RefreshCw, Package, Droplet, Calendar, BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';

interface ConsumoHistorico {
  data: string;
  quantidade: number;
}

interface ItemConsumo {
  id: string;
  nome: string;
  tipo: 'insumo' | 'produto';
  estoqueAtual: number;
  unidade: string;
  consumoMedio7d: number;
  consumoMedio30d: number;
  tendencia: 'subindo' | 'estavel' | 'descendo';
  diasAteRuptura: number;
  historicoConsumo: ConsumoHistorico[];
}

const DashboardConsumo = () => {
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<ItemConsumo[]>([]);
  const [periodoGrafico, setPeriodoGrafico] = useState<'7' | '15' | '30'>('30');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'insumo' | 'produto'>('todos');
  const [itemSelecionado, setItemSelecionado] = useState<string | null>(null);

  const fetchData = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const hoje = new Date();
      const data30DiasAtras = format(subDays(hoje, 30), 'yyyy-MM-dd');
      const data7DiasAtras = format(subDays(hoje, 7), 'yyyy-MM-dd');

      // Buscar insumos
      const { data: insumos, error: insumosError } = await supabase
        .from('insumos')
        .select('id, nome, quantidade_em_estoque, unidade_medida')
        .eq('organization_id', organizationId);

      if (insumosError) throw insumosError;

      // Buscar logs de insumos (saídas)
      const { data: insumosLog, error: logError } = await supabase
        .from('insumos_log')
        .select('insumo_id, quantidade, data, tipo')
        .eq('organization_id', organizationId)
        .eq('tipo', 'saida')
        .gte('data', data30DiasAtras)
        .order('data', { ascending: true });

      if (logError) throw logError;

      // Buscar produtos
      const { data: produtos, error: produtosError } = await supabase
        .from('produtos')
        .select('id, nome, unidade_consumo')
        .eq('organization_id', organizationId)
        .eq('ativo', true);

      if (produtosError) throw produtosError;

      // Buscar estoque CPD de produtos
      const { data: estoqueCPD, error: estoqueError } = await supabase
        .from('estoque_cpd_produtos')
        .select('produto_id, quantidade')
        .eq('organization_id', organizationId);

      if (estoqueError) throw estoqueError;

      // Buscar movimentações de produtos (saídas)
      const { data: movsProdutos, error: movsError } = await supabase
        .from('movimentacoes_cpd_produtos')
        .select('produto_id, quantidade, created_at, tipo')
        .eq('organization_id', organizationId)
        .eq('tipo', 'saida')
        .gte('created_at', data30DiasAtras)
        .order('created_at', { ascending: true });

      if (movsError) throw movsError;

      const estoqueMap: Record<string, number> = {};
      estoqueCPD?.forEach(e => {
        estoqueMap[e.produto_id] = e.quantidade;
      });

      // Processar dados
      const itensProcessados: ItemConsumo[] = [];

      // Processar insumos
      insumos?.forEach(insumo => {
        const logsDoItem = insumosLog?.filter(l => l.insumo_id === insumo.id) || [];
        
        // Agrupar por dia
        const consumoPorDia: Record<string, number> = {};
        logsDoItem.forEach(log => {
          const dataStr = log.data ? format(parseISO(log.data), 'yyyy-MM-dd') : '';
          if (dataStr) {
            consumoPorDia[dataStr] = (consumoPorDia[dataStr] || 0) + Math.abs(log.quantidade);
          }
        });

        // Calcular médias
        const logs7d = logsDoItem.filter(l => l.data && l.data >= data7DiasAtras);
        const consumo7d = logs7d.reduce((sum, l) => sum + Math.abs(l.quantidade), 0);
        const consumo30d = logsDoItem.reduce((sum, l) => sum + Math.abs(l.quantidade), 0);
        
        const consumoMedio7d = consumo7d / 7;
        const consumoMedio30d = consumo30d / 30;

        // Calcular tendência
        let tendencia: 'subindo' | 'estavel' | 'descendo' = 'estavel';
        if (consumoMedio30d > 0) {
          const variacao = (consumoMedio7d - consumoMedio30d) / consumoMedio30d;
          if (variacao > 0.15) tendencia = 'subindo';
          else if (variacao < -0.15) tendencia = 'descendo';
        }

        // Dias até ruptura
        const estoqueAtual = insumo.quantidade_em_estoque || 0;
        const diasAteRuptura = consumoMedio7d > 0 ? Math.floor(estoqueAtual / consumoMedio7d) : 999;

        // Histórico para gráfico
        const historicoConsumo: ConsumoHistorico[] = [];
        const diasIntervalo = eachDayOfInterval({ start: subDays(hoje, 30), end: hoje });
        diasIntervalo.forEach(dia => {
          const dataStr = format(dia, 'yyyy-MM-dd');
          historicoConsumo.push({
            data: dataStr,
            quantidade: consumoPorDia[dataStr] || 0
          });
        });

        itensProcessados.push({
          id: insumo.id,
          nome: insumo.nome,
          tipo: 'insumo',
          estoqueAtual,
          unidade: insumo.unidade_medida,
          consumoMedio7d,
          consumoMedio30d,
          tendencia,
          diasAteRuptura,
          historicoConsumo
        });
      });

      // Processar produtos
      produtos?.forEach(produto => {
        const movsDoItem = movsProdutos?.filter(m => m.produto_id === produto.id) || [];
        
        // Agrupar por dia
        const consumoPorDia: Record<string, number> = {};
        movsDoItem.forEach(mov => {
          const dataStr = mov.created_at ? format(parseISO(mov.created_at), 'yyyy-MM-dd') : '';
          if (dataStr) {
            consumoPorDia[dataStr] = (consumoPorDia[dataStr] || 0) + Math.abs(mov.quantidade);
          }
        });

        const movs7d = movsDoItem.filter(m => m.created_at && m.created_at >= data7DiasAtras);
        const consumo7d = movs7d.reduce((sum, m) => sum + Math.abs(m.quantidade), 0);
        const consumo30d = movsDoItem.reduce((sum, m) => sum + Math.abs(m.quantidade), 0);
        
        const consumoMedio7d = consumo7d / 7;
        const consumoMedio30d = consumo30d / 30;

        let tendencia: 'subindo' | 'estavel' | 'descendo' = 'estavel';
        if (consumoMedio30d > 0) {
          const variacao = (consumoMedio7d - consumoMedio30d) / consumoMedio30d;
          if (variacao > 0.15) tendencia = 'subindo';
          else if (variacao < -0.15) tendencia = 'descendo';
        }

        const estoqueAtual = estoqueMap[produto.id] || 0;
        const diasAteRuptura = consumoMedio7d > 0 ? Math.floor(estoqueAtual / consumoMedio7d) : 999;

        const historicoConsumo: ConsumoHistorico[] = [];
        const diasIntervalo = eachDayOfInterval({ start: subDays(hoje, 30), end: hoje });
        diasIntervalo.forEach(dia => {
          const dataStr = format(dia, 'yyyy-MM-dd');
          historicoConsumo.push({
            data: dataStr,
            quantidade: consumoPorDia[dataStr] || 0
          });
        });

        itensProcessados.push({
          id: produto.id,
          nome: produto.nome,
          tipo: 'produto',
          estoqueAtual,
          unidade: produto.unidade_consumo || 'un',
          consumoMedio7d,
          consumoMedio30d,
          tendencia,
          diasAteRuptura,
          historicoConsumo
        });
      });

      // Ordenar por dias até ruptura
      itensProcessados.sort((a, b) => a.diasAteRuptura - b.diasAteRuptura);

      setItens(itensProcessados);
      if (itensProcessados.length > 0 && !itemSelecionado) {
        setItemSelecionado(itensProcessados[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const itensFiltrados = useMemo(() => {
    if (tipoFiltro === 'todos') return itens;
    return itens.filter(i => i.tipo === tipoFiltro);
  }, [itens, tipoFiltro]);

  const itemParaGrafico = useMemo(() => {
    return itens.find(i => i.id === itemSelecionado);
  }, [itens, itemSelecionado]);

  const dadosGrafico = useMemo(() => {
    if (!itemParaGrafico) return [];
    const dias = parseInt(periodoGrafico);
    return itemParaGrafico.historicoConsumo.slice(-dias).map(h => ({
      data: format(parseISO(h.data), 'dd/MM', { locale: ptBR }),
      consumo: h.quantidade
    }));
  }, [itemParaGrafico, periodoGrafico]);

  const dadosRuptura = useMemo(() => {
    return itensFiltrados
      .filter(i => i.diasAteRuptura < 30)
      .slice(0, 10)
      .map(i => ({
        nome: i.nome.length > 15 ? i.nome.substring(0, 15) + '...' : i.nome,
        dias: i.diasAteRuptura,
        cor: i.diasAteRuptura <= 3 ? 'hsl(var(--destructive))' : i.diasAteRuptura <= 7 ? 'hsl(40, 95%, 50%)' : 'hsl(var(--primary))'
      }));
  }, [itensFiltrados]);

  const resumo = useMemo(() => ({
    critico: itens.filter(i => i.diasAteRuptura <= 3).length,
    urgente: itens.filter(i => i.diasAteRuptura > 3 && i.diasAteRuptura <= 7).length,
    alerta: itens.filter(i => i.diasAteRuptura > 7 && i.diasAteRuptura <= 14).length,
    ok: itens.filter(i => i.diasAteRuptura > 14).length,
    subindo: itens.filter(i => i.tendencia === 'subindo').length,
    descendo: itens.filter(i => i.tendencia === 'descendo').length
  }), [itens]);

  const getTendenciaIcon = (tendencia: 'subindo' | 'estavel' | 'descendo') => {
    if (tendencia === 'subindo') return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (tendencia === 'descendo') return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <span className="text-muted-foreground">—</span>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Dashboard de Consumo
            </h1>
            <p className="text-muted-foreground mt-1">
              Tendências de consumo e previsão de ruptura de estoque
            </p>
          </div>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Cards Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">Crítico (≤3 dias)</span>
              </div>
              <p className="text-2xl font-bold text-red-700 mt-1">{resumo.critico}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-600">Urgente (4-7 dias)</span>
              </div>
              <p className="text-2xl font-bold text-amber-700 mt-1">{resumo.urgente}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-600">Alerta (8-14 dias)</span>
              </div>
              <p className="text-2xl font-bold text-orange-700 mt-1">{resumo.alerta}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">OK (&gt;14 dias)</span>
              </div>
              <p className="text-2xl font-bold text-green-700 mt-1">{resumo.ok}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium">Consumo Subindo</span>
              </div>
              <p className="text-2xl font-bold mt-1">{resumo.subindo}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Consumo Caindo</span>
              </div>
              <p className="text-2xl font-bold mt-1">{resumo.descendo}</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Tendência de Consumo */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Tendência de Consumo
                  </CardTitle>
                  <CardDescription>Histórico de consumo diário do item selecionado</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={periodoGrafico} onValueChange={(v) => setPeriodoGrafico(v as '7' | '15' | '30')}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Select value={itemSelecionado || ''} onValueChange={setItemSelecionado}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione um item" />
                </SelectTrigger>
                <SelectContent>
                  {itens.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.tipo === 'insumo' ? '🧪' : '📦'} {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {dadosGrafico.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dadosGrafico}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="consumo" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Consumo"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Selecione um item para ver o gráfico
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Previsão de Ruptura */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Previsão de Ruptura
              </CardTitle>
              <CardDescription>Dias até acabar o estoque (top 10 mais críticos)</CardDescription>
            </CardHeader>
            <CardContent>
              {dadosRuptura.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dadosRuptura} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 'auto']} fontSize={12} />
                    <YAxis dataKey="nome" type="category" width={100} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="dias" name="Dias até ruptura">
                      {dadosRuptura.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum item com previsão de ruptura em 30 dias
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela Detalhada */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Projeção de Estoque</CardTitle>
              <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as 'todos' | 'insumo' | 'produto')}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="insumo">🧪 Insumos</SelectItem>
                  <SelectItem value="produto">📦 Produtos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : itensFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum item encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Consumo 7d</TableHead>
                      <TableHead className="text-right">Consumo 30d</TableHead>
                      <TableHead className="text-center">Tendência</TableHead>
                      <TableHead className="text-right">Dias até Ruptura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensFiltrados.slice(0, 50).map(item => (
                      <TableRow 
                        key={item.id} 
                        className={
                          item.diasAteRuptura <= 3 
                            ? 'bg-red-50 dark:bg-red-950/10' 
                            : item.diasAteRuptura <= 7 
                              ? 'bg-amber-50 dark:bg-amber-950/10' 
                              : ''
                        }
                      >
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.tipo === 'insumo' ? (
                              <><Droplet className="h-3 w-3 mr-1" /> Insumo</>
                            ) : (
                              <><Package className="h-3 w-3 mr-1" /> Produto</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.estoqueAtual.toFixed(2)} {item.unidade}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.consumoMedio7d.toFixed(2)}/dia
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.consumoMedio30d.toFixed(2)}/dia
                        </TableCell>
                        <TableCell className="text-center">
                          {getTendenciaIcon(item.tendencia)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.diasAteRuptura >= 999 ? (
                            <span className="text-muted-foreground">∞</span>
                          ) : (
                            <Badge 
                              variant={item.diasAteRuptura <= 3 ? 'destructive' : item.diasAteRuptura <= 7 ? 'default' : 'secondary'}
                              className={item.diasAteRuptura > 3 && item.diasAteRuptura <= 7 ? 'bg-amber-500' : ''}
                            >
                              {item.diasAteRuptura} dias
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DashboardConsumo;
