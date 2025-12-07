import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCPDLoja } from "@/hooks/useCPDLoja";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Package, 
  Search, 
  Plus, 
  ArrowDownToLine, 
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Truck,
  ClipboardList,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CriarPedidoCompraModal } from "@/components/modals/CriarPedidoCompraModal";
import { ConferirRecebimentoModal } from "@/components/modals/ConferirRecebimentoModal";

interface Produto {
  id: string;
  nome: string;
  codigo: string | null;
  categoria: string;
  tipo_produto: string;
  unidade_consumo: string | null;
}

interface EstoqueProduto {
  id: string;
  produto_id: string;
  quantidade: number;
  data_ultima_movimentacao: string | null;
  produto?: Produto;
}

interface PedidoCompra {
  id: string;
  numero_pedido: string;
  fornecedor: string;
  status: string;
  data_pedido: string;
  data_prevista_entrega: string | null;
  data_recebimento: string | null;
  recebido_por_nome: string | null;
  observacao: string | null;
  usuario_nome: string;
}

interface ItemPedido {
  id: string;
  pedido_id: string;
  produto_id: string;
  produto_nome: string;
  quantidade_solicitada: number;
  quantidade_recebida: number | null;
  unidade: string | null;
  divergencia: boolean;
  observacao_divergencia: string | null;
}


const CATEGORIAS = [
  { value: "todas", label: "Todas as categorias" },
  { value: "congelado", label: "Congelado" },
  { value: "refrigerado", label: "Refrigerado" },
  { value: "ambiente", label: "Ambiente" },
  { value: "diversos", label: "Diversos" },
  { value: "material_escritorio", label: "Material de Escritório" },
  { value: "material_limpeza", label: "Material de Limpeza" },
  { value: "embalagens", label: "Embalagens" },
  { value: "descartaveis", label: "Descartáveis" },
  { value: "equipamentos", label: "Equipamentos" },
];

const TIPOS_ENTRADA = [
  { value: "entrada_compra", label: "📦 Compra", description: "Chegada de mercadorias compradas" },
  { value: "entrada_producao", label: "🏭 Produção", description: "Produção interna" },
  { value: "ajuste_positivo", label: "➕ Ajuste Positivo", description: "Correção de inventário" },
  { value: "ajuste_negativo", label: "➖ Ajuste Negativo", description: "Correção de inventário" },
];

const STATUS_PEDIDO = {
  pendente: { label: "Pendente", color: "bg-amber-500" },
  parcial: { label: "Parcial", color: "bg-blue-500" },
  recebido: { label: "Recebido", color: "bg-green-500" },
  cancelado: { label: "Cancelado", color: "bg-destructive" },
};

export default function EstoqueProdutosCPD() {
  const { organizationId } = useOrganization();
  const { profile } = useAuth();
  const { cpdLojaId } = useCPDLoja();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("estoque");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados para Estoque Atual
  const [estoques, setEstoques] = useState<EstoqueProduto[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");

  // Estados para Registrar Entrada
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [tipoEntrada, setTipoEntrada] = useState("entrada_compra");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");

  // Estados para Receber Mercadorias
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);
  const [itensPedidoSelecionado, setItensPedidoSelecionado] = useState<ItemPedido[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [modalCriarPedido, setModalCriarPedido] = useState(false);
  const [modalConferir, setModalConferir] = useState(false);
  const [pedidoParaConferir, setPedidoParaConferir] = useState<PedidoCompra | null>(null);

  // Buscar produtos e estoques
  const fetchData = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      // Buscar todos os produtos ativos
      const { data: produtosData, error: produtosError } = await supabase
        .from("produtos")
        .select("id, nome, codigo, categoria, tipo_produto, unidade_consumo")
        .eq("ativo", true)
        .order("nome");

      if (produtosError) throw produtosError;
      setProdutos(produtosData || []);

      // Buscar estoques CPD (agora da tabela unificada estoque_loja_produtos)
      if (!cpdLojaId) {
        setEstoques([]);
        setLoading(false);
        return;
      }

      const { data: estoquesData, error: estoquesError } = await supabase
        .from("estoque_loja_produtos")
        .select("id, produto_id, quantidade, data_ultima_atualizacao")
        .eq("loja_id", cpdLojaId);

      if (estoquesError) throw estoquesError;
      
      // Mapear estoques com produtos
      const estoquesComProdutos = (estoquesData || []).map(est => ({
        ...est,
        data_ultima_movimentacao: est.data_ultima_atualizacao,
        produto: produtosData?.find(p => p.id === est.produto_id)
      }));
      
      setEstoques(estoquesComProdutos);
    } catch (error: any) {
      console.error("Erro ao buscar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Buscar pedidos de compra
  const fetchPedidos = async () => {
    if (!organizationId) return;
    setLoadingPedidos(true);

    try {
      const { data, error } = await supabase
        .from("pedidos_compra")
        .select("*")
        .eq("organization_id", organizationId)
        .order("data_pedido", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar pedidos:", error);
      toast({
        title: "Erro ao carregar pedidos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingPedidos(false);
    }
  };

  // Buscar itens de um pedido específico
  const fetchItensPedido = async (pedidoId: string) => {
    try {
      const { data, error } = await supabase
        .from("pedidos_compra_itens")
        .select("*")
        .eq("pedido_id", pedidoId);

      if (error) throw error;
      setItensPedidoSelecionado(data || []);
      return data || [];
    } catch (error: any) {
      console.error("Erro ao buscar itens do pedido:", error);
      toast({
        title: "Erro ao carregar itens",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }
  };

  useEffect(() => {
    if (cpdLojaId) {
      fetchData();
    }
  }, [organizationId, cpdLojaId]);

  useEffect(() => {
    if (activeTab === "receber") {
      fetchPedidos();
    }
  }, [activeTab, organizationId]);

  // Filtrar produtos e estoques
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchSearch = searchTerm === "" ||
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategoria = categoriaFiltro === "todas" || p.categoria === categoriaFiltro;
      return matchSearch && matchCategoria;
    });
  }, [produtos, searchTerm, categoriaFiltro]);

  // Mesclar produtos com estoques
  const produtosComEstoque = useMemo(() => {
    return produtosFiltrados.map(p => {
      const estoque = estoques.find(e => e.produto_id === p.id);
      return {
        ...p,
        quantidade: estoque?.quantidade || 0,
        data_ultima_movimentacao: estoque?.data_ultima_movimentacao,
      };
    });
  }, [produtosFiltrados, estoques]);

  // Registrar entrada
  const handleRegistrarEntrada = async () => {
    if (!produtoSelecionado || !quantidade || !organizationId || !profile) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um produto e informe a quantidade.",
        variant: "destructive",
      });
      return;
    }

    const qtd = parseFloat(quantidade);
    if (isNaN(qtd) || qtd <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "Informe um valor válido maior que zero.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const produto = produtos.find(p => p.id === produtoSelecionado);
      const estoqueAtual = estoques.find(e => e.produto_id === produtoSelecionado);
      const quantidadeAnterior = estoqueAtual?.quantidade || 0;
      const isNegativo = tipoEntrada === "ajuste_negativo";
      const quantidadeFinal = isNegativo 
        ? quantidadeAnterior - qtd 
        : quantidadeAnterior + qtd;

      // Verificar se há estoque suficiente para ajuste negativo
      if (isNegativo && quantidadeFinal < 0) {
        toast({
          title: "Estoque insuficiente",
          description: `Estoque atual: ${quantidadeAnterior}. Não é possível remover ${qtd}.`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // Upsert no estoque (tabela unificada)
      if (!cpdLojaId) {
        toast({
          title: "Erro",
          description: "Loja CPD não encontrada",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const { error: estoqueError } = await supabase
        .from("estoque_loja_produtos")
        .upsert({
          loja_id: cpdLojaId,
          produto_id: produtoSelecionado,
          quantidade: quantidadeFinal,
          data_ultima_atualizacao: new Date().toISOString(),
          organization_id: organizationId,
        }, {
          onConflict: "loja_id,produto_id",
        });

      if (estoqueError) throw estoqueError;

      // Registrar movimentação
      const { error: movError } = await supabase
        .from("movimentacoes_cpd_produtos")
        .insert({
          produto_id: produtoSelecionado,
          produto_nome: produto?.nome || "Produto",
          tipo: tipoEntrada,
          quantidade: qtd,
          quantidade_anterior: quantidadeAnterior,
          quantidade_posterior: quantidadeFinal,
          observacao: observacao || null,
          usuario_id: profile.id,
          usuario_nome: profile.nome,
          organization_id: organizationId,
        });

      if (movError) throw movError;

      toast({
        title: "Entrada registrada",
        description: `${isNegativo ? "Saída" : "Entrada"} de ${qtd} ${produto?.unidade_consumo || "un"} registrada com sucesso.`,
      });

      // Limpar formulário
      setProdutoSelecionado("");
      setQuantidade("");
      setObservacao("");
      setTipoEntrada("entrada_compra");

      // Atualizar dados
      fetchData();
    } catch (error: any) {
      console.error("Erro ao registrar entrada:", error);
      toast({
        title: "Erro ao registrar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Criar pedido de compra
  const handleCriarPedido = async (pedido: {
    numero_pedido: string;
    fornecedor: string;
    data_prevista_entrega: string | null;
    observacao: string;
    itens: Array<{ produto_id: string; produto_nome: string; quantidade: number; unidade: string | null }>;
  }) => {
    if (!organizationId || !profile) return;
    setSaving(true);

    try {
      // Criar pedido
      const { data: pedidoData, error: pedidoError } = await supabase
        .from("pedidos_compra")
        .insert({
          numero_pedido: pedido.numero_pedido,
          fornecedor: pedido.fornecedor,
          data_prevista_entrega: pedido.data_prevista_entrega,
          observacao: pedido.observacao || null,
          usuario_id: profile.id,
          usuario_nome: profile.nome,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Criar itens do pedido
      const itensParaInserir = pedido.itens.map(item => ({
        pedido_id: pedidoData.id,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        quantidade_solicitada: item.quantidade,
        unidade: item.unidade,
        organization_id: organizationId,
      }));

      const { error: itensError } = await supabase
        .from("pedidos_compra_itens")
        .insert(itensParaInserir);

      if (itensError) throw itensError;

      toast({
        title: "Pedido criado",
        description: `Pedido #${pedido.numero_pedido} criado com ${pedido.itens.length} itens.`,
      });

      setModalCriarPedido(false);
      fetchPedidos();
    } catch (error: any) {
      console.error("Erro ao criar pedido:", error);
      toast({
        title: "Erro ao criar pedido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Abrir modal de conferência
  const handleAbrirConferencia = async (pedido: PedidoCompra) => {
    setPedidoParaConferir(pedido);
    await fetchItensPedido(pedido.id);
    setModalConferir(true);
  };

  // Confirmar recebimento
  const handleConfirmarRecebimento = async (
    itensConferidos: Array<{ id: string; quantidade_recebida: number; divergencia: boolean; observacao_divergencia?: string }>,
    observacaoGeral: string
  ) => {
    if (!organizationId || !profile || !pedidoParaConferir) return;
    setSaving(true);

    try {
      // Atualizar cada item do pedido
      for (const item of itensConferidos) {
        const { error: itemError } = await supabase
          .from("pedidos_compra_itens")
          .update({
            quantidade_recebida: item.quantidade_recebida,
            divergencia: item.divergencia,
            observacao_divergencia: item.observacao_divergencia || null,
          })
          .eq("id", item.id);

        if (itemError) throw itemError;

        // Registrar entrada no estoque usando quantidade RECEBIDA
        if (item.quantidade_recebida > 0) {
          const itemOriginal = itensPedidoSelecionado.find(i => i.id === item.id);
          if (itemOriginal) {
            const estoqueAtual = estoques.find(e => e.produto_id === itemOriginal.produto_id);
            const quantidadeAnterior = estoqueAtual?.quantidade || 0;
            const quantidadeFinal = quantidadeAnterior + item.quantidade_recebida;

            // Upsert estoque (tabela unificada)
            if (cpdLojaId) {
              const { error: estoqueError } = await supabase
                .from("estoque_loja_produtos")
                .upsert({
                  loja_id: cpdLojaId,
                  produto_id: itemOriginal.produto_id,
                  quantidade: quantidadeFinal,
                  data_ultima_atualizacao: new Date().toISOString(),
                  organization_id: organizationId,
                }, {
                  onConflict: "loja_id,produto_id",
                });

              if (estoqueError) throw estoqueError;
            }

            // Registrar movimentação
            const { error: movError } = await supabase
              .from("movimentacoes_cpd_produtos")
              .insert({
                produto_id: itemOriginal.produto_id,
                produto_nome: itemOriginal.produto_nome,
                tipo: "entrada_compra",
                quantidade: item.quantidade_recebida,
                quantidade_anterior: quantidadeAnterior,
                quantidade_posterior: quantidadeFinal,
                observacao: `Recebimento Pedido #${pedidoParaConferir.numero_pedido}${item.divergencia ? " (com divergência)" : ""}`,
                usuario_id: profile.id,
                usuario_nome: profile.nome,
                organization_id: organizationId,
              });

            if (movError) throw movError;
          }
        }
      }

      // Determinar status do pedido
      const todoRecebido = itensConferidos.every(i => {
        const original = itensPedidoSelecionado.find(o => o.id === i.id);
        return original && i.quantidade_recebida >= original.quantidade_solicitada;
      });
      const algumRecebido = itensConferidos.some(i => i.quantidade_recebida > 0);

      const novoStatus = todoRecebido ? "recebido" : algumRecebido ? "parcial" : "pendente";

      // Atualizar pedido
      const { error: pedidoError } = await supabase
        .from("pedidos_compra")
        .update({
          status: novoStatus,
          data_recebimento: new Date().toISOString(),
          recebido_por_id: profile.id,
          recebido_por_nome: profile.nome,
          observacao: observacaoGeral || pedidoParaConferir.observacao,
        })
        .eq("id", pedidoParaConferir.id);

      if (pedidoError) throw pedidoError;

      const divergencias = itensConferidos.filter(i => i.divergencia).length;
      toast({
        title: "Recebimento confirmado",
        description: `${itensConferidos.length} itens conferidos${divergencias > 0 ? ` (${divergencias} com divergência)` : ""}.`,
      });

      setModalConferir(false);
      setPedidoParaConferir(null);
      fetchPedidos();
      fetchData(); // Atualizar estoques
    } catch (error: any) {
      console.error("Erro ao confirmar recebimento:", error);
      toast({
        title: "Erro ao confirmar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Estatísticas
  const stats = useMemo(() => {
    const total = produtosComEstoque.length;
    const comEstoque = produtosComEstoque.filter(p => p.quantidade > 0).length;
    const semEstoque = total - comEstoque;
    return { total, comEstoque, semEstoque };
  }, [produtosComEstoque]);

  // Estatísticas de pedidos
  const pedidoStats = useMemo(() => {
    const pendentes = pedidos.filter(p => p.status === "pendente" || p.status === "parcial").length;
    const recebidos = pedidos.filter(p => p.status === "recebido").length;
    return { pendentes, recebidos, total: pedidos.length };
  }, [pedidos]);

  const pedidosPendentes = useMemo(() => {
    return pedidos.filter(p => p.status === "pendente" || p.status === "parcial");
  }, [pedidos]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Estoque de Produtos (CPD)</h1>
            <p className="text-muted-foreground">
              Gerenciar entrada e saída de produtos no estoque central
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="estoque" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Estoque</span>
            </TabsTrigger>
            <TabsTrigger value="entrada" className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              <span className="hidden sm:inline">Entrada</span>
            </TabsTrigger>
            <TabsTrigger value="receber" className="gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Receber</span>
              {pedidoStats.pendentes > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {pedidoStats.pendentes}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Aba Estoque Atual */}
          <TabsContent value="estoque" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                  <div className="flex gap-2">
                    <Badge variant="outline">{stats.total} produtos</Badge>
                    <Badge variant="default" className="bg-green-500">{stats.comEstoque} com estoque</Badge>
                    {stats.semEstoque > 0 && (
                      <Badge variant="destructive">{stats.semEstoque} sem estoque</Badge>
                    )}
                  </div>
                   <Button size="sm" onClick={fetchData} disabled={loading} className="!bg-green-600 hover:!bg-green-700 text-white">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filtros */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou código..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tabela */}
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produtosComEstoque.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Nenhum produto encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          produtosComEstoque.map((produto) => (
                            <TableRow key={produto.id}>
                              <TableCell className="font-medium">{produto.nome}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {produto.codigo || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {produto.categoria.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {produto.quantidade} {produto.unidade_consumo || "un"}
                              </TableCell>
                              <TableCell className="text-center">
                                {produto.quantidade > 0 ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                                ) : (
                                  <AlertTriangle className="h-5 w-5 text-destructive mx-auto" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Registrar Entrada */}
          <TabsContent value="entrada" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Registrar Entrada no Estoque
                </CardTitle>
                <CardDescription>
                  Registre entradas por compra, produção ou ajustes de inventário
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Produto */}
                  <div className="space-y-2">
                    <Label htmlFor="produto">Produto *</Label>
                    <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map((produto) => (
                          <SelectItem key={produto.id} value={produto.id}>
                            {produto.nome} {produto.codigo ? `(${produto.codigo})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tipo de Entrada */}
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de Movimentação *</Label>
                    <Select value={tipoEntrada} onValueChange={setTipoEntrada}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_ENTRADA.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            <div className="flex flex-col">
                              <span>{tipo.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantidade */}
                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade *</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                    />
                  </div>

                  {/* Estoque Atual (informativo) */}
                  {produtoSelecionado && (
                    <div className="space-y-2">
                      <Label>Estoque Atual</Label>
                      <div className="h-10 px-3 flex items-center bg-muted rounded-md font-mono">
                        {estoques.find(e => e.produto_id === produtoSelecionado)?.quantidade || 0}{" "}
                        {produtos.find(p => p.id === produtoSelecionado)?.unidade_consumo || "un"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Observação */}
                <div className="space-y-2">
                  <Label htmlFor="observacao">Observação (opcional)</Label>
                  <Textarea
                    id="observacao"
                    placeholder="Nota fiscal, fornecedor, motivo do ajuste..."
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Botão */}
                <Button 
                  onClick={handleRegistrarEntrada} 
                  disabled={saving || !produtoSelecionado || !quantidade}
                  className="w-full sm:w-auto"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : tipoEntrada === "ajuste_negativo" ? (
                    <ArrowUpFromLine className="h-4 w-4 mr-2" />
                  ) : (
                    <ArrowDownToLine className="h-4 w-4 mr-2" />
                  )}
                  {tipoEntrada === "ajuste_negativo" ? "Registrar Saída" : "Registrar Entrada"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Receber Mercadorias */}
          <TabsContent value="receber" className="space-y-4">
            {/* Seção: Criar Novo Pedido */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Pedidos de Compra
                    </CardTitle>
                    <CardDescription>
                      Registre pedidos enviados aos fornecedores e confira o recebimento
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{pedidoStats.total} pedidos</Badge>
                    {pedidoStats.pendentes > 0 && (
                      <Badge variant="destructive">{pedidoStats.pendentes} pendentes</Badge>
                    )}
                    <Button onClick={() => setModalCriarPedido(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Pedido
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Seção: Pedidos Pendentes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Pedidos Pendentes de Recebimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPedidos ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pedidosPendentes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                    <p className="text-lg font-medium">Nenhum pedido pendente!</p>
                    <p className="text-sm">Todos os pedidos foram recebidos.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº Pedido</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Data Pedido</TableHead>
                          <TableHead>Previsão</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pedidosPendentes.map((pedido) => {
                          const statusInfo = STATUS_PEDIDO[pedido.status as keyof typeof STATUS_PEDIDO] || STATUS_PEDIDO.pendente;
                          return (
                            <TableRow key={pedido.id}>
                              <TableCell className="font-mono font-medium">#{pedido.numero_pedido}</TableCell>
                              <TableCell>{pedido.fornecedor}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {format(new Date(pedido.data_pedido), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                {pedido.data_prevista_entrega ? (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(pedido.data_prevista_entrega), "dd/MM", { locale: ptBR })}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={`${statusInfo.color} text-white`}>
                                  {statusInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  onClick={() => handleAbrirConferencia(pedido)}
                                >
                                  <Truck className="h-4 w-4 mr-2" />
                                  Receber
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seção: Histórico de Pedidos Recebidos */}
            {pedidos.filter(p => p.status === "recebido").length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Pedidos Recebidos Recentemente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº Pedido</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Data Recebimento</TableHead>
                          <TableHead>Recebido por</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pedidos
                          .filter(p => p.status === "recebido")
                          .slice(0, 5)
                          .map((pedido) => (
                            <TableRow key={pedido.id}>
                              <TableCell className="font-mono font-medium">#{pedido.numero_pedido}</TableCell>
                              <TableCell>{pedido.fornecedor}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {pedido.data_recebimento 
                                  ? format(new Date(pedido.data_recebimento), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                  : "-"}
                              </TableCell>
                              <TableCell>{pedido.recebido_por_nome || "-"}</TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-green-500 text-white">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Recebido
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <CriarPedidoCompraModal
        open={modalCriarPedido}
        onOpenChange={setModalCriarPedido}
        produtos={produtos}
        onCriar={handleCriarPedido}
        saving={saving}
      />

      <ConferirRecebimentoModal
        open={modalConferir}
        onOpenChange={setModalConferir}
        pedido={pedidoParaConferir}
        itens={itensPedidoSelecionado}
        onConfirmar={handleConfirmarRecebimento}
        saving={saving}
      />
    </Layout>
  );
}
