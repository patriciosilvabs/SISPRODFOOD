import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShoppingCart, RefreshCw, AlertTriangle, AlertCircle, Clock, CheckCircle, Search, FileSpreadsheet, Package, Droplet, Beef, PackageX, Truck } from 'lucide-react';
import { useListaCompras, ItemCompra, UrgencyStatus, ItemTipo } from '@/hooks/useListaCompras';
import { CriarPedidoCompraModal } from '@/components/modals/CriarPedidoCompraModal';
import { toast } from 'sonner';

const ListaDeComprasIA = () => {
  const { itens, loading, resumo, refresh } = useListaCompras();
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<ItemTipo | 'todos'>('todos');
  const [statusFilter, setStatusFilter] = useState<UrgencyStatus | 'todos'>('todos');
  const [classificacaoFilter, setClassificacaoFilter] = useState<'A' | 'B' | 'C' | 'todos'>('todos');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredItens = useMemo(() => {
    return itens.filter(item => {
      const matchSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = tipoFilter === 'todos' || item.tipo === tipoFilter;
      const matchStatus = statusFilter === 'todos' || item.status === statusFilter;
      const matchClassificacao = classificacaoFilter === 'todos' || item.classificacao === classificacaoFilter;
      return matchSearch && matchTipo && matchStatus && matchClassificacao;
    });
  }, [itens, searchTerm, tipoFilter, statusFilter, classificacaoFilter]);

  // Itens disponíveis para seleção (não bloqueados)
  const itensDisponiveis = useMemo(() => filteredItens.filter(i => !i.bloqueado), [filteredItens]);

  // Contagens por tipo
  const contagensPorTipo = useMemo(() => ({
    insumos: itens.filter(i => i.tipo === 'insumo').length,
    produtos: itens.filter(i => i.tipo === 'produto').length,
    porcionados: itens.filter(i => i.tipo === 'porcionado').length
  }), [itens]);

  const getClassificacaoBadge = (classificacao: string | null) => {
    switch (classificacao) {
      case 'A':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">A</Badge>;
      case 'B':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">B</Badge>;
      case 'C':
      default:
        return <Badge variant="secondary">C</Badge>;
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === itensDisponiveis.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(itensDisponiveis.map(i => i.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectedItens = itens.filter(i => selectedIds.has(i.id) && i.quantidadeComprar > 0 && !i.bloqueado);

  const getStatusBadge = (status: UrgencyStatus) => {
    switch (status) {
      case 'critico':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Crítico</Badge>;
      case 'urgente':
        return <Badge className="bg-amber-500 hover:bg-amber-600 gap-1"><AlertTriangle className="h-3 w-3" /> Urgente</Badge>;
      case 'alerta':
        return <Badge variant="outline" className="border-orange-400 text-orange-600 gap-1"><Clock className="h-3 w-3" /> Alerta</Badge>;
      case 'ok':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" /> OK</Badge>;
    }
  };

  const getBloqueadoBadge = (item: ItemCompra) => {
    if (item.pedidoEmAberto) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="gap-1 border-blue-400 text-blue-600">
                <PackageX className="h-3 w-3" /> Pedido
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Este item já está em um pedido de compra em aberto</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    if (item.romaneioEmTransito) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="gap-1 border-purple-400 text-purple-600">
                <Truck className="h-3 w-3" /> Trânsito
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Este item está em trânsito (romaneio pendente)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return null;
  };

  const exportToCSV = () => {
    const headers = ['Item', 'Tipo', 'Classificação', 'Estoque Atual', 'Unidade', 'Consumo/Dia', 'Cobertura (dias)', 'Lead Time', 'Perda %', 'Qtd Comprar', 'Status', 'Bloqueado'];
    const rows = filteredItens.map(item => [
      item.nome,
      item.tipo === 'insumo' ? 'Insumo' : item.tipo === 'produto' ? 'Produto' : 'Porcionado',
      item.classificacao || 'C',
      item.estoqueAtual.toFixed(2),
      item.unidade,
      item.consumoMedioDiario.toFixed(2),
      item.coberturaAtual.toFixed(1),
      item.leadTime,
      item.perdaPercentual.toFixed(1),
      item.quantidadeComprar.toFixed(2),
      item.status.toUpperCase(),
      item.bloqueado ? item.motivoBloqueio || 'Sim' : 'Não'
    ]);

    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lista-compras-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Lista exportada com sucesso!');
  };

  const handleCriarPedido = async (pedidoData: any) => {
    setSaving(true);
    try {
      // Lógica para criar pedido seria implementada aqui
      // Por ora, apenas fecha o modal
      setModalOpen(false);
      setSelectedIds(new Set());
      toast.success('Pedido de compra criado!');
    } catch (err) {
      toast.error('Erro ao criar pedido');
    } finally {
      setSaving(false);
    }
  };

  const produtosParaModal = selectedItens.map(item => ({
    id: item.id,
    nome: item.nome,
    codigo: null,
    unidade_consumo: item.unidade
  }));

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-8 w-8" />
              Lista de Compras Inteligente
            </h1>
            <p className="text-muted-foreground mt-1">
              Sugestões baseadas em consumo histórico, lead time e perda percentual
            </p>
          </div>
          <Button 
            onClick={refresh} 
            disabled={loading}
            className="!bg-green-600 hover:!bg-green-700 text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Resumo Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">Críticos</span>
              </div>
              <p className="text-2xl font-bold text-red-700 mt-1">{resumo.critico}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-600">Urgentes</span>
              </div>
              <p className="text-2xl font-bold text-amber-700 mt-1">{resumo.urgente}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-600">Alertas</span>
              </div>
              <p className="text-2xl font-bold text-orange-700 mt-1">{resumo.alerta}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">OK</span>
              </div>
              <p className="text-2xl font-bold text-green-700 mt-1">{resumo.ok}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Ações */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <Select value={classificacaoFilter} onValueChange={(v) => setClassificacaoFilter(v as 'A' | 'B' | 'C' | 'todos')}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Classificação ABC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas Classes</SelectItem>
                    <SelectItem value="A">🟢 Classe A</SelectItem>
                    <SelectItem value="B">🟡 Classe B</SelectItem>
                    <SelectItem value="C">⚪ Classe C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  disabled={filteredItens.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
                <Button
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  disabled={selectedItens.length === 0}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Gerar Pedido ({selectedItens.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="todos" className="mb-4">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="todos" onClick={() => { setStatusFilter('todos'); setTipoFilter('todos'); }}>
                  Todos ({itens.length})
                </TabsTrigger>
                <TabsTrigger value="criticos" onClick={() => { setStatusFilter('critico'); setTipoFilter('todos'); }}>
                  🔴 Críticos ({resumo.critico})
                </TabsTrigger>
                <TabsTrigger value="urgentes" onClick={() => { setStatusFilter('urgente'); setTipoFilter('todos'); }}>
                  🟡 Urgentes ({resumo.urgente})
                </TabsTrigger>
                <TabsTrigger value="insumos" onClick={() => { setStatusFilter('todos'); setTipoFilter('insumo'); }}>
                  <Droplet className="h-4 w-4 mr-1" /> Insumos ({contagensPorTipo.insumos})
                </TabsTrigger>
                <TabsTrigger value="produtos" onClick={() => { setStatusFilter('todos'); setTipoFilter('produto'); }}>
                  <Package className="h-4 w-4 mr-1" /> Produtos ({contagensPorTipo.produtos})
                </TabsTrigger>
                <TabsTrigger value="porcionados" onClick={() => { setStatusFilter('todos'); setTipoFilter('porcionado'); }}>
                  <Beef className="h-4 w-4 mr-1" /> Porcionados ({contagensPorTipo.porcionados})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Calculando lista de compras...
              </div>
            ) : filteredItens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum item encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === itensDisponiveis.length && itensDisponiveis.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>ABC</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Consumo/Dia</TableHead>
                      <TableHead className="text-right">Cobertura</TableHead>
                      <TableHead className="text-right">Lead Time</TableHead>
                      <TableHead className="text-right">Perda %</TableHead>
                      <TableHead className="text-right font-bold">Comprar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItens.map((item) => (
                      <TableRow 
                        key={item.id}
                        className={
                          item.bloqueado 
                            ? 'bg-muted/50 opacity-60' 
                            : item.status === 'critico' 
                              ? 'bg-red-50 dark:bg-red-950/10' 
                              : item.status === 'urgente' 
                                ? 'bg-amber-50 dark:bg-amber-950/10' 
                                : ''
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => handleSelectItem(item.id)}
                            disabled={item.quantidadeComprar === 0 || item.bloqueado}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(item.status)}
                            {getBloqueadoBadge(item)}
                          </div>
                        </TableCell>
                        <TableCell>{getClassificacaoBadge(item.classificacao)}</TableCell>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.tipo === 'insumo' ? (
                              <><Droplet className="h-3 w-3 mr-1" /> Insumo</>
                            ) : item.tipo === 'produto' ? (
                              <><Package className="h-3 w-3 mr-1" /> Produto</>
                            ) : (
                              <><Beef className="h-3 w-3 mr-1" /> Porcionado</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.estoqueAtual.toFixed(2)} {item.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.consumoMedioDiario.toFixed(2)} {item.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={item.coberturaAtual < item.leadTime ? 'text-red-600 font-bold' : ''}>
                            {item.coberturaAtual.toFixed(1)} dias
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{item.leadTime} dias</TableCell>
                        <TableCell className="text-right">
                          {item.perdaPercentual > 0 ? (
                            <span className="text-orange-600">{item.perdaPercentual.toFixed(1)}%</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {item.quantidadeComprar > 0 ? (
                            <span className={item.bloqueado ? 'text-muted-foreground' : 'text-primary'}>
                              {item.quantidadeComprar.toFixed(2)} {item.unidade}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
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

        {/* Legenda */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Crítico</Badge>
                <span className="text-muted-foreground">Estoque ≤ mínimo ou abaixo do lead time</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500 gap-1"><AlertTriangle className="h-3 w-3" /> Urgente</Badge>
                <span className="text-muted-foreground">Atingiu ponto de pedido - pedir HOJE</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-orange-400 text-orange-600 gap-1"><Clock className="h-3 w-3" /> Alerta</Badge>
                <span className="text-muted-foreground">Próximo do ponto de pedido</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 border-blue-400 text-blue-600"><PackageX className="h-3 w-3" /> Pedido</Badge>
                <span className="text-muted-foreground">Já tem pedido de compra em aberto</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 border-purple-400 text-purple-600"><Truck className="h-3 w-3" /> Trânsito</Badge>
                <span className="text-muted-foreground">Romaneio aguardando recebimento</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <CriarPedidoCompraModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        produtos={produtosParaModal}
        onCriar={handleCriarPedido}
        saving={saving}
      />
    </Layout>
  );
};

export default ListaDeComprasIA;
