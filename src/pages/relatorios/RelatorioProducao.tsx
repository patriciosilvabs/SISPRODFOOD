import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProducaoRegistro {
  id: string;
  item_nome: string;
  data_inicio: string;
  data_fim: string | null;
  unidades_programadas: number | null;
  unidades_reais: number | null;
  peso_programado_kg: number | null;
  peso_final_kg: number | null;
  sobra_kg: number | null;
  status: string | null;
  usuario_nome: string;
}

const RelatorioProducao = () => {
  const [registros, setRegistros] = useState<ProducaoRegistro[]>([]);
  const [filteredRegistros, setFilteredRegistros] = useState<ProducaoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  useEffect(() => {
    loadRegistros();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [registros, searchTerm, statusFilter]);

  const loadRegistros = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('producao_registros')
        .select('*')
        .order('data_inicio', { ascending: false });

      if (error) throw error;
      setRegistros(data || []);
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      toast.error('Erro ao carregar dados de produção');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...registros];

    if (searchTerm) {
      filtered = filtered.filter((r) =>
        r.item_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.usuario_nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'todos') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    setFilteredRegistros(filtered);
  };

  const exportToCSV = () => {
    const headers = [
      'Item',
      'Data Início',
      'Data Fim',
      'Unidades Programadas',
      'Unidades Reais',
      'Peso Programado (kg)',
      'Peso Final (kg)',
      'Sobra (kg)',
      'Status',
      'Usuário',
    ];

    const rows = filteredRegistros.map((r) => [
      r.item_nome,
      format(new Date(r.data_inicio), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      r.data_fim ? format(new Date(r.data_fim), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-',
      r.unidades_programadas || '-',
      r.unidades_reais || '-',
      r.peso_programado_kg || '-',
      r.peso_final_kg || '-',
      r.sobra_kg || '-',
      r.status || '-',
      r.usuario_nome,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_producao_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    link.click();
  };

  const totalProduzido = filteredRegistros.reduce((sum, r) => sum + (r.unidades_reais || 0), 0);
  const totalProgramado = filteredRegistros.reduce((sum, r) => sum + (r.unidades_programadas || 0), 0);
  const eficiencia = totalProgramado > 0 ? ((totalProduzido / totalProgramado) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando relatório...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatório de Produção</h1>
            <p className="text-muted-foreground">Histórico detalhado de toda a produção</p>
          </div>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total de Registros</p>
              <p className="text-2xl font-bold">{filteredRegistros.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Produzido</p>
              <p className="text-2xl font-bold">{totalProduzido.toLocaleString()} un</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Eficiência</p>
              <p className="text-2xl font-bold">{eficiencia}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por item ou usuário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="a_produzir">A Produzir</SelectItem>
                  <SelectItem value="em_preparo">Em Preparo</SelectItem>
                  <SelectItem value="em_porcionamento">Em Porcionamento</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Produção</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Data Fim</TableHead>
                  <TableHead className="text-right">Un. Prog.</TableHead>
                  <TableHead className="text-right">Un. Reais</TableHead>
                  <TableHead className="text-right">Peso Final</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistros.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistros.map((registro) => (
                    <TableRow key={registro.id}>
                      <TableCell className="font-medium">{registro.item_nome}</TableCell>
                      <TableCell>
                        {format(new Date(registro.data_inicio), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {registro.data_fim 
                          ? format(new Date(registro.data_fim), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">{registro.unidades_programadas || '-'}</TableCell>
                      <TableCell className="text-right">{registro.unidades_reais || '-'}</TableCell>
                      <TableCell className="text-right">
                        {registro.peso_final_kg ? `${registro.peso_final_kg} kg` : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">{registro.status?.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell>{registro.usuario_nome}</TableCell>
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

export default RelatorioProducao;
