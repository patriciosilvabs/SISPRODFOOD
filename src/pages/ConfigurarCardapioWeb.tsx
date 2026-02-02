import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, CheckCircle, XCircle, Loader2, Settings, List, History, Upload, Link2, Store, LayoutGrid, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';
import { useCardapioWebIntegracao, type ImportarMapeamentoItem, type MapeamentoCardapioItemAgrupado } from '@/hooks/useCardapioWebIntegracao';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ImportarMapeamentoCardapioModal, type ParsedCardapioItem } from '@/components/modals/ImportarMapeamentoCardapioModal';
import { AdicionarVinculoCardapioModal } from '@/components/modals/AdicionarVinculoCardapioModal';
import { VincularEmLoteModal } from '@/components/modals/VincularEmLoteModal';
import { LojaIntegracaoCard } from '@/components/cardapio-web/LojaIntegracaoCard';

// Row component for mapeamento table
interface MapeamentoTableRowProps {
  produto: MapeamentoCardapioItemAgrupado;
  itensPorcionados: { id: string; nome: string }[];
  lojaIdMapeamento: string;
  onVincularItem: (mapeamentoId: string, itemPorcionadoId: string) => void;
  onAdicionarVinculo: (data: {
    loja_id: string;
    cardapio_item_id: number;
    cardapio_item_nome: string;
    tipo: string | null;
    categoria: string | null;
    item_porcionado_id: string;
    quantidade_consumida: number;
  }) => void;
  onDeleteMapeamento: (id: string) => void;
  onAbrirModalVinculo: (produto: MapeamentoCardapioItemAgrupado) => void;
  showTipo: boolean;
  showCategoria: boolean;
  // Selection props
  modoSelecao: boolean;
  isSelected: boolean;
  onToggleSelection: (cardapioItemId: number) => void;
}

function MapeamentoTableRow({
  produto,
  itensPorcionados,
  lojaIdMapeamento,
  onVincularItem,
  onAdicionarVinculo,
  onDeleteMapeamento,
  onAbrirModalVinculo,
  showTipo,
  showCategoria,
  modoSelecao,
  isSelected,
  onToggleSelection,
}: MapeamentoTableRowProps) {
  return (
    <TableRow className={isSelected ? 'bg-muted/50' : ''}>
      {modoSelecao && (
        <TableCell className="w-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelection(produto.cardapio_item_id)}
          />
        </TableCell>
      )}
      {showTipo && (
        <TableCell>
          {produto.tipo && (
            <Badge variant={produto.tipo === 'PRODUTO' ? 'default' : 'secondary'} className="text-xs">
              {produto.tipo}
            </Badge>
          )}
        </TableCell>
      )}
      {showCategoria && (
        <TableCell className="max-w-32 truncate text-sm" title={produto.categoria || ''}>
          {produto.categoria || '-'}
        </TableCell>
      )}
      <TableCell className="max-w-40 truncate" title={produto.cardapio_item_nome}>
        {produto.cardapio_item_nome}
      </TableCell>
      <TableCell className="font-mono text-sm">{produto.cardapio_item_id}</TableCell>
      <TableCell>
        <div className="space-y-1">
          {produto.vinculos.length === 0 || (produto.vinculos.length === 1 && !produto.vinculos[0].item_porcionado_id) ? (
            <Select
              value=""
              onValueChange={(v) => {
                // Se já existe um registro sem vínculo, atualiza ele
                if (produto.vinculos[0]?.id) {
                  onVincularItem(produto.vinculos[0].id, v);
                } else if (lojaIdMapeamento) {
                  // Caso contrário, cria um novo vínculo
                  onAdicionarVinculo({
                    loja_id: lojaIdMapeamento,
                    cardapio_item_id: produto.cardapio_item_id,
                    cardapio_item_nome: produto.cardapio_item_nome,
                    tipo: produto.tipo,
                    categoria: produto.categoria,
                    item_porcionado_id: v,
                    quantidade_consumida: 1,
                  });
                }
              }}
            >
              <SelectTrigger className="h-8 border-dashed border-primary/50">
                <SelectValue placeholder="Vincular item..." />
              </SelectTrigger>
              <SelectContent>
                {itensPorcionados.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
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
                          onClick={() => onDeleteMapeamento(vinculo.id)}
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
                onClick={() => onAbrirModalVinculo(produto)}
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
  );
}

export default function ConfigurarCardapioWeb() {
  const { organizationId } = useOrganization();
  const {
    integracoes,
    todasLojas,
    mapeamentosAgrupados,
    logs,
    loadingIntegracoes,
    loadingLojas,
    loadingMapeamentos,
    loadingLogs,
    createIntegracao,
    updateIntegracaoStatus,
    regenerateToken,
    updateCardapioApiKey,
    addMapeamento,
    deleteMapeamento,
    deleteAllMapeamentos,
    importarMapeamentos,
    vincularItemPorcionado,
    vincularEmLote,
    adicionarVinculo,
    testarConexao,
  } = useCardapioWebIntegracao();

  const [novoMapeamentoOpen, setNovoMapeamentoOpen] = useState(false);
  const [importarModalOpen, setImportarModalOpen] = useState(false);
  const [adicionarVinculoModalOpen, setAdicionarVinculoModalOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<MapeamentoCardapioItemAgrupado | null>(null);
  const [lojaIdMapeamento, setLojaIdMapeamento] = useState<string>('');
  const [modoVisualizacao, setModoVisualizacao] = useState<'produto' | 'tipo' | 'categoria'>('produto');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [produtosSelecionados, setProdutosSelecionados] = useState<Set<number>>(new Set());
  const [vinculoEmLoteModalOpen, setVinculoEmLoteModalOpen] = useState(false);
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  const [novoMapeamento, setNovoMapeamento] = useState({
    cardapio_item_id: '',
    cardapio_item_nome: '',
    item_porcionado_id: '',
    quantidade_consumida: '1',
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

  // Combine lojas with their integrations
  const lojasComIntegracao = useMemo(() => {
    return todasLojas.map(loja => ({
      loja,
      integracao: integracoes.find(i => i.loja_id === loja.id) || null,
    }));
  }, [todasLojas, integracoes]);

  // Filter lojas for mapeamento (only non-CPD stores)
  const lojasParaMapeamento = useMemo(() => {
    return todasLojas.filter(l => l.tipo !== 'cpd');
  }, [todasLojas]);

  // Set default loja for mapeamento when lojas are loaded
  useMemo(() => {
    if (lojasParaMapeamento.length > 0 && !lojaIdMapeamento) {
      setLojaIdMapeamento(lojasParaMapeamento[0].id);
    }
  }, [lojasParaMapeamento, lojaIdMapeamento]);

  // Filter mapeamentos by selected loja
  const mapeamentosFiltrados = useMemo(() => {
    if (!lojaIdMapeamento) return [];
    return mapeamentosAgrupados.filter(m => m.loja_id === lojaIdMapeamento);
  }, [mapeamentosAgrupados, lojaIdMapeamento]);

  // Group mapeamentos by tipo or categoria
  const mapeamentosVisualizacao = useMemo(() => {
    if (modoVisualizacao === 'produto') {
      return { grupos: null, items: mapeamentosFiltrados };
    }
    
    const grupos = new Map<string, MapeamentoCardapioItemAgrupado[]>();
    
    for (const item of mapeamentosFiltrados) {
      const chave = modoVisualizacao === 'tipo' 
        ? (item.tipo || 'Sem tipo')
        : (item.categoria || 'Sem categoria');
      
      if (!grupos.has(chave)) {
        grupos.set(chave, []);
      }
      grupos.get(chave)!.push(item);
    }
    
    // Ordenar grupos alfabeticamente
    return { 
      grupos: Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      items: null 
    };
  }, [mapeamentosFiltrados, modoVisualizacao]);

  // Initialize all groups as expanded when mode changes or data changes
  useEffect(() => {
    if (mapeamentosVisualizacao.grupos) {
      setGruposExpandidos(new Set(mapeamentosVisualizacao.grupos.map(([key]) => key)));
    }
  }, [modoVisualizacao, lojaIdMapeamento, mapeamentosVisualizacao.grupos?.length]);

  const toggleGrupo = (grupo: string) => {
    setGruposExpandidos(prev => {
      const novo = new Set(prev);
      if (novo.has(grupo)) {
        novo.delete(grupo);
      } else {
        novo.add(grupo);
      }
      return novo;
    });
  };

  // Count active integrations
  const integracoesAtivas = integracoes.filter(i => i.ativo).length;

  const handleCreateIntegracao = async (lojaId: string, ambiente: 'sandbox' | 'producao') => {
    await createIntegracao.mutateAsync({
      loja_id: lojaId,
      ambiente,
    });
  };

  const handleAddMapeamento = async () => {
    const itemId = parseInt(novoMapeamento.cardapio_item_id);
    if (isNaN(itemId) || !novoMapeamento.cardapio_item_nome || !novoMapeamento.item_porcionado_id || !lojaIdMapeamento) {
      toast.error('Preencha todos os campos');
      return;
    }

    await addMapeamento.mutateAsync({
      loja_id: lojaIdMapeamento,
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
    if (!lojaIdMapeamento) {
      toast.error('Selecione uma loja');
      return;
    }
    await importarMapeamentos.mutateAsync({ loja_id: lojaIdMapeamento, items: items as ImportarMapeamentoItem[] });
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
    if (!produtoSelecionado || !lojaIdMapeamento) return;
    
    await adicionarVinculo.mutateAsync({
      loja_id: lojaIdMapeamento,
      cardapio_item_id: produtoSelecionado.cardapio_item_id,
      cardapio_item_nome: produtoSelecionado.cardapio_item_nome,
      tipo: produtoSelecionado.tipo,
      categoria: produtoSelecionado.categoria,
      item_porcionado_id: itemPorcionadoId,
      quantidade_consumida: quantidade,
    });
  };

  const handleTestConnection = async (token: string) => {
    return await testarConexao.mutateAsync(token);
  };

  // Toggle product selection
  const toggleProdutoSelecionado = (cardapioItemId: number) => {
    setProdutosSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(cardapioItemId)) {
        novo.delete(cardapioItemId);
      } else {
        novo.add(cardapioItemId);
      }
      return novo;
    });
  };

  // Select/deselect all products
  const toggleSelecionarTodos = (selecionar: boolean) => {
    if (selecionar) {
      setProdutosSelecionados(new Set(mapeamentosFiltrados.map(p => p.cardapio_item_id)));
    } else {
      setProdutosSelecionados(new Set());
    }
  };

  // Select/deselect all products in a group
  const toggleSelecionarGrupo = (produtos: MapeamentoCardapioItemAgrupado[], selecionar: boolean) => {
    setProdutosSelecionados(prev => {
      const novo = new Set(prev);
      if (selecionar) {
        produtos.forEach(p => novo.add(p.cardapio_item_id));
      } else {
        produtos.forEach(p => novo.delete(p.cardapio_item_id));
      }
      return novo;
    });
  };

  // Handle bulk linking with multiple portioned items
  const handleVincularEmLote = async (vinculos: { itemPorcionadoId: string; quantidade: number }[]) => {
    if (!lojaIdMapeamento || produtosSelecionados.size === 0) return;
    
    const produtosParaVincular = mapeamentosFiltrados.filter(p => 
      produtosSelecionados.has(p.cardapio_item_id)
    );
    
    await vincularEmLote.mutateAsync({
      produtos: produtosParaVincular,
      vinculos: vinculos.map(v => ({
        item_porcionado_id: v.itemPorcionadoId,
        quantidade_consumida: v.quantidade
      })),
      loja_id: lojaIdMapeamento,
    });
    
    // Clear selection after success
    setProdutosSelecionados(new Set());
    setModoSelecao(false);
    setVinculoEmLoteModalOpen(false);
  };

  // Clear selection when changing loja or visualization mode
  useEffect(() => {
    setProdutosSelecionados(new Set());
  }, [lojaIdMapeamento, modoVisualizacao]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integração Cardápio Web</h1>
          <p className="text-muted-foreground mt-1">
            Configure a integração com o Cardápio Web para cada loja. A integração baixa automaticamente o estoque quando pedidos são feitos.
          </p>
        </div>

        <Tabs defaultValue="config" className="space-y-4">
          <TabsList>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Lojas
              {integracoesAtivas > 0 && (
                <Badge variant="secondary" className="ml-1">{integracoesAtivas}</Badge>
              )}
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

          {/* Configuração Tab - Lista de Lojas */}
          <TabsContent value="config" className="space-y-4">
            {(loadingIntegracoes || loadingLojas) ? (
              <Card>
                <CardContent className="py-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : lojasComIntegracao.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma loja cadastrada</p>
                  <p className="text-sm">Cadastre lojas para configurar integrações</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Instruções */}
                <Card className="bg-muted/50">
                  <CardContent className="py-4">
                    <h4 className="font-semibold mb-2">Como configurar:</h4>
                    <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                      <li>Configure o <strong>Código do Cardápio Web</strong> na página de Lojas (ex: 8268)</li>
                      <li>Clique em "Configurar Integração" na loja desejada</li>
                      <li>Copie a URL e Token e configure no painel do Cardápio Web</li>
                      <li>Configure o header <code className="bg-muted px-1 rounded">X-API-KEY</code> com o token</li>
                    </ol>
                  </CardContent>
                </Card>

                {/* Lista de Lojas */}
                <div className="grid gap-4">
                  {lojasComIntegracao.map(({ loja, integracao }) => (
                    <LojaIntegracaoCard
                      key={loja.id}
                      loja={loja}
                      integracao={integracao}
                      onCreateIntegracao={handleCreateIntegracao}
                      onUpdateStatus={(id, ativo) => updateIntegracaoStatus.mutate({ id, ativo })}
                      onRegenerateToken={(id) => regenerateToken.mutate(id)}
                      onUpdateApiKey={async (id, apiKey) => {
                        await updateCardapioApiKey.mutateAsync({ id, cardapio_api_key: apiKey });
                      }}
                      onTestConnection={handleTestConnection}
                      isCreating={createIntegracao.isPending}
                      isUpdating={updateIntegracaoStatus.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Mapeamento Tab */}
          <TabsContent value="mapeamento" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Mapeamento de Produtos</CardTitle>
                    <CardDescription>
                      Configure quais itens porcionados são consumidos para cada produto do cardápio.
                    </CardDescription>
                  </div>
                  
                  {/* Seletor de Loja e Visualização */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <Select value={lojaIdMapeamento} onValueChange={setLojaIdMapeamento}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecione a loja" />
                        </SelectTrigger>
                        <SelectContent>
                          {lojasParaMapeamento.map(loja => (
                            <SelectItem key={loja.id} value={loja.id}>
                              {loja.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      <Select value={modoVisualizacao} onValueChange={(v) => setModoVisualizacao(v as 'produto' | 'tipo' | 'categoria')}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Visualizar por..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="produto">Por Produto</SelectItem>
                          <SelectItem value="tipo">Por Tipo</SelectItem>
                          <SelectItem value="categoria">Por Categoria</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                  {/* Botão Selecionar Múltiplos */}
                  {mapeamentosFiltrados.length > 0 && (
                    <Button
                      variant={modoSelecao ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        setModoSelecao(!modoSelecao);
                        setProdutosSelecionados(new Set());
                      }}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      {modoSelecao ? "Cancelar Seleção" : "Selecionar Múltiplos"}
                    </Button>
                  )}
                  {mapeamentosFiltrados.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Limpar Tudo
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover todos os mapeamentos desta loja?</AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div>
                              Esta ação é <strong>PERMANENTE e IRREVERSÍVEL</strong>. 
                              Todos os <strong>{mapeamentosFiltrados.length}</strong> produtos mapeados 
                              e seus vínculos serão excluídos desta loja.
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={(e) => {
                              e.preventDefault();
                              if (lojaIdMapeamento) {
                                deleteAllMapeamentos.mutate(lojaIdMapeamento);
                              }
                            }}
                            disabled={!lojaIdMapeamento}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleteAllMapeamentos.isPending && (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Confirmar Exclusão
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button variant="outline" onClick={() => setImportarModalOpen(true)} disabled={!lojaIdMapeamento}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Arquivo
                  </Button>
                  <Dialog open={novoMapeamentoOpen} onOpenChange={setNovoMapeamentoOpen}>
                    <DialogTrigger asChild>
                      <Button disabled={!lojaIdMapeamento}>
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
              </CardHeader>
              <CardContent>
                {!lojaIdMapeamento ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecione uma loja para ver os mapeamentos</p>
                  </div>
                ) : loadingMapeamentos ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : mapeamentosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum mapeamento configurado para esta loja</p>
                    <p className="text-sm">Adicione mapeamentos para vincular produtos do cardápio aos itens porcionados</p>
                  </div>
                ) : modoVisualizacao === 'produto' ? (
                  // Modo Por Produto - Tabela simples
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {modoSelecao && (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={produtosSelecionados.size === mapeamentosFiltrados.length && mapeamentosFiltrados.length > 0}
                              onCheckedChange={(checked) => toggleSelecionarTodos(!!checked)}
                            />
                          </TableHead>
                        )}
                        <TableHead className="w-20">Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-24">Código</TableHead>
                        <TableHead>Itens Vinculados</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mapeamentosFiltrados.map((produto) => (
                        <MapeamentoTableRow
                          key={produto.cardapio_item_id}
                          produto={produto}
                          itensPorcionados={itensPorcionados || []}
                          lojaIdMapeamento={lojaIdMapeamento}
                          onVincularItem={handleVincularItem}
                          onAdicionarVinculo={(v) => adicionarVinculo.mutate(v)}
                          onDeleteMapeamento={(id) => deleteMapeamento.mutate(id)}
                          onAbrirModalVinculo={handleAbrirModalVinculo}
                          showTipo={true}
                          showCategoria={true}
                          modoSelecao={modoSelecao}
                          isSelected={produtosSelecionados.has(produto.cardapio_item_id)}
                          onToggleSelection={toggleProdutoSelecionado}
                        />
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  // Modo Por Tipo ou Por Categoria - Grupos colapsáveis
                  <div className="space-y-4">
                    {mapeamentosVisualizacao.grupos?.map(([grupoNome, produtos]) => {
                      const todosGrupoSelecionados = produtos.every(p => produtosSelecionados.has(p.cardapio_item_id));
                      const algunsGrupoSelecionados = produtos.some(p => produtosSelecionados.has(p.cardapio_item_id));
                      
                      return (
                        <Collapsible
                          key={grupoNome}
                          open={gruposExpandidos.has(grupoNome)}
                          onOpenChange={() => toggleGrupo(grupoNome)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                              {modoSelecao && (
                                <Checkbox
                                  checked={todosGrupoSelecionados}
                                  className={algunsGrupoSelecionados && !todosGrupoSelecionados ? 'data-[state=unchecked]:bg-muted-foreground/20' : ''}
                                  onCheckedChange={(checked) => {
                                    toggleSelecionarGrupo(produtos, !!checked);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              {gruposExpandidos.has(grupoNome) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-semibold">{grupoNome}</span>
                              <Badge variant="secondary" className="text-xs">
                                {produtos.length} {produtos.length === 1 ? 'produto' : 'produtos'}
                              </Badge>
                              {modoSelecao && algunsGrupoSelecionados && (
                                <Badge variant="outline" className="text-xs">
                                  {produtos.filter(p => produtosSelecionados.has(p.cardapio_item_id)).length} selecionado(s)
                                </Badge>
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    {modoSelecao && (
                                      <TableHead className="w-10">
                                        <Checkbox
                                          checked={todosGrupoSelecionados}
                                          onCheckedChange={(checked) => toggleSelecionarGrupo(produtos, !!checked)}
                                        />
                                      </TableHead>
                                    )}
                                    {modoVisualizacao === 'categoria' && (
                                      <TableHead className="w-20">Tipo</TableHead>
                                    )}
                                    {modoVisualizacao === 'tipo' && (
                                      <TableHead>Categoria</TableHead>
                                    )}
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="w-24">Código</TableHead>
                                    <TableHead>Itens Vinculados</TableHead>
                                    <TableHead className="w-24"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {produtos.map((produto) => (
                                    <MapeamentoTableRow
                                      key={produto.cardapio_item_id}
                                      produto={produto}
                                      itensPorcionados={itensPorcionados || []}
                                      lojaIdMapeamento={lojaIdMapeamento}
                                      onVincularItem={handleVincularItem}
                                      onAdicionarVinculo={(v) => adicionarVinculo.mutate(v)}
                                      onDeleteMapeamento={(id) => deleteMapeamento.mutate(id)}
                                      onAbrirModalVinculo={handleAbrirModalVinculo}
                                      showTipo={modoVisualizacao === 'categoria'}
                                      showCategoria={modoVisualizacao === 'tipo'}
                                      modoSelecao={modoSelecao}
                                      isSelected={produtosSelecionados.has(produto.cardapio_item_id)}
                                      onToggleSelection={toggleProdutoSelecionado}
                                    />
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
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

        {/* Modal de vincular em lote */}
        <VincularEmLoteModal
          open={vinculoEmLoteModalOpen}
          onOpenChange={setVinculoEmLoteModalOpen}
          quantidadeSelecionados={produtosSelecionados.size}
          itensPorcionados={itensPorcionados || []}
          onConfirm={handleVincularEmLote}
          isLoading={vincularEmLote.isPending}
        />

        {/* Barra de ações fixa quando há itens selecionados */}
        {modoSelecao && produtosSelecionados.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex items-center justify-center gap-4 z-50 shadow-lg">
            <span className="text-sm">
              <strong>{produtosSelecionados.size}</strong> produto(s) selecionado(s)
            </span>
            <Button onClick={() => setVinculoEmLoteModalOpen(true)}>
              <Link2 className="h-4 w-4 mr-2" />
              Vincular Selecionados
            </Button>
            <Button variant="ghost" onClick={() => setProdutosSelecionados(new Set())}>
              Limpar Seleção
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
