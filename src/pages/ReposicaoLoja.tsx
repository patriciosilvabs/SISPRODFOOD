import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCPDLoja } from '@/hooks/useCPDLoja';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Store, Package, Truck, AlertCircle, CheckCircle, Loader2, RefreshCw, Clock, History, TrendingDown, Settings, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface EstoqueCPD {
  produto_id: string;
  quantidade: number;
}

interface EstoqueLoja {
  loja_id: string;
  produto_id: string;
  quantidade: number;
  data_ultima_contagem: string | null;
  usuario_nome: string | null;
}

interface EstoqueMinimoSemanal {
  loja_id: string;
  produto_id: string;
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

interface DemandaCalculada {
  loja: Loja;
  produto: Produto;
  estoque_atual: number;
  estoque_ideal: number;
  deficit: number;
  estoque_cpd: number;
  quantidade_envio: number;
  data_ultima_contagem: string | null;
  usuario_informou: string | null;
}

interface RomaneioAguardando {
  id: string;
  loja_id: string;
  loja_nome: string;
  usuario_nome: string;
  data_envio: string;
  observacao: string | null;
  itens: {
    produto_id: string;
    produto_nome: string;
    quantidade: number;
    unidade: string;
  }[];
}

interface RomaneioHistorico {
  id: string;
  loja_id: string;
  loja_nome: string;
  usuario_nome: string;
  data_envio: string;
  data_recebimento: string | null;
  recebido_por_nome: string | null;
  observacao: string | null;
  itens: {
    produto_id: string;
    produto_nome: string;
    quantidade: number;
    quantidade_recebida: number | null;
    divergencia: boolean;
    unidade: string;
  }[];
}

// Helper para obter o dia da semana em português
const getDiaSemana = (): keyof Omit<EstoqueMinimoSemanal, 'loja_id' | 'produto_id'> => {
  const dias: (keyof Omit<EstoqueMinimoSemanal, 'loja_id' | 'produto_id'>)[] = [
    'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'
  ];
  return dias[new Date().getDay()];
};

const ReposicaoLoja = () => {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const { cpdLojaId } = useCPDLoja();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaSelecionada, setLojaSelecionada] = useState<string>('todas');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [estoqueCPD, setEstoqueCPD] = useState<EstoqueCPD[]>([]);
  const [estoquesLojas, setEstoquesLojas] = useState<EstoqueLoja[]>([]);
  const [estoquesMinimos, setEstoquesMinimos] = useState<EstoqueMinimoSemanal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [quantidadesEnvio, setQuantidadesEnvio] = useState<{ [key: string]: number }>({});
  const [itensEnviados, setItensEnviados] = useState<Set<string>>(new Set());
  
  // Estados para as abas
  const [romaneiosAguardando, setRomaneiosAguardando] = useState<RomaneioAguardando[]>([]);
  const [romaneiosHistorico, setRomaneiosHistorico] = useState<RomaneioHistorico[]>([]);

  // Buscar dados
  const fetchDados = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      // Buscar lojas (excluindo CPD)
      const { data: lojasData, error: lojasError } = await supabase
        .from('lojas')
        .select('id, nome')
        .neq('tipo', 'cpd')
        .order('nome');

      if (lojasError) throw lojasError;
      setLojas(lojasData || []);

      // Buscar produtos
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('id, nome, codigo, categoria, unidade_consumo')
        .eq('ativo', true)
        .order('nome');

      if (produtosError) throw produtosError;
      setProdutos(produtosData || []);

      // Buscar estoque CPD
      if (cpdLojaId) {
        const { data: estoqueCPDData, error: estoqueCPDError } = await supabase
          .from('estoque_loja_produtos')
          .select('produto_id, quantidade')
          .eq('loja_id', cpdLojaId);

        if (estoqueCPDError) throw estoqueCPDError;
        setEstoqueCPD(estoqueCPDData || []);
      } else {
        setEstoqueCPD([]);
      }

      // Buscar estoque atual de todas as lojas (que informaram)
      const { data: estoquesLojasData, error: estoquesLojasError } = await supabase
        .from('estoque_loja_produtos')
        .select('loja_id, produto_id, quantidade, data_ultima_contagem, usuario_nome')
        .not('data_ultima_contagem', 'is', null);

      if (estoquesLojasError) throw estoquesLojasError;
      setEstoquesLojas(estoquesLojasData || []);

      // Buscar estoques mínimos semanais
      const { data: estoquesMinimosData, error: estoquesMinimosError } = await supabase
        .from('produtos_estoque_minimo_semanal')
        .select('loja_id, produto_id, segunda, terca, quarta, quinta, sexta, sabado, domingo');

      if (estoquesMinimosError) throw estoquesMinimosError;
      setEstoquesMinimos(estoquesMinimosData || []);

      // Buscar romaneios enviados (aguardando confirmação)
      const { data: romaneiosEnviadosData, error: romaneiosEnviadosError } = await supabase
        .from('romaneios_produtos')
        .select(`
          id, loja_id, loja_nome, usuario_nome, data_envio, observacao,
          romaneios_produtos_itens (produto_id, produto_nome, quantidade, unidade)
        `)
        .eq('status', 'enviado')
        .order('data_envio', { ascending: false });

      if (romaneiosEnviadosError) throw romaneiosEnviadosError;

      const aguardando: RomaneioAguardando[] = (romaneiosEnviadosData || []).map(r => ({
        id: r.id,
        loja_id: r.loja_id,
        loja_nome: r.loja_nome,
        usuario_nome: r.usuario_nome,
        data_envio: r.data_envio || '',
        observacao: r.observacao,
        itens: (r.romaneios_produtos_itens || []).map((i: any) => ({
          produto_id: i.produto_id,
          produto_nome: i.produto_nome,
          quantidade: i.quantidade,
          unidade: i.unidade || 'un'
        }))
      }));
      setRomaneiosAguardando(aguardando);

      // Buscar histórico (recebidos)
      const { data: romaneiosHistoricoData, error: romaneiosHistoricoError } = await supabase
        .from('romaneios_produtos')
        .select(`
          id, loja_id, loja_nome, usuario_nome, data_envio, data_recebimento, recebido_por_nome, observacao,
          romaneios_produtos_itens (produto_id, produto_nome, quantidade, quantidade_recebida, divergencia, unidade)
        `)
        .eq('status', 'recebido')
        .order('data_recebimento', { ascending: false })
        .limit(50);

      if (romaneiosHistoricoError) throw romaneiosHistoricoError;

      const historico: RomaneioHistorico[] = (romaneiosHistoricoData || []).map(r => ({
        id: r.id,
        loja_id: r.loja_id,
        loja_nome: r.loja_nome,
        usuario_nome: r.usuario_nome,
        data_envio: r.data_envio || '',
        data_recebimento: r.data_recebimento,
        recebido_por_nome: r.recebido_por_nome,
        observacao: r.observacao,
        itens: (r.romaneios_produtos_itens || []).map((i: any) => ({
          produto_id: i.produto_id,
          produto_nome: i.produto_nome,
          quantidade: i.quantidade,
          quantidade_recebida: i.quantidade_recebida,
          divergencia: i.divergencia || false,
          unidade: i.unidade || 'un'
        }))
      }));
      setRomaneiosHistorico(historico);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados de reposição');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cpdLojaId) {
      fetchDados();
    }
  }, [organizationId, cpdLojaId]);

  // Calcular demandas baseadas no DÉFICIT (estoque ideal - estoque atual)
  const demandas = useMemo((): DemandaCalculada[] => {
    const diaSemana = getDiaSemana();
    const demandasCalculadas: DemandaCalculada[] = [];

    // Para cada loja que informou estoque
    const lojasQueInformaram = new Set(estoquesLojas.map(e => e.loja_id));
    
    // Filtrar lojas (excluindo CPD)
    const lojasValidas = lojas.filter(l => {
      if (lojaSelecionada !== 'todas' && l.id !== lojaSelecionada) return false;
      return lojasQueInformaram.has(l.id);
    });

    lojasValidas.forEach(loja => {
      produtos.forEach(produto => {
        // Buscar estoque mínimo do dia para este produto/loja
        const minimoSemanal = estoquesMinimos.find(
          em => em.loja_id === loja.id && em.produto_id === produto.id
        );
        
        if (!minimoSemanal) return; // Se não tem mínimo configurado, pular

        const estoqueIdeal = minimoSemanal[diaSemana] || 0;
        if (estoqueIdeal <= 0) return; // Se estoque ideal é 0, pular

        // Buscar estoque atual da loja
        const estoqueLojaData = estoquesLojas.find(
          el => el.loja_id === loja.id && el.produto_id === produto.id
        );
        
        if (!estoqueLojaData) return; // Se loja não informou este produto, pular

        const estoqueAtual = estoqueLojaData.quantidade || 0;
        const deficit = estoqueIdeal - estoqueAtual;

        // Só adicionar se tem déficit (estoque atual < estoque ideal)
        if (deficit <= 0) return;

        // Buscar estoque CPD
        const estoqueCPDItem = estoqueCPD.find(e => e.produto_id === produto.id);
        const estoqueAtualCPD = estoqueCPDItem?.quantidade || 0;

        const key = `${loja.id}-${produto.id}`;

        demandasCalculadas.push({
          loja,
          produto,
          estoque_atual: estoqueAtual,
          estoque_ideal: estoqueIdeal,
          deficit,
          estoque_cpd: estoqueAtualCPD,
          quantidade_envio: quantidadesEnvio[key] ?? deficit,
          data_ultima_contagem: estoqueLojaData.data_ultima_contagem,
          usuario_informou: estoqueLojaData.usuario_nome
        });
      });
    });

    // Filtrar itens já enviados na sessão atual
    const demandasFiltradas = demandasCalculadas.filter(d => {
      const key = `${d.loja.id}-${d.produto.id}`;
      return !itensEnviados.has(key);
    });

    // Ordenar por déficit (maior primeiro)
    return demandasFiltradas.sort((a, b) => b.deficit - a.deficit);
  }, [lojas, produtos, estoquesLojas, estoquesMinimos, estoqueCPD, lojaSelecionada, quantidadesEnvio, itensEnviados]);

  // Inicializar quantidades de envio
  useEffect(() => {
    const novasQuantidades: { [key: string]: number } = {};
    demandas.forEach(d => {
      const key = `${d.loja.id}-${d.produto.id}`;
      if (quantidadesEnvio[key] === undefined) {
        novasQuantidades[key] = d.deficit;
      }
    });
    if (Object.keys(novasQuantidades).length > 0) {
      setQuantidadesEnvio(prev => ({ ...prev, ...novasQuantidades }));
    }
  }, [demandas]);

  // Atualizar quantidade de envio
  const handleQuantidadeChange = (lojaId: string, produtoId: string, valor: string) => {
    const key = `${lojaId}-${produtoId}`;
    const quantidade = valor === '' ? 0 : Number(valor);
    setQuantidadesEnvio(prev => ({ ...prev, [key]: quantidade }));
  };

  // Enviar item individual
  const handleEnviarItem = async (item: DemandaCalculada, quantidade: number) => {
    if (!user || !organizationId || !cpdLojaId) return;
    
    if (quantidade <= 0) {
      toast.error('Quantidade deve ser maior que zero');
      return;
    }
    
    if (quantidade > item.estoque_cpd) {
      toast.error(`Estoque CPD insuficiente: disponível ${item.estoque_cpd}, solicitado ${quantidade}`);
      return;
    }

    try {
      setSending(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      const usuarioNome = profile?.nome || user.email || 'Usuário';

      // Criar romaneio
      const { data: romaneio, error: romaneioError } = await supabase
        .from('romaneios_produtos')
        .insert({
          loja_id: item.loja.id,
          loja_nome: item.loja.nome,
          usuario_id: user.id,
          usuario_nome: usuarioNome,
          status: 'enviado',
          data_criacao: new Date().toISOString(),
          data_envio: new Date().toISOString(),
          observacao: null,
          organization_id: organizationId
        })
        .select()
        .single();

      if (romaneioError) throw romaneioError;

      // Inserir item no romaneio
      await supabase
        .from('romaneios_produtos_itens')
        .insert({
          romaneio_id: romaneio.id,
          produto_id: item.produto.id,
          produto_nome: item.produto.nome,
          quantidade: quantidade,
          unidade: item.produto.unidade_consumo || 'un',
          organization_id: organizationId
        });

      // Debitar estoque CPD
      const novoEstoqueCPD = item.estoque_cpd - quantidade;
      await supabase
        .from('estoque_loja_produtos')
        .update({ 
          quantidade: novoEstoqueCPD,
          data_ultima_atualizacao: new Date().toISOString()
        })
        .eq('loja_id', cpdLojaId)
        .eq('produto_id', item.produto.id);

      // Registrar movimentação CPD
      await supabase
        .from('movimentacoes_cpd_produtos')
        .insert({
          produto_id: item.produto.id,
          produto_nome: item.produto.nome,
          quantidade: quantidade,
          quantidade_anterior: item.estoque_cpd,
          quantidade_posterior: novoEstoqueCPD,
          tipo: 'saida_romaneio',
          observacao: `Reposição para ${item.loja.nome}`,
          usuario_id: user.id,
          usuario_nome: usuarioNome,
          organization_id: organizationId
        });

      toast.success(`${item.produto.nome} enviado para ${item.loja.nome}`);
      
      // Marcar item como enviado para remover da tela imediatamente
      const key = `${item.loja.id}-${item.produto.id}`;
      setItensEnviados(prev => new Set(prev).add(key));
      
      // Atualizar estoque CPD localmente
      setEstoqueCPD(prev => prev.map(e => 
        e.produto_id === item.produto.id 
          ? { ...e, quantidade: e.quantidade - quantidade }
          : e
      ));
    } catch (error) {
      console.error('Erro ao enviar item:', error);
      toast.error('Erro ao enviar item');
    } finally {
      setSending(false);
    }
  };

  // Agrupar demandas por loja
  const demandasPorLoja = useMemo(() => {
    const agrupado = new Map<string, DemandaCalculada[]>();
    demandas.forEach(d => {
      const lista = agrupado.get(d.loja.id) || [];
      lista.push(d);
      agrupado.set(d.loja.id, lista);
    });
    return agrupado;
  }, [demandas]);

  // Verificar lojas sem configuração de estoque mínimo
  const diagnosticoLojas = useMemo(() => {
    const lojasComMinimo = new Set(estoquesMinimos.map(em => em.loja_id));
    const lojasQueInformaram = new Set(estoquesLojas.map(e => e.loja_id));
    
    const lojasSemMinimo = lojas.filter(l => !lojasComMinimo.has(l.id));
    const lojasComMinimoSemDemanda = lojas.filter(l => 
      lojasComMinimo.has(l.id) && 
      lojasQueInformaram.has(l.id) && 
      !demandasPorLoja.has(l.id)
    );
    const lojasQueNaoInformaram = lojas.filter(l => !lojasQueInformaram.has(l.id));
    
    // Loja específica selecionada
    const lojaSelecionadaSemMinimo = lojaSelecionada !== 'todas' && !lojasComMinimo.has(lojaSelecionada);
    const lojaSelecionadaNaoInformou = lojaSelecionada !== 'todas' && !lojasQueInformaram.has(lojaSelecionada);
    
    return {
      lojasSemMinimo,
      lojasComMinimoSemDemanda,
      lojasQueNaoInformaram,
      lojaSelecionadaSemMinimo,
      lojaSelecionadaNaoInformou,
      temAlgumaConfiguracao: estoquesMinimos.length > 0
    };
  }, [lojas, estoquesMinimos, estoquesLojas, demandasPorLoja, lojaSelecionada]);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Store className="h-8 w-8" />
              Reposição de Loja
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize demandas calculadas automaticamente e envie os produtos necessários
            </p>
          </div>
          <Button onClick={() => { setItensEnviados(new Set()); fetchDados(); }} disabled={loading} className="!bg-green-600 hover:!bg-green-700 text-white">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <Tabs defaultValue="pendentes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pendentes" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Demandas de Reposição
              {demandas.length > 0 && (
                <Badge variant="destructive" className="ml-1">{demandas.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="aguardando" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Aguardando Confirmação
              {romaneiosAguardando.length > 0 && (
                <Badge variant="secondary" className="ml-1">{romaneiosAguardando.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico Finalizado
            </TabsTrigger>
          </TabsList>

          {/* ABA: DEMANDAS DE REPOSIÇÃO */}
          <TabsContent value="pendentes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Produtos Abaixo do Estoque Ideal
                </CardTitle>
                <CardDescription>
                  Produtos onde o estoque informado pela loja está abaixo do mínimo configurado para hoje ({getDiaSemana()})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filtro de Loja */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Filtrar por Loja</label>
                    <Select value={lojaSelecionada} onValueChange={setLojaSelecionada}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as lojas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as Lojas</SelectItem>
                        {lojas.map(loja => (
                          <SelectItem key={loja.id} value={loja.id}>
                            {loja.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Badge variant="secondary" className="text-sm">
                      {demandas.length} item(s) abaixo do ideal
                    </Badge>
                  </div>
                </div>

                {/* Lista de Demandas */}
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-40 w-full" />
                    ))}
                  </div>
                ) : demandas.length === 0 ? (
                  <div className="space-y-4">
                    {/* Aviso: Loja selecionada não tem mínimo configurado */}
                    {diagnosticoLojas.lojaSelecionadaSemMinimo && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Estoque Mínimo Não Configurado</AlertTitle>
                        <AlertDescription>
                          A loja selecionada não possui estoque mínimo configurado. Configure em:{' '}
                          <strong>Configurações → Gerenciar Produtos → Estoque Mínimo por Loja</strong>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Aviso: Loja selecionada não informou estoque */}
                    {diagnosticoLojas.lojaSelecionadaNaoInformou && !diagnosticoLojas.lojaSelecionadaSemMinimo && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Estoque Não Informado</AlertTitle>
                        <AlertDescription>
                          A loja selecionada ainda não informou o estoque atual. A loja deve informar em:{' '}
                          <strong>Estoque Loja → Meu Estoque</strong>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Aviso global: Nenhuma loja tem mínimo configurado */}
                    {lojaSelecionada === 'todas' && !diagnosticoLojas.temAlgumaConfiguracao && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Configuração Necessária</AlertTitle>
                        <AlertDescription>
                          Nenhuma loja possui estoque mínimo configurado. Configure em:{' '}
                          <strong>Configurações → Gerenciar Produtos → Estoque Mínimo por Loja</strong>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Aviso: Algumas lojas sem configuração */}
                    {lojaSelecionada === 'todas' && diagnosticoLojas.temAlgumaConfiguracao && diagnosticoLojas.lojasSemMinimo.length > 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Lojas sem Estoque Mínimo Configurado</AlertTitle>
                        <AlertDescription>
                          As seguintes lojas não possuem estoque mínimo configurado e não aparecem nas demandas:{' '}
                          <strong>{diagnosticoLojas.lojasSemMinimo.map(l => l.nome).join(', ')}</strong>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Aviso: Lojas que não informaram */}
                    {lojaSelecionada === 'todas' && diagnosticoLojas.lojasQueNaoInformaram.length > 0 && (
                      <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertTitle>Aguardando Informação de Estoque</AlertTitle>
                        <AlertDescription>
                          As seguintes lojas ainda não informaram o estoque atual:{' '}
                          <strong>{diagnosticoLojas.lojasQueNaoInformaram.map(l => l.nome).join(', ')}</strong>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Estado final: Tudo OK */}
                    {(
                      (lojaSelecionada !== 'todas' && !diagnosticoLojas.lojaSelecionadaSemMinimo && !diagnosticoLojas.lojaSelecionadaNaoInformou) ||
                      (lojaSelecionada === 'todas' && diagnosticoLojas.temAlgumaConfiguracao && diagnosticoLojas.lojasSemMinimo.length === 0 && diagnosticoLojas.lojasQueNaoInformaram.length === 0)
                    ) && (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
                        <p className="text-lg font-medium">Todos os produtos estão com estoque adequado!</p>
                        <p className="text-sm text-center">
                          Nenhum produto está abaixo do estoque mínimo configurado.
                        </p>
                      </div>
                    )}
                    
                    {/* Estado vazio genérico quando não há alertas específicos */}
                    {lojaSelecionada === 'todas' && !diagnosticoLojas.temAlgumaConfiguracao === false && diagnosticoLojas.lojasSemMinimo.length === 0 && diagnosticoLojas.lojasQueNaoInformaram.length === 0 && demandas.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
                        <p className="text-lg font-medium">Nenhuma demanda de reposição!</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Array.from(demandasPorLoja.entries()).map(([lojaId, itens]) => {
                      const loja = lojas.find(l => l.id === lojaId);
                      return (
                        <Card key={lojaId} className="border-l-4 border-l-primary">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Store className="h-5 w-5 text-primary" />
                              {loja?.nome || itens[0]?.loja.nome}
                              <Badge variant="outline" className="ml-2">
                                {itens.length} item(s)
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="border-b text-sm">
                                    <th className="text-left p-2 font-medium">Produto</th>
                                    <th className="text-center p-2 font-medium">Est. Loja</th>
                                    <th className="text-center p-2 font-medium">Ideal</th>
                                    <th className="text-center p-2 font-medium">Déficit</th>
                                    <th className="text-center p-2 font-medium">Est. CPD</th>
                                    <th className="text-center p-2 font-medium">Qtd Envio</th>
                                    <th className="text-center p-2 font-medium">Informado</th>
                                    <th className="text-center p-2 font-medium">Ação</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itens.map(item => {
                                    const key = `${item.loja.id}-${item.produto.id}`;
                                    const qtdEnvio = quantidadesEnvio[key] ?? item.deficit;
                                    const semEstoque = qtdEnvio > item.estoque_cpd;
                                    
                                    return (
                                      <tr key={key} className="border-b hover:bg-muted/50">
                                        <td className="p-2">
                                          <div className="font-medium">{item.produto.nome}</div>
                                          {item.produto.codigo && (
                                            <div className="text-xs text-muted-foreground">{item.produto.codigo}</div>
                                          )}
                                        </td>
                                        <td className="p-2 text-center">
                                          <span className="text-destructive font-medium">{item.estoque_atual}</span>
                                        </td>
                                        <td className="p-2 text-center">
                                          <span className="text-green-600 font-medium">{item.estoque_ideal}</span>
                                        </td>
                                        <td className="p-2 text-center">
                                          <Badge variant="destructive">{item.deficit}</Badge>
                                        </td>
                                        <td className="p-2 text-center">
                                          <span className={semEstoque ? 'text-destructive font-medium' : ''}>
                                            {item.estoque_cpd}
                                          </span>
                                        </td>
                                        <td className="p-2">
                                          <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={qtdEnvio}
                                            onChange={(e) => handleQuantidadeChange(item.loja.id, item.produto.id, e.target.value)}
                                            className="w-20 mx-auto text-center"
                                          />
                                        </td>
                                        <td className="p-2 text-center">
                                          <div className="text-xs text-muted-foreground">
                                            {item.usuario_informou || '-'}
                                            <br />
                                            {item.data_ultima_contagem 
                                              ? format(new Date(item.data_ultima_contagem), "dd/MM HH:mm", { locale: ptBR })
                                              : '-'}
                                          </div>
                                        </td>
                                        <td className="p-2 text-center">
                                          <Button
                                            size="sm"
                                            variant="default"
                                            disabled={sending || qtdEnvio === 0 || semEstoque}
                                            onClick={() => handleEnviarItem(item, qtdEnvio)}
                                            className="gap-1"
                                          >
                                            {sending ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <Truck className="h-3 w-3" />
                                            )}
                                            Enviar
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: AGUARDANDO CONFIRMAÇÃO */}
          <TabsContent value="aguardando">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Romaneios Aguardando Confirmação
                </CardTitle>
                <CardDescription>
                  Envios realizados aguardando confirmação de recebimento pela loja
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : romaneiosAguardando.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
                    <p className="text-lg font-medium">Nenhum romaneio aguardando!</p>
                    <p className="text-sm">Todos os envios foram confirmados.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {romaneiosAguardando.map(romaneio => (
                      <Card key={romaneio.id} className="border-l-4 border-l-yellow-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{romaneio.loja_nome}</h4>
                              <p className="text-sm text-muted-foreground">
                                Enviado em {format(new Date(romaneio.data_envio), "dd/MM/yyyy HH:mm", { locale: ptBR })} por {romaneio.usuario_nome}
                              </p>
                            </div>
                            <Badge variant="secondary">Aguardando</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {romaneio.itens.map((item, idx) => (
                              <Badge key={idx} variant="outline">
                                {item.produto_nome}: {item.quantidade} {item.unidade}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: HISTÓRICO */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Reposições
                </CardTitle>
                <CardDescription>
                  Últimas reposições finalizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : romaneiosHistorico.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">Nenhum histórico</p>
                    <p className="text-sm">Ainda não há reposições finalizadas.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {romaneiosHistorico.map(romaneio => (
                      <Card key={romaneio.id} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{romaneio.loja_nome}</h4>
                              <p className="text-sm text-muted-foreground">
                                Recebido em {romaneio.data_recebimento ? format(new Date(romaneio.data_recebimento), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'} por {romaneio.recebido_por_nome || '-'}
                              </p>
                            </div>
                            <Badge className="bg-green-500">Finalizado</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {romaneio.itens.map((item, idx) => (
                              <Badge 
                                key={idx} 
                                variant={item.divergencia ? "destructive" : "outline"}
                              >
                                {item.produto_nome}: {item.quantidade_recebida ?? item.quantidade}/{item.quantidade} {item.unidade}
                                {item.divergencia && " ⚠️"}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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

export default ReposicaoLoja;
