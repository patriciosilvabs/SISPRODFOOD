import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, CheckCircle, Clock, Truck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Romaneio {
  id: string;
  loja_nome: string;
  status: string | null;
  data_criacao: string | null;
  data_envio: string | null;
  data_recebimento: string | null;
  usuario_nome: string;
  recebido_por_nome: string | null;
  observacao: string | null;
}

const RelatorioRomaneios = () => {
  const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
  const [filteredRomaneios, setFilteredRomaneios] = useState<Romaneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('todos');

  useEffect(() => {
    loadRomaneios();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [romaneios, statusFilter]);

  const loadRomaneios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('romaneios')
        .select('*')
        .order('data_criacao', { ascending: false });

      if (error) throw error;
      setRomaneios(data || []);
    } catch (error) {
      console.error('Erro ao carregar romaneios:', error);
      toast.error('Erro ao carregar dados de romaneios');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...romaneios];

    if (statusFilter !== 'todos') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    setFilteredRomaneios(filtered);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'PENDENTE':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
      case 'ENVIADO':
        return <Badge variant="default"><Truck className="mr-1 h-3 w-3" />Enviado</Badge>;
      case 'RECEBIDO':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Recebido</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const totalPendentes = romaneios.filter((r) => r.status === 'PENDENTE').length;
  const totalEnviados = romaneios.filter((r) => r.status === 'ENVIADO').length;
  const totalRecebidos = romaneios.filter((r) => r.status === 'RECEBIDO').length;

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
        <div>
          <h1 className="text-3xl font-bold">Relatório de Romaneios</h1>
          <p className="text-muted-foreground">Histórico de envios de porcionados e divergências</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Romaneios</p>
                  <p className="text-2xl font-bold">{romaneios.length}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-secondary">{totalPendentes}</p>
                </div>
                <Clock className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-bold text-primary">{totalEnviados}</p>
                </div>
                <Truck className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recebidos</p>
                  <p className="text-2xl font-bold text-green-600">{totalRecebidos}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="ENVIADO">Enviado</SelectItem>
                  <SelectItem value="RECEBIDO">Recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Romaneios</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>Data Envio</TableHead>
                  <TableHead>Data Recebimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado Por</TableHead>
                  <TableHead>Recebido Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRomaneios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum romaneio encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRomaneios.map((romaneio) => (
                    <TableRow key={romaneio.id}>
                      <TableCell className="font-medium">{romaneio.loja_nome}</TableCell>
                      <TableCell>
                        {romaneio.data_criacao 
                          ? format(new Date(romaneio.data_criacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {romaneio.data_envio 
                          ? format(new Date(romaneio.data_envio), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {romaneio.data_recebimento 
                          ? format(new Date(romaneio.data_recebimento), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(romaneio.status)}</TableCell>
                      <TableCell>{romaneio.usuario_nome}</TableCell>
                      <TableCell>{romaneio.recebido_por_nome || '-'}</TableCell>
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

export default RelatorioRomaneios;
