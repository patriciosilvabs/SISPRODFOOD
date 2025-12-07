import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Package, PackageCheck, AlertCircle, CheckCircle, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { SaveButton } from '@/components/ui/save-button';

interface Loja {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  codigo: string | null;
  categoria: string;
  unidade_consumo: string | null;
}

interface EstoqueAtual {
  produto_id: string;
  quantidade: number;
  quantidade_ultimo_envio?: number;
  data_ultima_contagem?: string;
  data_ultimo_envio?: string;
  data_confirmacao_recebimento?: string;
}

interface ProdutoEstoque extends Produto {
  estoque_atual: number;
  status: 'critico' | 'atencao' | 'ok';
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
  quantidade_recebida: number | null;
  divergencia: boolean;
  observacao_divergencia: string | null;
}

const EstoqueLoja = () => {
  const { user, hasRole, isAdmin } = useAuth();
  const { organizationId } = useOrganization();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaSelecionada, setLojaSelecionada] = useState<string>('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [estoquesAtuais, setEstoquesAtuais] = useState<EstoqueAtual[]>([]);
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>('');
  const [originalEstoques, setOriginalEstoques] = useState<{ [key: string]: number }>({});
  const [hasDirtyEstoque, setHasDirtyEstoque] = useState(false);

  // Estados para Romaneios de Produtos
  const [romaneiosParaReceber, setRomaneiosParaReceber] = useState<RomaneioProduto[]>([]);
  const [itensRomaneioParaReceber, setItensRomaneioParaReceber] = useState<{ [key: string]: RomaneioProdutoItem[] }>({});
  const [loadingRomaneios, setLoadingRomaneios] = useState(false);
  const [receivingRomaneio, setReceivingRomaneio] = useState(false);
  const [quantidadesRecebidasRomaneio, setQuantidadesRecebidasRomaneio] = useState<{ [key: string]: number }>({});
  const [observacoesRomaneio, setObservacoesRomaneio] = useState<{ [key: string]: string }>({});

  // Buscar lojas do usuário
  useEffect(() => {
    const fetchLojas = async () => {
      if (!user) return;

      try {
        // Verificar se é Admin
        const isUserAdmin = isAdmin();

        let lojasData: Loja[] = [];

        if (isUserAdmin) {
          // Admin vê todas as lojas
          const { data: todasLojas, error: lojasError } = await supabase
            .from('lojas')
            .select('id, nome')
            .order('nome');

          if (lojasError) throw lojasError;
          lojasData = todasLojas || [];
        } else {
          // Usuário comum só vê lojas de lojas_acesso
          const { data: lojasAcesso, error: acessoError } = await supabase
            .from('lojas_acesso')
            .select('loja_id')
            .eq('user_id', user.id);

          if (acessoError) throw acessoError;

          if (!lojasAcesso || lojasAcesso.length === 0) {
            setLojas([]);
            return;
          }

          const lojasIds = lojasAcesso.map(la => la.loja_id);
          const { data: lojasDados, error: lojasError } = await supabase
            .from('lojas')
            .select('id, nome')
            .in('id', lojasIds);

          if (lojasError) throw lojasError;
          lojasData = lojasDados || [];
        }

        setLojas(lojasData);
        if (lojasData.length > 0 && !lojaSelecionada) {
          setLojaSelecionada(lojasData[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar lojas:', error);
        toast.error('Erro ao carregar lojas');
      }
    };

    fetchLojas();
  }, [user]);

  // Buscar produtos e estoques
  useEffect(() => {
    const fetchDados = async () => {
      if (!lojaSelecionada) return;

      try {
        setLoading(true);

        // Buscar produtos
        const { data: produtosData, error: produtosError } = await supabase
          .from('produtos')
          .select('id, nome, codigo, categoria, unidade_consumo')
          .eq('ativo', true)
          .order('nome');

        if (produtosError) throw produtosError;
        setProdutos(produtosData || []);

        // Buscar estoques atuais da loja
        const { data: estoquesAtuaisData, error: estoquesAtuaisError } = await supabase
          .from('estoque_loja_produtos')
          .select('produto_id, quantidade, quantidade_ultimo_envio, data_ultima_atualizacao, usuario_nome, data_ultima_contagem, data_ultimo_envio, data_confirmacao_recebimento')
          .eq('loja_id', lojaSelecionada);

        if (estoquesAtuaisError) throw estoquesAtuaisError;
        
        const estoquesMap = (estoquesAtuaisData || []).map(e => ({
          produto_id: e.produto_id,
          quantidade: Number(e.quantidade),
          quantidade_ultimo_envio: e.quantidade_ultimo_envio ? Number(e.quantidade_ultimo_envio) : undefined,
          data_ultima_contagem: e.data_ultima_contagem,
          data_ultimo_envio: e.data_ultimo_envio,
          data_confirmacao_recebimento: e.data_confirmacao_recebimento
        }));
        setEstoquesAtuais(estoquesMap);
        
        // Salvar valores originais
        const originals: { [key: string]: number } = {};
        estoquesMap.forEach(e => {
          originals[e.produto_id] = e.quantidade;
        });
        setOriginalEstoques(originals);
        setHasDirtyEstoque(false);

        // Última atualização
        if (estoquesAtuaisData && estoquesAtuaisData.length > 0) {
          const maisRecente = estoquesAtuaisData.reduce((prev, current) => 
            new Date(current.data_ultima_atualizacao) > new Date(prev.data_ultima_atualizacao) 
              ? current 
              : prev
          );
          const data = new Date(maisRecente.data_ultima_atualizacao);
          setUltimaAtualizacao(
            `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por ${maisRecente.usuario_nome || 'Usuário'}`
          );
        } else {
          setUltimaAtualizacao('');
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchDados();
  }, [lojaSelecionada]);

  // Buscar romaneios para receber
  const fetchRomaneiosProdutos = async () => {
    if (!lojaSelecionada || !organizationId) return;
    setLoadingRomaneios(true);
    try {
      const { data, error } = await supabase
        .from("romaneios_produtos")
        .select("*")
        .eq("loja_id", lojaSelecionada)
        .eq("status", "enviado")
        .order("data_envio", { ascending: false });

      if (error) throw error;
      setRomaneiosParaReceber(data || []);

      for (const romaneio of data || []) {
        const { data: itens } = await supabase
          .from("romaneios_produtos_itens")
          .select("*")
          .eq("romaneio_id", romaneio.id);
        
        setItensRomaneioParaReceber(prev => ({
          ...prev,
          [romaneio.id]: itens || []
        }));
        
        (itens || []).forEach(item => {
          setQuantidadesRecebidasRomaneio(prev => ({
            ...prev,
            [item.id]: item.quantidade
          }));
        });
      }
    } catch (error: any) {
      console.error("Erro ao buscar romaneios:", error);
    } finally {
      setLoadingRomaneios(false);
    }
  };

  useEffect(() => {
    if (lojaSelecionada) {
      fetchRomaneiosProdutos();
    }
  }, [lojaSelecionada, organizationId]);

  // Confirmar recebimento de romaneio
  const handleConfirmarRecebimentoRomaneio = async (romaneioId: string) => {
    if (!user || !organizationId) return;
    setReceivingRomaneio(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      const usuarioNome = profile?.nome || user.email || 'Usuário';
      const itens = itensRomaneioParaReceber[romaneioId] || [];

      for (const item of itens) {
        const qtdRecebida = quantidadesRecebidasRomaneio[item.id] ?? item.quantidade;
        const divergencia = qtdRecebida !== item.quantidade;
        const obs = observacoesRomaneio[item.id] || null;

        await supabase
          .from("romaneios_produtos_itens")
          .update({
            quantidade_recebida: qtdRecebida,
            divergencia,
            observacao_divergencia: divergencia ? obs : null,
          })
          .eq("id", item.id);

        // Atualizar estoque da loja
        const { data: estoqueAtual } = await supabase
          .from("estoque_loja_produtos")
          .select("quantidade")
          .eq("loja_id", lojaSelecionada)
          .eq("produto_id", item.produto_id)
          .single();

        const novaQuantidade = (estoqueAtual?.quantidade || 0) + qtdRecebida;

        await supabase
          .from("estoque_loja_produtos")
          .upsert({
            loja_id: lojaSelecionada,
            produto_id: item.produto_id,
            quantidade: novaQuantidade,
            usuario_id: user.id,
            usuario_nome: usuarioNome,
            data_ultima_atualizacao: new Date().toISOString(),
            data_confirmacao_recebimento: new Date().toISOString(),
            organization_id: organizationId,
          }, { onConflict: "loja_id,produto_id" });
      }

      await supabase
        .from("romaneios_produtos")
        .update({
          status: "recebido",
          data_recebimento: new Date().toISOString(),
          recebido_por_id: user.id,
          recebido_por_nome: usuarioNome,
        })
        .eq("id", romaneioId);

      toast.success("Romaneio recebido com sucesso!");
      fetchRomaneiosProdutos();
    } catch (error: any) {
      console.error("Erro ao confirmar recebimento:", error);
      toast.error("Erro ao confirmar recebimento");
    } finally {
      setReceivingRomaneio(false);
    }
  };

  // Produtos com estoque
  const produtosComEstoque = useMemo((): ProdutoEstoque[] => {
    return produtos.map(produto => {
      const estoqueAtualObj = estoquesAtuais.find(e => e.produto_id === produto.id);
      const estoqueAtual = estoqueAtualObj ? estoqueAtualObj.quantidade : 0;

      let status: 'critico' | 'atencao' | 'ok' = 'ok';
      if (estoqueAtual === 0) status = 'critico';
      else if (estoqueAtual < 5) status = 'atencao';

      return {
        ...produto,
        estoque_atual: estoqueAtual,
        status
      };
    });
  }, [produtos, estoquesAtuais]);

  // Filtrar por categoria
  const produtosFiltrados = useMemo(() => {
    if (categoriaFilter === 'todas') return produtosComEstoque;
    return produtosComEstoque.filter(p => p.categoria === categoriaFilter);
  }, [produtosComEstoque, categoriaFilter]);

  // Categorias únicas
  const categorias = useMemo(() => {
    const cats = [...new Set(produtos.map(p => p.categoria))];
    return cats.sort();
  }, [produtos]);

  // Atualizar estoque
  const handleEstoqueChange = (produtoId: string, valor: string) => {
    const quantidade = valor === '' ? 0 : Number(valor);
    
    setEstoquesAtuais(prev => {
      const existente = prev.find(e => e.produto_id === produtoId);
      if (existente) {
        return prev.map(e => 
          e.produto_id === produtoId 
            ? { ...e, quantidade } 
            : e
        );
      } else {
        return [...prev, { produto_id: produtoId, quantidade }];
      }
    });
    
    const originalVal = originalEstoques[produtoId] ?? 0;
    if (quantidade !== originalVal) {
      setHasDirtyEstoque(true);
    } else {
      const stillDirty = estoquesAtuais.some(e => {
        if (e.produto_id === produtoId) return false;
        const origVal = originalEstoques[e.produto_id] ?? 0;
        return e.quantidade !== origVal;
      });
      setHasDirtyEstoque(stillDirty);
    }
  };

  // Salvar estoques
  const handleSalvar = async () => {
    if (!user || !lojaSelecionada) return;

    try {
      setSaving(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      const usuarioNome = profile?.nome || user.email || 'Usuário';

      const dados = estoquesAtuais.map(e => ({
        loja_id: lojaSelecionada,
        produto_id: e.produto_id,
        quantidade: e.quantidade,
        usuario_id: user.id,
        usuario_nome: usuarioNome,
        data_ultima_atualizacao: new Date().toISOString(),
        data_ultima_contagem: new Date().toISOString(),
        organization_id: organizationId
      }));

      const { error } = await supabase
        .from('estoque_loja_produtos')
        .upsert(dados, { onConflict: 'loja_id,produto_id' });

      if (error) throw error;

      toast.success('Estoque atualizado com sucesso!');
      
      const { data: dadosAtualizados } = await supabase
        .from('estoque_loja_produtos')
        .select('produto_id, quantidade, quantidade_ultimo_envio, data_ultima_contagem, data_ultimo_envio, data_confirmacao_recebimento')
        .eq('loja_id', lojaSelecionada);

      if (dadosAtualizados) {
        const estoquesMap = dadosAtualizados.map(e => ({
          produto_id: e.produto_id,
          quantidade: Number(e.quantidade),
          quantidade_ultimo_envio: e.quantidade_ultimo_envio ? Number(e.quantidade_ultimo_envio) : undefined,
          data_ultima_contagem: e.data_ultima_contagem,
          data_ultimo_envio: e.data_ultimo_envio,
          data_confirmacao_recebimento: e.data_confirmacao_recebimento
        }));
        setEstoquesAtuais(estoquesMap);
        
        const originals: { [key: string]: number } = {};
        estoquesMap.forEach(e => {
          originals[e.produto_id] = e.quantidade;
        });
        setOriginalEstoques(originals);
        setHasDirtyEstoque(false);
      }
      
      const agoraDate = new Date();
      setUltimaAtualizacao(
        `${agoraDate.toLocaleDateString('pt-BR')} às ${agoraDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por ${usuarioNome}`
      );
    } catch (error) {
      console.error('Erro ao salvar estoque:', error);
      toast.error('Erro ao salvar estoque');
    } finally {
      setSaving(false);
    }
  };

  const StatusIcon = ({ status }: { status: 'critico' | 'atencao' | 'ok' }) => {
    switch (status) {
      case 'critico':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'atencao':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Faça login para acessar esta página.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Meu Estoque</h1>
          <p className="text-muted-foreground mt-1">
            Informe o estoque atual de produtos da sua loja
          </p>
        </div>

        <Tabs defaultValue="estoque" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="estoque" className="gap-2">
              <Package className="h-4 w-4" />
              Meu Estoque
            </TabsTrigger>
            <TabsTrigger value="receber" className="gap-2">
              <PackageCheck className="h-4 w-4" />
              Receber Reposição
              {romaneiosParaReceber.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {romaneiosParaReceber.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ABA: MEU ESTOQUE */}
          <TabsContent value="estoque">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Informar Estoque Atual
                </CardTitle>
                <CardDescription>
                  Informe a quantidade atual de cada produto na loja
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filtros */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Selecione a Loja</label>
                    <Select value={lojaSelecionada} onValueChange={setLojaSelecionada}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma loja" />
                      </SelectTrigger>
                      <SelectContent>
                        {lojas.map(loja => (
                          <SelectItem key={loja.id} value={loja.id}>
                            {loja.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Filtrar por Categoria</label>
                    <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as categorias</SelectItem>
                        {categorias.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Última atualização */}
                {ultimaAtualizacao && (
                  <div className="text-sm text-muted-foreground">
                    Última atualização: {ultimaAtualizacao}
                  </div>
                )}

                {/* Tabela de Produtos */}
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : produtosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">Produto</th>
                          <th className="text-left p-3 font-medium">Código</th>
                          <th className="text-left p-3 font-medium">Unid.</th>
                          <th className="text-center p-3 font-medium">Estoque Atual</th>
                          <th className="text-center p-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produtosFiltrados.map(produto => (
                          <tr key={produto.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">{produto.nome}</td>
                            <td className="p-3 text-muted-foreground">{produto.codigo || '-'}</td>
                            <td className="p-3 text-muted-foreground">{produto.unidade_consumo || 'unid.'}</td>
                            <td className="p-3">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={produto.estoque_atual || ''}
                                onChange={(e) => handleEstoqueChange(produto.id, e.target.value)}
                                className="w-24 mx-auto text-center"
                                placeholder="0"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center">
                                <StatusIcon status={produto.status} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Botão Salvar */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSalvar}
                    disabled={!hasDirtyEstoque || saving}
                    className="gap-2"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                    {saving ? 'Salvando...' : 'Salvar Estoque'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: RECEBER REPOSIÇÃO */}
          <TabsContent value="receber">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5" />
                  Reposições para Receber
                </CardTitle>
                <CardDescription>
                  Confirme o recebimento dos produtos enviados pelo CPD
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Seletor de Loja */}
                <div className="mb-4">
                  <label className="text-sm font-medium">Selecione a Loja</label>
                  <Select value={lojaSelecionada} onValueChange={setLojaSelecionada}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione uma loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {lojas.map(loja => (
                        <SelectItem key={loja.id} value={loja.id}>
                          {loja.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loadingRomaneios ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : romaneiosParaReceber.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
                    <p className="text-lg font-medium">Nenhuma reposição pendente!</p>
                    <p className="text-sm">Todas as reposições foram recebidas.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {romaneiosParaReceber.map((romaneio) => {
                      const itens = itensRomaneioParaReceber[romaneio.id] || [];
                      return (
                        <div key={romaneio.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Reposição #{romaneio.id.slice(0, 8)}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Enviado em {romaneio.data_envio ? format(new Date(romaneio.data_envio), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                              </p>
                            </div>
                            <Badge variant="secondary">Enviado</Badge>
                          </div>
                          
                          <table className="w-full border-collapse mb-4">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-2">Produto</th>
                                <th className="text-center p-2">Enviado</th>
                                <th className="text-center p-2">Recebido</th>
                                <th className="text-center p-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itens.map((item) => {
                                const qtdRecebida = quantidadesRecebidasRomaneio[item.id] ?? item.quantidade;
                                const divergencia = qtdRecebida !== item.quantidade;
                                return (
                                  <tr key={item.id} className="border-b">
                                    <td className="p-2">{item.produto_nome}</td>
                                    <td className="p-2 text-center">{item.quantidade} {item.unidade || "un"}</td>
                                    <td className="p-2">
                                      <Input
                                        type="number"
                                        min={0}
                                        value={qtdRecebida}
                                        onChange={(e) => setQuantidadesRecebidasRomaneio(prev => ({
                                          ...prev,
                                          [item.id]: Number(e.target.value)
                                        }))}
                                        className="w-20 mx-auto text-center"
                                      />
                                    </td>
                                    <td className="p-2 text-center">
                                      {divergencia ? (
                                        <Badge variant="destructive">Divergência</Badge>
                                      ) : (
                                        <Badge className="bg-green-500">OK</Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          
                          <div className="flex justify-end">
                            <Button
                              onClick={() => handleConfirmarRecebimentoRomaneio(romaneio.id)}
                              disabled={receivingRomaneio}
                              className="gap-2"
                            >
                              {receivingRomaneio ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PackageCheck className="h-4 w-4" />
                              )}
                              Confirmar Recebimento
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
        </Tabs>
      </div>
    </Layout>
  );
};

export default EstoqueLoja;
