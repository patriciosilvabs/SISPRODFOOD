import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Download, Search, Filter, RefreshCw, Package, ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CORES_MOVIMENTACAO, TipoMovimentacao } from '@/hooks/useMovimentacaoEstoque';

interface MovimentacaoLog {
  id: string;
  entidade_tipo: string;
  entidade_id: string;
  entidade_nome: string;
  tipo_movimentacao: TipoMovimentacao;
  quantidade: number;
  estoque_anterior: number;
  estoque_resultante: number;
  usuario_id: string;
  usuario_nome: string;
  unidade_origem: string;
  unidade_destino: string | null;
  observacao: string | null;
  referencia_id: string | null;
  referencia_tipo: string | null;
  data_hora_servidor: string;
}

const RelatorioMovimentacoes = () => {
  const { organizationId } = useOrganization();
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [entidadeFilter, setEntidadeFilter] = useState<string>('todos');
  const [periodoFilter, setPeriodoFilter] = useState<string>('7');

  const fetchMovimentacoes = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const dataInicio = subDays(new Date(), parseInt(periodoFilter));
      
      const { data, error } = await supabase
        .from('movimentacoes_estoque_log')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('data_hora_servidor', dataInicio.toISOString())
        .order('data_hora_servidor', { ascending: false })
        .limit(500);

      if (error) throw error;
      setMovimentacoes((data || []) as MovimentacaoLog[]);
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovimentacoes();
  }, [organizationId, periodoFilter]);

  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter(mov => {
      const matchSearch = searchTerm === '' || 
        mov.entidade_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mov.usuario_nome.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchTipo = tipoFilter === 'todos' || mov.tipo_movimentacao === tipoFilter;
      const matchEntidade = entidadeFilter === 'todos' || mov.entidade_tipo === entidadeFilter;

      return matchSearch && matchTipo && matchEntidade;
    });
  }, [movimentacoes, searchTerm, tipoFilter, entidadeFilter]);

  // Estatísticas
  const stats = useMemo(() => {
    const entradas = movimentacoesFiltradas.filter(m => 
      ['compra', 'producao', 'transferencia_entrada', 'ajuste_positivo', 'cancelamento_preparo', 'romaneio_recebimento'].includes(m.tipo_movimentacao)
    ).reduce((acc, m) => acc + m.quantidade, 0);

    const saidas = movimentacoesFiltradas.filter(m => 
      ['transferencia_saida', 'ajuste_negativo', 'perda', 'romaneio_envio', 'consumo_producao'].includes(m.tipo_movimentacao)
    ).reduce((acc, m) => acc + m.quantidade, 0);

    return {
      total: movimentacoesFiltradas.length,
      entradas,
      saidas,
    };
  }, [movimentacoesFiltradas]);

  const exportToCSV = () => {
    const headers = [
      'Data/Hora', 'Tipo Entidade', 'Nome', 'Tipo Movimentação', 
      'Quantidade', 'Estoque Anterior', 'Estoque Resultante', 
      'Usuário', 'Unidade Origem', 'Unidade Destino', 'Observação'
    ];

    const rows = movimentacoesFiltradas.map(m => [
      format(new Date(m.data_hora_servidor), 'dd/MM/yyyy HH:mm:ss'),
      m.entidade_tipo,
      m.entidade_nome,
      CORES_MOVIMENTACAO[m.tipo_movimentacao]?.label || m.tipo_movimentacao,
      m.quantidade.toString(),
      m.estoque_anterior.toString(),
      m.estoque_resultante.toString(),
      m.usuario_nome,
      m.unidade_origem,
      m.unidade_destino || '',
      m.observacao || ''
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `movimentacoes_estoque_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const renderBadge = (tipo: TipoMovimentacao) => {
    const config = CORES_MOVIMENTACAO[tipo];
    if (!config) return <Badge variant="outline">{tipo}</Badge>;
    
    return (
      <Badge className={`${config.bg} ${config.text} border-0`}>
        {config.label}
      </Badge>
    );
  };

  const renderDiferenca = (anterior: number, resultante: number) => {
    const diff = resultante - anterior;
    if (diff > 0) {
      return <span className="text-green-600 font-medium">+{diff.toFixed(2)}</span>;
    } else if (diff < 0) {
      return <span className="text-red-600 font-medium">{diff.toFixed(2)}</span>;
    }
    return <span className="text-muted-foreground">0</span>;
  };

  if (loading && movimentacoes.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <History className="h-8 w-8" />
              Histórico de Movimentações
            </h1>
            <p className="text-muted-foreground mt-1">
              Auditoria completa de todas as movimentações de estoque
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchMovimentacoes} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Total de Movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                Total Entradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.entradas.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4" />
                Total Saídas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.saidas.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por item ou usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de movimentação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="compra">Compra</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                  <SelectItem value="transferencia_entrada">Transferência (Entrada)</SelectItem>
                  <SelectItem value="transferencia_saida">Transferência (Saída)</SelectItem>
                  <SelectItem value="ajuste_positivo">Ajuste (+)</SelectItem>
                  <SelectItem value="ajuste_negativo">Ajuste (-)</SelectItem>
                  <SelectItem value="perda">Perda</SelectItem>
                  <SelectItem value="cancelamento_preparo">Cancelamento de Preparo</SelectItem>
                  <SelectItem value="romaneio_envio">Romaneio (Envio)</SelectItem>
                  <SelectItem value="romaneio_recebimento">Romaneio (Recebimento)</SelectItem>
                  <SelectItem value="consumo_producao">Consumo Produção</SelectItem>
                </SelectContent>
              </Select>
              <Select value={entidadeFilter} onValueChange={setEntidadeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os itens</SelectItem>
                  <SelectItem value="insumo">Insumos</SelectItem>
                  <SelectItem value="produto">Produtos</SelectItem>
                  <SelectItem value="porcionado">Porcionados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Último dia</SelectItem>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Movimentações */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Anterior</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoesFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        Nenhuma movimentação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    movimentacoesFiltradas.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(mov.data_hora_servidor), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{mov.entidade_nome}</div>
                            <div className="text-xs text-muted-foreground capitalize">{mov.entidade_tipo}</div>
                          </div>
                        </TableCell>
                        <TableCell>{renderBadge(mov.tipo_movimentacao)}</TableCell>
                        <TableCell className="text-right font-mono">{mov.quantidade.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {mov.estoque_anterior.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {mov.estoque_resultante.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {renderDiferenca(mov.estoque_anterior, mov.estoque_resultante)}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate" title={mov.usuario_nome}>
                          {mov.usuario_nome}
                        </TableCell>
                        <TableCell className="max-w-[100px] truncate" title={mov.unidade_origem}>
                          {mov.unidade_origem}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={mov.observacao || ''}>
                          {mov.observacao || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RelatorioMovimentacoes;
