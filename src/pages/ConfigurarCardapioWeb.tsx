import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Copy, RefreshCw, Plus, Trash2, CheckCircle, XCircle, Loader2, Settings, List, History, Eye, EyeOff, Upload, Link2 } from 'lucide-react';
import { useCardapioWebIntegracao, type ImportarMapeamentoItem, type MapeamentoCardapioItemAgrupado } from '@/hooks/useCardapioWebIntegracao';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ImportarMapeamentoCardapioModal, type ParsedCardapioItem } from '@/components/modals/ImportarMapeamentoCardapioModal';
import { AdicionarVinculoCardapioModal } from '@/components/modals/AdicionarVinculoCardapioModal';

export default function ConfigurarCardapioWeb() {
  const { organizationId } = useOrganization();
  const {
    integracao,
    mapeamentosAgrupados,
    logs,
    loadingIntegracao,
    loadingMapeamentos,
    loadingLogs,
    createIntegracao,
    updateIntegracaoStatus,
    regenerateToken,
    addMapeamento,
    deleteMapeamento,
    importarMapeamentos,
    vincularItemPorcionado,
    adicionarVinculo,
  } = useCardapioWebIntegracao();

  const [showToken, setShowToken] = useState(false);
  const [novoMapeamentoOpen, setNovoMapeamentoOpen] = useState(false);
  const [importarModalOpen, setImportarModalOpen] = useState(false);
  const [adicionarVinculoModalOpen, setAdicionarVinculoModalOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<MapeamentoCardapioItemAgrupado | null>(null);
  const [novoMapeamento, setNovoMapeamento] = useState({
    cardapio_item_id: '',
    cardapio_item_nome: '',
    item_porcionado_id: '',
    quantidade_consumida: '1',
  });
  const [selectedLojaId, setSelectedLojaId] = useState('');
  const [selectedAmbiente, setSelectedAmbiente] = useState<'sandbox' | 'producao'>('sandbox');

  // Get lojas for select
  const { data: lojas } = useQuery({
    queryKey: ['lojas', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('lojas')
        .select('id, nome, tipo')
        .eq('organization_id', organizationId)
        .neq('tipo', 'cpd')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Get itens porcionados for mapping
  const { data: itensPorcionados } = useQuery({
    queryKey: ['itens-porcionados', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('itens_porcionados')
        .select('id, nome')
        .eq('organization_id', organizationId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const handleCopyToken = () => {
    if (integracao?.token) {
      navigator.clipboard.writeText(integracao.token);
      toast.success('Token copiado!');
    }
  };

  const handleCopyWebhookUrl = () => {
    if (integracao?.url_webhook) {
      navigator.clipboard.writeText(integracao.url_webhook);
      toast.success('URL copiada!');
    }
  };

  const handleCreateIntegracao = async () => {
    if (!selectedLojaId) {
      toast.error('Selecione uma loja');
      return;
    }
    await createIntegracao.mutateAsync({
      loja_id: selectedLojaId,
      ambiente: selectedAmbiente,
    });
  };

  const handleAddMapeamento = async () => {
    const itemId = parseInt(novoMapeamento.cardapio_item_id);
    if (isNaN(itemId) || !novoMapeamento.cardapio_item_nome || !novoMapeamento.item_porcionado_id) {
      toast.error('Preencha todos os campos');
      return;
    }

    await addMapeamento.mutateAsync({
      cardapio_item_id: itemId,
      cardapio_item_nome: novoMapeamento.cardapio_item_nome,
      item_porcionado_id: novoMapeamento.item_porcionado_id,
      quantidade_consumida: parseInt(novoMapeamento.quantidade_consumida) || 1,
    });

    setNovoMapeamento({
      cardapio_item_id: '',
      cardapio_item_nome: '',
      item_porcionado_id: '',
      quantidade_consumida: '1',
    });
    setNovoMapeamentoOpen(false);
  };

  const handleImportarMapeamentos = async (items: ParsedCardapioItem[]) => {
    await importarMapeamentos.mutateAsync(items as ImportarMapeamentoItem[]);
  };

  const handleVincularItem = async (mapeamentoId: string, itemPorcionadoId: string) => {
    await vincularItemPorcionado.mutateAsync({
      id: mapeamentoId,
      item_porcionado_id: itemPorcionadoId,
    });
  };

  const handleAbrirModalVinculo = (produto: MapeamentoCardapioItemAgrupado) => {
    setProdutoSelecionado(produto);
    setAdicionarVinculoModalOpen(true);
  };

  const handleAdicionarVinculo = async (itemPorcionadoId: string, quantidade: number) => {
    if (!produtoSelecionado) return;
    
    await adicionarVinculo.mutateAsync({
      cardapio_item_id: produtoSelecionado.cardapio_item_id,
      cardapio_item_nome: produtoSelecionado.cardapio_item_nome,
      tipo: produtoSelecionado.tipo,
      categoria: produtoSelecionado.categoria,
      item_porcionado_id: itemPorcionadoId,
      quantidade_consumida: quantidade,
    });
  };

  const lojaVinculada = lojas?.find(l => l.id === integracao?.loja_id);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integração Cardápio Web</h1>
          <p className="text-muted-foreground mt-1">
            Configure a integração com o Cardápio Web para baixar automaticamente o estoque quando pedidos são feitos.
          </p>
        </div>

        <Tabs defaultValue="config" className="space-y-4">
          <TabsList>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="mapeamento" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Mapeamento
              {mapeamentosAgrupados.length > 0 && (
                <Badge variant="secondary" className="ml-1">{mapeamentosAgrupados.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Configuração Tab */}
          <TabsContent value="config" className="space-y-4">
            {loadingIntegracao ? (
              <Card>
                <CardContent className="py-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : !integracao ? (
              <Card>
                <CardHeader>
                  <CardTitle>Configurar Integração</CardTitle>
                  <CardDescription>
                    Selecione a loja que receberá os pedidos do Cardápio Web e configure o ambiente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Loja</Label>
                      <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a loja" />
                        </SelectTrigger>
                        <SelectContent>
                          {lojas?.map(loja => (
                            <SelectItem key={loja.id} value={loja.id}>
                              {loja.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Ambiente</Label>
                      <Select value={selectedAmbiente} onValueChange={(v) => setSelectedAmbiente(v as 'sandbox' | 'producao')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                          <SelectItem value="producao">Produção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    onClick={handleCreateIntegracao} 
                    disabled={!selectedLojaId || createIntegracao.isPending}
                    className="w-full"
                  >
                    {createIntegracao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar Integração
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Integração Ativa
                        <Badge variant={integracao.ativo ? 'default' : 'secondary'}>
                          {integracao.ativo ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <Badge variant="outline">
                          {integracao.ambiente === 'producao' ? 'Produção' : 'Sandbox'}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Loja: <strong>{lojaVinculada?.nome || 'Não encontrada'}</strong>
                      </CardDescription>
                    </div>
                    <Switch
                      checked={integracao.ativo}
                      onCheckedChange={(ativo) => updateIntegracaoStatus.mutate({ id: integracao.id, ativo })}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Webhook URL */}
                  <div className="space-y-2">
                    <Label>URL do Webhook</Label>
                    <p className="text-xs text-muted-foreground">
                      Configure esta URL no painel do Cardápio Web para receber os pedidos.
                    </p>
                    <div className="flex gap-2">
                      <Input 
                        value={integracao.url_webhook || ''} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" size="icon" onClick={handleCopyWebhookUrl}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Token/API Key */}
                  <div className="space-y-2">
                    <Label>Token (X-API-KEY)</Label>
                    <p className="text-xs text-muted-foreground">
                      Use este token no header X-API-KEY das requisições do Cardápio Web.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          type={showToken ? 'text' : 'password'}
                          value={integracao.token} 
                          readOnly 
                          className="font-mono text-sm pr-10"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowToken(!showToken)}
                        >
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button variant="outline" size="icon" onClick={handleCopyToken}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Regenerar Token?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O token atual será invalidado e você precisará atualizar a configuração no Cardápio Web.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => regenerateToken.mutate(integracao.id)}>
                              Regenerar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Instruções */}
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <h4 className="font-semibold mb-2">Como configurar no Cardápio Web:</h4>
                    <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                      <li>Acesse o painel do Cardápio Web</li>
                      <li>Vá em Configurações → Integrações → Webhooks</li>
                      <li>Adicione a URL do webhook acima</li>
                      <li>Configure o header <code className="bg-muted px-1 rounded">X-API-KEY</code> com o token</li>
                      <li>Selecione o evento <code className="bg-muted px-1 rounded">order.created</code></li>
                      <li>Salve e teste a conexão</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Mapeamento Tab */}
          <TabsContent value="mapeamento" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mapeamento de Produtos</CardTitle>
                    <CardDescription>
                      Configure quais itens porcionados são consumidos para cada produto do cardápio.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setImportarModalOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Arquivo
                    </Button>
                    <Dialog open={novoMapeamentoOpen} onOpenChange={setNovoMapeamentoOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Mapeamento</DialogTitle>
                        <DialogDescription>
                          Vincule um produto do Cardápio Web a um item porcionado.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>ID do Produto (Cardápio Web)</Label>
                            <Input
                              type="number"
                              placeholder="Ex: 123"
                              value={novoMapeamento.cardapio_item_id}
                              onChange={(e) => setNovoMapeamento({
                                ...novoMapeamento,
                                cardapio_item_id: e.target.value
                              })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Nome do Produto</Label>
                            <Input
                              placeholder="Ex: Pizza Mussarela G"
                              value={novoMapeamento.cardapio_item_nome}
                              onChange={(e) => setNovoMapeamento({
                                ...novoMapeamento,
                                cardapio_item_nome: e.target.value
                              })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Item Porcionado</Label>
                          <Select
                            value={novoMapeamento.item_porcionado_id}
                            onValueChange={(v) => setNovoMapeamento({
                              ...novoMapeamento,
                              item_porcionado_id: v
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o item" />
                            </SelectTrigger>
                            <SelectContent>
                              {itensPorcionados?.map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Quantidade Consumida</Label>
                          <Input
                            type="number"
                            min="1"
                            value={novoMapeamento.quantidade_consumida}
                            onChange={(e) => setNovoMapeamento({
                              ...novoMapeamento,
                              quantidade_consumida: e.target.value
                            })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Quantos itens porcionados são consumidos por unidade do produto
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNovoMapeamentoOpen(false)}>
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleAddMapeamento}
                          disabled={addMapeamento.isPending}
                        >
                          {addMapeamento.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Adicionar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingMapeamentos ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : mapeamentosAgrupados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum mapeamento configurado</p>
                    <p className="text-sm">Adicione mapeamentos para vincular produtos do cardápio aos itens porcionados</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-24">Código</TableHead>
                        <TableHead>Itens Vinculados</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mapeamentosAgrupados.map((produto) => (
                        <TableRow key={produto.cardapio_item_id}>
                          <TableCell>
                            {produto.tipo && (
                              <Badge variant={produto.tipo === 'PRODUTO' ? 'default' : 'secondary'} className="text-xs">
                                {produto.tipo}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-32 truncate text-sm" title={produto.categoria || ''}>
                            {produto.categoria || '-'}
                          </TableCell>
                          <TableCell className="max-w-40 truncate" title={produto.cardapio_item_nome}>
                            {produto.cardapio_item_nome}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{produto.cardapio_item_id}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {produto.vinculos.length === 0 || (produto.vinculos.length === 1 && !produto.vinculos[0].item_porcionado_id) ? (
                                // No linked items yet - show select to link first item
                                <Select
                                  value=""
                                  onValueChange={(v) => handleVincularItem(produto.vinculos[0]?.id || '', v)}
                                >
                                  <SelectTrigger className="h-8 border-dashed border-primary/50">
                                    <SelectValue placeholder="Vincular item..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {itensPorcionados?.map(item => (
                                      <SelectItem key={item.id} value={item.id}>
                                        {item.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                // Show linked items
                                <div className="space-y-1">
                                  {produto.vinculos.filter(v => v.item_porcionado_id).map((vinculo) => (
                                    <div key={vinculo.id} className="flex items-center gap-2 text-sm">
                                      <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                                      <span className="truncate">{vinculo.item_porcionado_nome}</span>
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        {vinculo.quantidade_consumida}x
                                      </Badge>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0">
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              O item "{vinculo.item_porcionado_nome}" não será mais consumido quando este produto for vendido.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction 
                                              onClick={() => deleteMapeamento.mutate(vinculo.id)}
                                              className="bg-destructive text-destructive-foreground"
                                            >
                                              Remover
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  ))}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-primary hover:text-primary"
                                    onClick={() => handleAbrirModalVinculo(produto)}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Adicionar item
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {produto.vinculos.length > 0 && produto.vinculos.some(v => v.item_porcionado_id) && (
                              <div className="flex items-center gap-1">
                                <Link2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {produto.vinculos.filter(v => v.item_porcionado_id).length}
                                </span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Webhooks</CardTitle>
                <CardDescription>
                  Últimos 50 webhooks recebidos do Cardápio Web
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLogs ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum webhook recebido ainda</p>
                    <p className="text-sm">Os webhooks aparecerão aqui quando o Cardápio Web enviar pedidos</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead className="text-center">Itens</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-mono">#{log.order_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.evento}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {Array.isArray(log.itens_processados) ? log.itens_processados.length : 0}
                          </TableCell>
                          <TableCell className="text-center">
                            {log.sucesso ? (
                              <CheckCircle className="h-5 w-5 text-primary mx-auto" />
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <XCircle className="h-5 w-5 text-destructive" />
                                {log.erro && (
                                  <span className="text-xs text-destructive max-w-32 truncate" title={log.erro}>
                                    {log.erro}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de importação */}
        <ImportarMapeamentoCardapioModal
          open={importarModalOpen}
          onOpenChange={setImportarModalOpen}
          onImport={handleImportarMapeamentos}
          isLoading={importarMapeamentos.isPending}
        />

        {/* Modal de adicionar vínculo */}
        <AdicionarVinculoCardapioModal
          open={adicionarVinculoModalOpen}
          onOpenChange={setAdicionarVinculoModalOpen}
          produtoNome={produtoSelecionado?.cardapio_item_nome || ''}
          itensPorcionados={itensPorcionados || []}
          onConfirm={handleAdicionarVinculo}
          isLoading={adicionarVinculo.isPending}
        />
      </div>
    </Layout>
  );
}
