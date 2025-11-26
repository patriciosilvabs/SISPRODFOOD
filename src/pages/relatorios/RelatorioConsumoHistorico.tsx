import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpDown, Download, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface ConsumoHistorico {
  id: string;
  data: string;
  item_nome: string;
  insumo_nome: string;
  tipo_insumo: string;
  consumo_programado: number;
  consumo_real: number;
  variacao: number;
  variacao_percentual: number;
  unidade: string;
  usuario_nome: string;
}

const RelatorioConsumoHistorico = () => {
  const [historico, setHistorico] = useState<ConsumoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState<string>('todos');
  const [insumoSelecionado, setInsumoSelecionado] = useState<string>('todos');
  const [itens, setItens] = useState<{ id: string; nome: string }[]>([]);
  const [insumos, setInsumos] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    loadFilters();
    loadHistorico();
  }, []);

  const loadFilters = async () => {
    // Carregar itens porcionados
    const { data: itensData } = await supabase
      .from('itens_porcionados')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');
    
    if (itensData) setItens(itensData);

    // Carregar insumos
    const { data: insumosData } = await supabase
      .from('insumos')
      .select('id, nome')
      .order('nome');
    
    if (insumosData) setInsumos(insumosData);
  };

  const loadHistorico = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('consumo_historico')
        .select('*')
        .order('data', { ascending: false });

      if (dataInicio) {
        query = query.gte('data', `${dataInicio}T00:00:00`);
      }
      if (dataFim) {
        query = query.lte('data', `${dataFim}T23:59:59`);
      }
      if (itemSelecionado !== 'todos') {
        query = query.eq('item_id', itemSelecionado);
      }
      if (insumoSelecionado !== 'todos') {
        query = query.eq('insumo_id', insumoSelecionado);
      }

      const { data, error } = await query;

      if (error) throw error;

      setHistorico(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico de consumo');
    } finally {
      setLoading(false);
    }
  };

  const getVariacaoColor = (percentual: number) => {
    const abs = Math.abs(percentual);
    if (abs <= 5) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950';
    if (abs <= 15) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950';
  };

  const calcularEstatisticas = () => {
    if (historico.length === 0) return { mediaVariacao: 0, maiorDesvio: 0, eficieniaMedia: 0 };

    const somaVariacao = historico.reduce((acc, item) => acc + Math.abs(item.variacao_percentual), 0);
    const mediaVariacao = somaVariacao / historico.length;

    const maiorDesvio = Math.max(...historico.map(item => Math.abs(item.variacao_percentual)));

    // Eficiência média: quanto mais próximo de 0% de variação, maior a eficiência
    const eficieniaMedia = Math.max(0, 100 - mediaVariacao);

    return { mediaVariacao, maiorDesvio, eficieniaMedia };
  };

  const exportarCSV = () => {
    const headers = ['Data', 'Item', 'Insumo', 'Tipo', 'Programado', 'Real', 'Variação', 'Variação %', 'Unidade', 'Usuário'];
    const rows = historico.map(h => [
      format(new Date(h.data), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      h.item_nome,
      h.insumo_nome,
      h.tipo_insumo,
      h.consumo_programado,
      h.consumo_real,
      h.variacao,
      h.variacao_percentual.toFixed(2),
      h.unidade,
      h.usuario_nome
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `consumo_historico_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const stats = calcularEstatisticas();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Histórico de Consumo Real vs Programado</h1>
            <p className="text-muted-foreground mt-1">
              Análise de perdas e eficiência de produção
            </p>
          </div>
          <Button onClick={exportarCSV} variant="outline" disabled={historico.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Média de Variação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-2xl font-bold">{stats.mediaVariacao.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Maior Desvio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-red-600" />
                <span className="text-2xl font-bold">{stats.maiorDesvio.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Eficiência Média</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{stats.eficieniaMedia.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Item Porcionado</Label>
                <Select value={itemSelecionado} onValueChange={setItemSelecionado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {itens.map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Insumo</Label>
                <Select value={insumoSelecionado} onValueChange={setInsumoSelecionado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {insumos.map(insumo => (
                      <SelectItem key={insumo.id} value={insumo.id}>{insumo.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={loadHistorico} className="w-full md:w-auto">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
          </CardContent>
        </Card>

        {/* Tabela de Histórico */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Consumo ({historico.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="mt-4 text-muted-foreground">Carregando...</p>
              </div>
            ) : historico.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Insumo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Programado</TableHead>
                      <TableHead className="text-right">Real</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead>Usuário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(item.data), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">{item.item_nome}</TableCell>
                        <TableCell>{item.insumo_nome}</TableCell>
                        <TableCell>
                          <Badge variant={item.tipo_insumo === 'principal' ? 'default' : 'secondary'}>
                            {item.tipo_insumo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.consumo_programado.toFixed(2)} {item.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.consumo_real.toFixed(2)} {item.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.variacao > 0 ? '+' : ''}{item.variacao.toFixed(2)} {item.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={getVariacaoColor(item.variacao_percentual)}>
                            {item.variacao_percentual > 0 ? '+' : ''}{item.variacao_percentual.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.usuario_nome}</TableCell>
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

export default RelatorioConsumoHistorico;
