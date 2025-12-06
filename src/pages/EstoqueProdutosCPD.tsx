import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
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
  Store,
  RefreshCw,
  Truck,
  ClipboardList,
  Calendar,
  Send,
  ShoppingCart,
  Trash2,
  X
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

interface DemandaLoja {
  loja_id: string;
  loja_nome: string;
  produto_id: string;
  produto_nome: string;
  produto_codigo: string | null;
  estoque_atual: number;
  estoque_minimo: number;
  necessidade: number;
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

interface Loja {
  id: string;
  nome: string;
}

interface RomaneioProduto {
  id: string;
  loja_id: string;
  loja_nome: string;
  status: string;
  data_criacao: string;
  data_envio: string | null;
  usuario_nome: string;
  observacao: string | null;
}

interface RomaneioProdutoItem {
  id: string;
  romaneio_id: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  unidade: string | null;
}

// Componente separado para evitar useState dentro de .map() (React Error #310)
interface ProdutoEstoque {
  id: string;
  nome: string;
  quantidade: number;
  unidade_consumo: string | null;
}

const ProdutoRomaneioItem = ({ 
  produto, 
  onAdicionar 
}: { 
  produto: ProdutoEstoque; 
  onAdicionar: (produto: ProdutoEstoque, qtd: number) => void;
}) => {
  const [qtdTemp, setQtdTemp] = useState(1);
  
  return (
    <div className="p-3 flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{produto.nome}</p>
        <p className="text-sm text-muted-foreground">
          Estoque: {produto.quantidade} {produto.unidade_consumo || "un"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={produto.quantidade}
          value={qtdTemp}
          onChange={(e) => setQtdTemp(Math.min(Number(e.target.value), produto.quantidade))}
          className="w-16 h-8 text-center"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAdicionar(produto, qtdTemp)}
          disabled={qtdTemp <= 0 || qtdTemp > produto.quantidade}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

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

  // Estados para Demandas das Lojas
  const [demandas, setDemandas] = useState<DemandaLoja[]>([]);
  const [loadingDemandas, setLoadingDemandas] = useState(false);

  // Estados para Receber Mercadorias
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);
  const [itensPedidoSelecionado, setItensPedidoSelecionado] = useState<ItemPedido[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [modalCriarPedido, setModalCriarPedido] = useState(false);
  const [modalConferir, setModalConferir] = useState(false);
  const [pedidoParaConferir, setPedidoParaConferir] = useState<PedidoCompra | null>(null);

  // Estados para Enviar para Lojas
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaSelecionadaRomaneio, setLojaSelecionadaRomaneio] = useState("");
  const [carrinhoRomaneio, setCarrinhoRomaneio] = useState<{ produto_id: string; produto_nome: string; quantidade: number; unidade: string | null }[]>([]);
  const [searchRomaneio, setSearchRomaneio] = useState("");
  const [romaneiosPendentes, setRomaneiosPendentes] = useState<RomaneioProduto[]>([]);
  const [itensRomaneiosPendentes, setItensRomaneiosPendentes] = useState<{ [key: string]: RomaneioProdutoItem[] }>({});
  const [loadingRomaneios, setLoadingRomaneios] = useState(false);
  const [enviandoRomaneio, setEnviandoRomaneio] = useState(false);

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

      // Buscar estoques CPD
      const { data: estoquesData, error: estoquesError } = await supabase
        .from("estoque_cpd_produtos")
        .select("*")
        .eq("organization_id", organizationId);

      if (estoquesError) throw estoquesError;
      
      // Mapear estoques com produtos
      const estoquesComProdutos = (estoquesData || []).map(est => ({
        ...est,
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

  // Buscar demandas das lojas
  const fetchDemandas = async () => {
    if (!organizationId) return;
    setLoadingDemandas(true);

    try {
      // Buscar estoques das lojas com mínimos configurados
      const { data: estoquesLojas, error: estoquesError } = await supabase
        .from("estoque_loja_produtos")
        .select(`
          loja_id,
          produto_id,
          quantidade,
          lojas!inner(nome),
          produtos!inner(nome, codigo)
        `)
        .eq("organization_id", organizationId);

      if (estoquesError) throw estoquesError;

      // Buscar mínimos semanais
      const hoje = new Date();
      const diaSemana = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][hoje.getDay()];

      const { data: minimosData, error: minimosError } = await supabase
        .from("produtos_estoque_minimo_semanal")
        .select("*")
        .eq("organization_id", organizationId);

      if (minimosError) throw minimosError;

      // Calcular demandas
      const demandasCalculadas: DemandaLoja[] = [];

      for (const estoque of estoquesLojas || []) {
        const minimo = minimosData?.find(
          m => m.produto_id === estoque.produto_id && m.loja_id === estoque.loja_id
        );
        
        const estoqueMinimo = minimo ? (minimo as any)[diaSemana] || 0 : 0;
        const necessidade = Math.max(0, estoqueMinimo - (estoque.quantidade || 0));

        if (necessidade > 0) {
          demandasCalculadas.push({
            loja_id: estoque.loja_id,
            loja_nome: (estoque.lojas as any)?.nome || "Loja",
            produto_id: estoque.produto_id,
            produto_nome: (estoque.produtos as any)?.nome || "Produto",
            produto_codigo: (estoque.produtos as any)?.codigo,
            estoque_atual: estoque.quantidade || 0,
            estoque_minimo: estoqueMinimo,
            necessidade,
          });
        }
      }

      setDemandas(demandasCalculadas.sort((a, b) => b.necessidade - a.necessidade));
    } catch (error: any) {
      console.error("Erro ao buscar demandas:", error);
      toast({
        title: "Erro ao carregar demandas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingDemandas(false);
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

  // Buscar lojas
  const fetchLojas = async () => {
    if (!organizationId) return;
    try {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      setLojas(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar lojas:", error);
    }
  };

  // Buscar romaneios de produtos pendentes
  const fetchRomaneiosProdutos = async () => {
    if (!organizationId) return;
    setLoadingRomaneios(true);
    try {
      const { data, error } = await supabase
        .from("romaneios_produtos")
        .select("*")
        .eq("organization_id", organizationId)
        .in("status", ["pendente", "enviado"])
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      setRomaneiosPendentes(data || []);

      // Buscar itens de cada romaneio pendente
      for (const romaneio of data || []) {
        const { data: itens } = await supabase
          .from("romaneios_produtos_itens")
          .select("*")
          .eq("romaneio_id", romaneio.id);
        
        setItensRomaneiosPendentes(prev => ({
          ...prev,
          [romaneio.id]: itens || []
        }));
      }
    } catch (error: any) {
      console.error("Erro ao buscar romaneios:", error);
    } finally {
      setLoadingRomaneios(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchLojas();
  }, [organizationId]);

  useEffect(() => {
    if (activeTab === "demandas") {
      fetchDemandas();
    } else if (activeTab === "receber") {
      fetchPedidos();
    } else if (activeTab === "enviar") {
      fetchRomaneiosProdutos();
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

      // Upsert no estoque
      const { error: estoqueError } = await supabase
        .from("estoque_cpd_produtos")
        .upsert({
          produto_id: produtoSelecionado,
          quantidade: quantidadeFinal,
          data_ultima_movimentacao: new Date().toISOString(),
          organization_id: organizationId,
        }, {
          onConflict: "organization_id,produto_id",
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

            // Upsert estoque
            const { error: estoqueError } = await supabase
              .from("estoque_cpd_produtos")
              .upsert({
                produto_id: itemOriginal.produto_id,
                quantidade: quantidadeFinal,
                data_ultima_movimentacao: new Date().toISOString(),
                organization_id: organizationId,
              }, {
                onConflict: "organization_id,produto_id",
              });

            if (estoqueError) throw estoqueError;

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

  // Funções de Romaneio de Produtos
  const produtosParaRomaneio = useMemo(() => {
    return produtos.filter(p => {
      const estoque = estoques.find(e => e.produto_id === p.id);
      const quantidade = estoque?.quantidade || 0;
      if (quantidade <= 0) return false;
      const matchSearch = searchRomaneio === "" ||
        p.nome.toLowerCase().includes(searchRomaneio.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(searchRomaneio.toLowerCase());
      return matchSearch;
    }).map(p => {
      const estoque = estoques.find(e => e.produto_id === p.id);
      return {
        ...p,
        quantidade: estoque?.quantidade || 0
      };
    });
  }, [produtos, estoques, searchRomaneio]);

  const handleAdicionarAoCarrinho = (produto: Produto & { quantidade: number }, qtd: number) => {
    if (qtd <= 0 || qtd > produto.quantidade) return;
    
    setCarrinhoRomaneio(prev => {
      const existente = prev.find(p => p.produto_id === produto.id);
      if (existente) {
        return prev.map(p =>
          p.produto_id === produto.id
            ? { ...p, quantidade: Math.min(p.quantidade + qtd, produto.quantidade) }
            : p
        );
      }
      return [...prev, {
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: qtd,
        unidade: produto.unidade_consumo
      }];
    });
  };

  const handleRemoverDoCarrinho = (produtoId: string) => {
    setCarrinhoRomaneio(prev => prev.filter(p => p.produto_id !== produtoId));
  };

  const handleCriarRomaneio = async () => {
    if (!organizationId || !profile || !lojaSelecionadaRomaneio || carrinhoRomaneio.length === 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione uma loja e adicione produtos ao carrinho.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const loja = lojas.find(l => l.id === lojaSelecionadaRomaneio);
      
      // Validar estoque disponível
      for (const item of carrinhoRomaneio) {
        const estoque = estoques.find(e => e.produto_id === item.produto_id);
        if (!estoque || estoque.quantidade < item.quantidade) {
          toast({
            title: "Estoque insuficiente",
            description: `Produto "${item.produto_nome}" não tem estoque suficiente.`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      }

      // Criar romaneio
      const { data: romaneioData, error: romaneioError } = await supabase
        .from("romaneios_produtos")
        .insert({
          loja_id: lojaSelecionadaRomaneio,
          loja_nome: loja?.nome || "Loja",
          usuario_id: profile.id,
          usuario_nome: profile.nome,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (romaneioError) throw romaneioError;

      // Criar itens do romaneio
      const itensParaInserir = carrinhoRomaneio.map(item => ({
        romaneio_id: romaneioData.id,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        unidade: item.unidade,
        organization_id: organizationId,
      }));

      const { error: itensError } = await supabase
        .from("romaneios_produtos_itens")
        .insert(itensParaInserir);

      if (itensError) throw itensError;

      toast({
        title: "Romaneio criado",
        description: `Romaneio para ${loja?.nome} criado com ${carrinhoRomaneio.length} produtos.`,
      });

      // Limpar carrinho
      setCarrinhoRomaneio([]);
      setLojaSelecionadaRomaneio("");
      setSearchRomaneio("");
      fetchRomaneiosProdutos();
    } catch (error: any) {
      console.error("Erro ao criar romaneio:", error);
      toast({
        title: "Erro ao criar romaneio",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarRomaneio = async (romaneioId: string) => {
    if (!organizationId || !profile) return;
    setEnviandoRomaneio(true);

    try {
      const itens = itensRomaneiosPendentes[romaneioId] || [];
      
      // Validar e decrementar estoque
      for (const item of itens) {
        const estoque = estoques.find(e => e.produto_id === item.produto_id);
        if (!estoque || estoque.quantidade < item.quantidade) {
          toast({
            title: "Estoque insuficiente",
            description: `Produto "${item.produto_nome}" não tem estoque suficiente. Disponível: ${estoque?.quantidade || 0}, Necessário: ${item.quantidade}`,
            variant: "destructive",
          });
          setEnviandoRomaneio(false);
          return;
        }
      }

      // Decrementar estoque e registrar movimentação
      for (const item of itens) {
        const estoque = estoques.find(e => e.produto_id === item.produto_id);
        const quantidadeAnterior = estoque?.quantidade || 0;
        const quantidadeFinal = quantidadeAnterior - item.quantidade;

        await supabase
          .from("estoque_cpd_produtos")
          .update({
            quantidade: quantidadeFinal,
            data_ultima_movimentacao: new Date().toISOString(),
          })
          .eq("produto_id", item.produto_id)
          .eq("organization_id", organizationId);

        await supabase
          .from("movimentacoes_cpd_produtos")
          .insert({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            tipo: "saida_romaneio",
            quantidade: item.quantidade,
            quantidade_anterior: quantidadeAnterior,
            quantidade_posterior: quantidadeFinal,
            observacao: `Romaneio #${romaneioId.slice(0, 8)}`,
            usuario_id: profile.id,
            usuario_nome: profile.nome,
            organization_id: organizationId,
          });
      }

      // Atualizar status do romaneio
      await supabase
        .from("romaneios_produtos")
        .update({
          status: "enviado",
          data_envio: new Date().toISOString(),
        })
        .eq("id", romaneioId);

      toast({
        title: "Romaneio enviado",
        description: "Estoque debitado e romaneio marcado como enviado.",
      });

      fetchData();
      fetchRomaneiosProdutos();
    } catch (error: any) {
      console.error("Erro ao enviar romaneio:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEnviandoRomaneio(false);
    }
  };

  const handleExcluirRomaneio = async (romaneioId: string) => {
    if (!confirm("Excluir este romaneio pendente?")) return;

    try {
      await supabase
        .from("romaneios_produtos")
        .delete()
        .eq("id", romaneioId);

      toast({ title: "Romaneio excluído" });
      fetchRomaneiosProdutos();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Estatísticas
  const stats = useMemo(() => {
    const total = produtosComEstoque.length;
    const comEstoque = produtosComEstoque.filter(p => p.quantidade > 0).length;
    const semEstoque = total - comEstoque;
    return { total, comEstoque, semEstoque };
  }, [produtosComEstoque]);

  // Estatísticas de demandas
  const demandaStats = useMemo(() => {
    const totalDemandas = demandas.length;
    const lojasAfetadas = new Set(demandas.map(d => d.loja_id)).size;
    return { totalDemandas, lojasAfetadas };
  }, [demandas]);

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
              Gerenciar estoque central de produtos lacrados, lotes e simples
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="estoque" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Estoque</span>
            </TabsTrigger>
            <TabsTrigger value="entrada" className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              <span className="hidden sm:inline">Entrada</span>
            </TabsTrigger>
            <TabsTrigger value="demandas" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Demandas</span>
            </TabsTrigger>
            <TabsTrigger value="enviar" className="gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Enviar Lojas</span>
              {romaneiosPendentes.filter(r => r.status === "pendente").length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {romaneiosPendentes.filter(r => r.status === "pendente").length}
                </Badge>
              )}
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
                  <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
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

          {/* Aba Demandas das Lojas */}
          <TabsContent value="demandas" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5" />
                      Demandas das Lojas
                    </CardTitle>
                    <CardDescription>
                      Produtos que as lojas precisam receber baseado no estoque mínimo configurado
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{demandaStats.totalDemandas} itens</Badge>
                    <Badge variant="secondary">{demandaStats.lojasAfetadas} lojas</Badge>
                    <Button variant="outline" size="sm" onClick={fetchDemandas} disabled={loadingDemandas}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingDemandas ? "animate-spin" : ""}`} />
                      Atualizar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDemandas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : demandas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                    <p className="text-lg font-medium">Todas as lojas estão abastecidas!</p>
                    <p className="text-sm">Nenhuma demanda pendente no momento.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loja</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Estoque Atual</TableHead>
                          <TableHead className="text-right">Mínimo</TableHead>
                          <TableHead className="text-right">Necessidade</TableHead>
                          <TableHead className="text-center">Status CPD</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {demandas.map((demanda, idx) => {
                          const estoqueCPD = estoques.find(e => e.produto_id === demanda.produto_id)?.quantidade || 0;
                          const suficiente = estoqueCPD >= demanda.necessidade;
                          const parcial = estoqueCPD > 0 && estoqueCPD < demanda.necessidade;
                          
                          return (
                            <TableRow key={`${demanda.loja_id}-${demanda.produto_id}-${idx}`}>
                              <TableCell className="font-medium">{demanda.loja_nome}</TableCell>
                              <TableCell>
                                <div>
                                  <p>{demanda.produto_nome}</p>
                                  {demanda.produto_codigo && (
                                    <p className="text-xs text-muted-foreground">{demanda.produto_codigo}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">{demanda.estoque_atual}</TableCell>
                              <TableCell className="text-right font-mono">{demanda.estoque_minimo}</TableCell>
                              <TableCell className="text-right font-mono font-bold text-primary">
                                {demanda.necessidade}
                              </TableCell>
                              <TableCell className="text-center">
                                {suficiente ? (
                                  <Badge className="bg-green-500">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    OK ({estoqueCPD})
                                  </Badge>
                                ) : parcial ? (
                                  <Badge variant="secondary" className="bg-amber-500 text-white">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Parcial ({estoqueCPD})
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Sem estoque
                                  </Badge>
                                )}
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
          </TabsContent>

          {/* Aba Enviar para Lojas */}
          <TabsContent value="enviar" className="space-y-4">
            {/* Criar Romaneio */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Criar Romaneio de Produtos
                </CardTitle>
                <CardDescription>
                  Selecione produtos do estoque CPD para enviar às lojas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Seleção de Loja */}
                <div className="space-y-2">
                  <Label>Loja de Destino</Label>
                  <Select value={lojaSelecionadaRomaneio} onValueChange={setLojaSelecionadaRomaneio}>
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue placeholder="Selecione a loja..." />
                    </SelectTrigger>
                    <SelectContent>
                      {lojas.map((loja) => (
                        <SelectItem key={loja.id} value={loja.id}>
                          {loja.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {lojaSelecionadaRomaneio && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Produtos Disponíveis */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Produtos Disponíveis</Label>
                        <Badge variant="outline">{produtosParaRomaneio.length} itens</Badge>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar produto..."
                          value={searchRomaneio}
                          onChange={(e) => setSearchRomaneio(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="border rounded-lg max-h-80 overflow-y-auto">
                        {produtosParaRomaneio.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">
                            Nenhum produto com estoque disponível
                          </div>
                        ) : (
                          <div className="divide-y">
                            {produtosParaRomaneio.slice(0, 20).map((produto) => (
                              <ProdutoRomaneioItem
                                key={produto.id}
                                produto={produto}
                                onAdicionar={handleAdicionarAoCarrinho}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Carrinho */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Carrinho
                        </Label>
                        <Badge>{carrinhoRomaneio.length} produtos</Badge>
                      </div>
                      <div className="border rounded-lg min-h-48">
                        {carrinhoRomaneio.length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground">
                            <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Adicione produtos ao carrinho</p>
                          </div>
                        ) : (
                          <div className="divide-y">
                            {carrinhoRomaneio.map((item) => (
                              <div key={item.produto_id} className="p-3 flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{item.produto_nome}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.quantidade} {item.unidade || "un"}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoverDoCarrinho(item.produto_id)}
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={handleCriarRomaneio}
                        disabled={saving || carrinhoRomaneio.length === 0}
                        className="w-full"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Criar Romaneio
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Romaneios Pendentes de Envio */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Romaneios Pendentes de Envio
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchRomaneiosProdutos} disabled={loadingRomaneios}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingRomaneios ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingRomaneios ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : romaneiosPendentes.filter(r => r.status === "pendente").length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                    <p>Nenhum romaneio pendente de envio</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {romaneiosPendentes
                      .filter(r => r.status === "pendente")
                      .map((romaneio) => {
                        const itens = itensRomaneiosPendentes[romaneio.id] || [];
                        return (
                          <div key={romaneio.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-semibold flex items-center gap-2">
                                  <Store className="h-4 w-4" />
                                  {romaneio.loja_nome}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {itens.length} produtos • Criado em {format(new Date(romaneio.data_criacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              <Badge>Pendente</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mb-3 space-y-1">
                              {itens.map((item) => (
                                <div key={item.id} className="flex justify-between">
                                  <span>{item.produto_nome}</span>
                                  <span className="font-mono">{item.quantidade} {item.unidade || "un"}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExcluirRomaneio(romaneio.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleEnviarRomaneio(romaneio.id)}
                                disabled={enviandoRomaneio}
                              >
                                {enviandoRomaneio ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4 mr-1" />
                                )}
                                Enviar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
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
