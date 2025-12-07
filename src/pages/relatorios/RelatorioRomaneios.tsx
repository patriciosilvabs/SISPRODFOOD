import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, CheckCircle, Clock, Truck, ArrowRightLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RomaneioUnificado {
  id: string;
  tipo: 'porcionado' | 'produto' | 'avulso';
  loja_destino_nome: string;
  loja_origem_nome?: string;
  status: string | null;
  data_criacao: string | null;
  data_envio: string | null;
  data_recebimento: string | null;
  usuario_nome: string;
  recebido_por_nome: string | null;
  tem_divergencia?: boolean;
}

const RelatorioRomaneios = () => {
  const [romaneios, setRomaneios] = useState<RomaneioUnificado[]>([]);
  const [filteredRomaneios, setFilteredRomaneios] = useState<RomaneioUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');

  useEffect(() => {
    loadRomaneios();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [romaneios, statusFilter, tipoFilter]);

  const loadRomaneios = async () => {
    try {
      setLoading(true);
      
      // Buscar romaneios de porcionados
      const { data: porcionadosData, error: porcionadosError } = await supabase
        .from('romaneios')
        .select('*')
        .order('data_criacao', { ascending: false });

      if (porcionadosError) throw porcionadosError;

      // Buscar itens dos romaneios de porcionados para verificar divergências
      const { data: itensPorcionadosData } = await supabase
        .from('romaneio_itens')
        .select('romaneio_id, quantidade, quantidade_recebida, peso_total_kg, peso_recebido_kg');

      // Buscar romaneios de produtos
      const { data: produtosData, error: produtosError } = await supabase
        .from('romaneios_produtos')
        .select('*')
        .order('data_criacao', { ascending: false });

      if (produtosError) throw produtosError;

      // Buscar itens dos romaneios de produtos para verificar divergências
      const { data: itensProdutosData } = await supabase
        .from('romaneios_produtos_itens')
        .select('romaneio_id, quantidade, quantidade_recebida, divergencia');

      // Buscar romaneios avulsos
      const { data: avulsosData, error: avulsosError } = await supabase
        .from('romaneios_avulsos')
        .select('*')
        .order('data_criacao', { ascending: false });

      if (avulsosError) throw avulsosError;

      // Buscar itens dos romaneios avulsos para verificar divergências
      const { data: itensAvulsosData } = await supabase
        .from('romaneios_avulsos_itens')
        .select('romaneio_avulso_id, quantidade, quantidade_recebida, peso_kg, peso_recebido_kg');

      // Mapear romaneios de porcionados
      const porcionadosUnificados: RomaneioUnificado[] = (porcionadosData || []).map((r) => {
        const itens = (itensPorcionadosData || []).filter((item) => item.romaneio_id === r.id);
        const temDivergencia = itens.some(
          (item) =>
            (item.quantidade_recebida !== null && item.quantidade_recebida !== item.quantidade) ||
            (item.peso_recebido_kg !== null && item.peso_recebido_kg !== item.peso_total_kg)
        );
        return {
          id: r.id,
          tipo: 'porcionado' as const,
          loja_destino_nome: r.loja_nome,
          status: r.status,
          data_criacao: r.data_criacao,
          data_envio: r.data_envio,
          data_recebimento: r.data_recebimento,
          usuario_nome: r.usuario_nome,
          recebido_por_nome: r.recebido_por_nome,
          tem_divergencia: temDivergencia,
        };
      });

      // Mapear romaneios de produtos
      const produtosUnificados: RomaneioUnificado[] = (produtosData || []).map((r) => {
        const itens = (itensProdutosData || []).filter((item) => item.romaneio_id === r.id);
        const temDivergencia = itens.some(
          (item) =>
            item.divergencia === true ||
            (item.quantidade_recebida !== null && item.quantidade_recebida !== item.quantidade)
        );
        return {
          id: r.id,
          tipo: 'produto' as const,
          loja_destino_nome: r.loja_nome,
          status: r.status,
          data_criacao: r.data_criacao,
          data_envio: r.data_envio,
          data_recebimento: r.data_recebimento,
          usuario_nome: r.usuario_nome,
          recebido_por_nome: r.recebido_por_nome,
          tem_divergencia: temDivergencia,
        };
      });

      // Mapear romaneios avulsos
      const avulsosUnificados: RomaneioUnificado[] = (avulsosData || []).map((r) => {
        const itens = (itensAvulsosData || []).filter((item) => item.romaneio_avulso_id === r.id);
        const temDivergencia = itens.some(
          (item) =>
            (item.quantidade_recebida !== null && item.quantidade_recebida !== item.quantidade) ||
            (item.peso_recebido_kg !== null && item.peso_recebido_kg !== item.peso_kg)
        );
        return {
          id: r.id,
          tipo: 'avulso' as const,
          loja_destino_nome: r.loja_destino_nome,
          loja_origem_nome: r.loja_origem_nome,
          status: r.status,
          data_criacao: r.data_criacao,
          data_envio: r.data_envio,
          data_recebimento: r.data_recebimento,
          usuario_nome: r.usuario_criacao_nome,
          recebido_por_nome: r.recebido_por_nome,
          tem_divergencia: temDivergencia,
        };
      });

      // Unificar e ordenar por data de criação
      const todosRomaneios = [
        ...porcionadosUnificados,
        ...produtosUnificados,
        ...avulsosUnificados,
      ].sort((a, b) => {
        const dataA = a.data_criacao ? new Date(a.data_criacao).getTime() : 0;
        const dataB = b.data_criacao ? new Date(b.data_criacao).getTime() : 0;
        return dataB - dataA;
      });

      setRomaneios(todosRomaneios);
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

    if (tipoFilter !== 'todos') {
      filtered = filtered.filter((r) => r.tipo === tipoFilter);
    }

    setFilteredRomaneios(filtered);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
      case 'enviado':
        return <Badge variant="default"><Truck className="mr-1 h-3 w-3" />Enviado</Badge>;
      case 'recebido':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Recebido</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const getTipoBadge = (tipo: 'porcionado' | 'produto' | 'avulso') => {
    switch (tipo) {
      case 'porcionado':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">📦 Porcionado</Badge>;
      case 'produto':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">🛒 Produto</Badge>;
      case 'avulso':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">🔄 Avulso</Badge>;
    }
  };

  const totalPendentes = romaneios.filter((r) => r.status === 'pendente').length;
  const totalEnviados = romaneios.filter((r) => r.status === 'enviado').length;
  const totalRecebidos = romaneios.filter((r) => r.status === 'recebido').length;

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
          <p className="text-muted-foreground">Histórico de envios (porcionados, produtos e avulsos)</p>
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
            <div className="flex gap-4 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="porcionado">📦 Porcionado</SelectItem>
                  <SelectItem value="produto">🛒 Produto</SelectItem>
                  <SelectItem value="avulso">🔄 Avulso</SelectItem>
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>Data Envio</TableHead>
                  <TableHead>Data Recebimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Divergência</TableHead>
                  <TableHead>Criado Por</TableHead>
                  <TableHead>Recebido Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRomaneios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nenhum romaneio encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRomaneios.map((romaneio) => (
                    <TableRow key={`${romaneio.tipo}-${romaneio.id}`}>
                      <TableCell>{getTipoBadge(romaneio.tipo)}</TableCell>
                      <TableCell className="font-medium">
                        {romaneio.tipo === 'avulso' && romaneio.loja_origem_nome ? (
                          <span className="flex items-center gap-1">
                            {romaneio.loja_origem_nome} 
                            <ArrowRightLeft className="h-3 w-3" /> 
                            {romaneio.loja_destino_nome}
                          </span>
                        ) : (
                          romaneio.loja_destino_nome
                        )}
                      </TableCell>
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
                      <TableCell>
                        {romaneio.status === 'recebido' ? (
                          romaneio.tem_divergencia ? (
                            <Badge variant="destructive">⚠️ Com Divergência</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-600">✓ OK</Badge>
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
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
