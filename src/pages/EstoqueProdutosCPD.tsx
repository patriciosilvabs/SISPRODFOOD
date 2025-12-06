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
  RefreshCw
} from "lucide-react";

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

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  useEffect(() => {
    if (activeTab === "demandas") {
      fetchDemandas();
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="estoque" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Estoque Atual</span>
              <span className="sm:hidden">Estoque</span>
            </TabsTrigger>
            <TabsTrigger value="entrada" className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              <span className="hidden sm:inline">Registrar Entrada</span>
              <span className="sm:hidden">Entrada</span>
            </TabsTrigger>
            <TabsTrigger value="demandas" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Demandas das Lojas</span>
              <span className="sm:hidden">Demandas</span>
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
        </Tabs>
      </div>
    </Layout>
  );
}
