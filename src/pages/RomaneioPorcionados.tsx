import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, ClipboardList, RefreshCw, Search, Plus, Trash2, Send, CheckCircle, Clock, History, Filter, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepIndicator } from '@/components/romaneio/StepIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { numberToWords } from '@/lib/numberToWords';

interface Loja {
  id: string;
  nome: string;
  responsavel: string;
}

interface ItemDisponivel {
  item_id: string;
  item_nome: string;
  quantidade_disponivel: number;
  data_producao: string;
  producao_registro_ids: string[];
}

interface ItemSelecionado {
  item_id: string;
  item_nome: string;
  quantidade: number;
  peso_total_kg: number;
  producao_registro_ids: string[];
}

interface Romaneio {
  id: string;
  loja_id: string;
  loja_nome: string;
  data_criacao: string;
  data_envio: string | null;
  data_recebimento: string | null;
  status: string;
  usuario_nome: string;
  recebido_por_nome: string | null;
  observacao: string | null;
  romaneio_itens: Array<{
    id?: string;
    item_nome: string;
    quantidade: number;
    peso_total_kg: number;
  }>;
}

const RomaneioPorcionados = () => {
  const { user, profile } = useAuth();
  const { organizationId } = useOrganization();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedLoja, setSelectedLoja] = useState<string>('');
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemDisponivel[]>([]);
  const [itensSelecionados, setItensSelecionados] = useState<ItemSelecionado[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [romaneiosEnviados, setRomaneiosEnviados] = useState<Romaneio[]>([]);
  const [romaneiosHistorico, setRomaneiosHistorico] = useState<Romaneio[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [userLojasIds, setUserLojasIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastCreatedRomaneioId, setLastCreatedRomaneioId] = useState<string | null>(null);
  const [romaneiosPendentes, setRomaneiosPendentes] = useState<Romaneio[]>([]);
  
  // Estados para controlar quantidades recebidas
  const [recebimentos, setRecebimentos] = useState<{
    [itemId: string]: {
      quantidade_recebida: number;
      peso_recebido_kg: number;
    }
  }>({});
  const [observacaoRecebimento, setObservacaoRecebimento] = useState<{
    [romaneioId: string]: string
  }>({});

  useEffect(() => {
    fetchLojas();
    checkUserRole();
    fetchUserLojas();
    fetchRomaneiosPendentes();

    // Listener realtime para estoque_cpd - atualiza quando produção finaliza itens
    const channel = supabase
      .channel('estoque-cpd-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estoque_cpd'
        },
        (payload) => {
          console.log('Estoque CPD atualizado:', payload);
          if (selectedLoja) {
            fetchItensDisponiveis();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Recarregar itens quando loja for selecionada
  useEffect(() => {
    if (selectedLoja) {
      fetchItensDisponiveis();
    }
  }, [selectedLoja]);

  useEffect(() => {
    if (userLojasIds.length > 0 || isAdmin) {
      fetchRomaneiosEnviados();
      fetchRomaneiosHistorico();
    }
  }, [userLojasIds, isAdmin, filtroStatus]);
  
  // Inicializar recebimentos quando romaneios enviados forem carregados
  useEffect(() => {
    const novosRecebimentos: typeof recebimentos = {};
    romaneiosEnviados.forEach(romaneio => {
      romaneio.romaneio_itens.forEach((item, idx) => {
        const itemId = item.id || `${romaneio.id}-${idx}`;
        if (!recebimentos[itemId]) {
          novosRecebimentos[itemId] = {
            quantidade_recebida: item.quantidade,
            peso_recebido_kg: item.peso_total_kg || 0
          };
        }
      });
    });
    if (Object.keys(novosRecebimentos).length > 0) {
      setRecebimentos(prev => ({ ...prev, ...novosRecebimentos }));
    }
  }, [romaneiosEnviados]);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    setIsAdmin(roles?.some(r => r.role === 'Admin') || false);
  };

  const fetchUserLojas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: lojas } = await supabase
      .from('lojas_acesso')
      .select('loja_id')
      .eq('user_id', user.id);

    setUserLojasIds(lojas?.map(l => l.loja_id) || []);
  };

  const fetchLojas = async () => {
    const { data, error } = await supabase
      .from('lojas')
      .select('*')
      .order('nome');
    
    if (error) {
      toast.error('Erro ao carregar lojas');
      return;
    }
    
    setLojas(data || []);
  };

  const fetchItensDisponiveis = async () => {
    if (!selectedLoja) {
      setItensDisponiveis([]);
      return;
    }

    try {
      // 1. Buscar estoque CPD (limite máximo físico)
      const { data: estoqueCpd, error: estoqueError } = await supabase
        .from('estoque_cpd')
        .select(`
          item_porcionado_id,
          quantidade,
          itens_porcionados!inner(nome, peso_unitario_g)
        `)
        .gt('quantidade', 0);

      if (estoqueError) throw estoqueError;

      // 2. Buscar produções finalizadas ORDENADAS por data (mais recente primeiro)
      const { data: producoes, error: producoesError } = await supabase
        .from('producao_registros')
        .select('item_id, item_nome, detalhes_lojas, data_fim')
        .eq('status', 'finalizado')
        .order('data_fim', { ascending: false });

      if (producoesError) throw producoesError;

      // 3. Para cada item, pegar APENAS a produção mais recente
      const ultimaProducaoPorItem = new Map<string, any>();
      producoes?.forEach(prod => {
        if (!ultimaProducaoPorItem.has(prod.item_id)) {
          ultimaProducaoPorItem.set(prod.item_id, prod);
        }
        // Ignora produções anteriores - só a primeira (mais recente) é usada
      });

      // 4. Extrair quantidade da loja selecionada da última produção
      const quantidadesPorItem = new Map<string, number>();
      ultimaProducaoPorItem.forEach((prod, item_id) => {
        const detalhes = prod.detalhes_lojas as any[];
        const detalheLoja = detalhes?.find((d: any) => d.loja_id === selectedLoja);
        if (detalheLoja && detalheLoja.quantidade > 0) {
          quantidadesPorItem.set(item_id, detalheLoja.quantidade);
        }
      });

      // 5. Descontar apenas romaneios PENDENTES (não enviados)
      const { data: romaneiosPendentes, error: romaneiosError } = await supabase
        .from('romaneio_itens')
        .select(`
          item_porcionado_id,
          quantidade,
          romaneios!inner(loja_id, status)
        `)
        .eq('romaneios.loja_id', selectedLoja)
        .eq('romaneios.status', 'pendente');

      if (romaneiosError) throw romaneiosError;

      romaneiosPendentes?.forEach(ri => {
        const atual = quantidadesPorItem.get(ri.item_porcionado_id) || 0;
        quantidadesPorItem.set(ri.item_porcionado_id, Math.max(0, atual - ri.quantidade));
      });

      // 6. Criar lista final, limitada pelo estoque_cpd
      const itensFinais: ItemDisponivel[] = [];
      estoqueCpd?.forEach(est => {
        const quantidadeDaLoja = quantidadesPorItem.get(est.item_porcionado_id) || 0;
        const disponivel = Math.min(quantidadeDaLoja, est.quantidade || 0);
        
        if (disponivel > 0) {
          itensFinais.push({
            item_id: est.item_porcionado_id,
            item_nome: est.itens_porcionados.nome,
            quantidade_disponivel: disponivel, // 101 para ALEIXO, 101 para CACHOEIRINHA
            data_producao: new Date().toISOString(),
            producao_registro_ids: []
          });
        }
      });

      setItensDisponiveis(itensFinais);
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
      toast.error('Erro ao carregar itens disponíveis');
    }
  };

  const fetchRomaneiosEnviados = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('romaneios')
        .select(`
          *,
          romaneio_itens (
            id,
            item_nome,
            quantidade,
            peso_total_kg
          )
        `)
        .eq('status', 'enviado')
        .order('data_envio', { ascending: false });

      if (!isAdmin && userLojasIds.length > 0) {
        query = query.in('loja_id', userLojasIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRomaneiosEnviados(data || []);
    } catch (error) {
      console.error('Erro ao buscar romaneios enviados:', error);
    }
  };

  const fetchRomaneiosHistorico = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('romaneios')
        .select(`
          *,
          romaneio_itens (
            item_nome,
            quantidade,
            peso_total_kg
          )
        `)
        .order('data_criacao', { ascending: false });

      if (!isAdmin && userLojasIds.length > 0) {
        query = query.in('loja_id', userLojasIds);
      }

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRomaneiosHistorico(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  const fetchRomaneiosPendentes = async () => {
    try {
      const { data, error } = await supabase
        .from('romaneios')
        .select(`
          *,
          romaneio_itens (
            item_nome,
            quantidade,
            peso_total_kg
          )
        `)
        .eq('status', 'pendente')
        .order('data_criacao', { ascending: false });

      if (error) throw error;

      setRomaneiosPendentes(data || []);
    } catch (error) {
      console.error('Erro ao buscar romaneios pendentes:', error);
    }
  };

  const handleConfirmarRecebimento = async (romaneioId: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      // Buscar romaneio e seus itens
      const romaneio = romaneiosEnviados.find(r => r.id === romaneioId);
      if (!romaneio) throw new Error('Romaneio não encontrado');

      // Buscar IDs dos itens
      const { data: itensData, error: itensError } = await supabase
        .from('romaneio_itens')
        .select('id, item_nome')
        .eq('romaneio_id', romaneioId);

      if (itensError) throw itensError;

      // Validar que todos os itens têm quantidade recebida preenchida
      const itensParaAtualizar = itensData?.map(item => {
        const recebimento = recebimentos[item.id];
        if (!recebimento || recebimento.quantidade_recebida === undefined || recebimento.quantidade_recebida === null) {
          throw new Error(`Informe a quantidade recebida de ${item.item_nome}`);
        }
        return {
          id: item.id,
          quantidade_recebida: recebimento.quantidade_recebida,
          peso_recebido_kg: recebimento.peso_recebido_kg || null
        };
      });

      // Atualizar cada item com quantidade recebida
      for (const item of itensParaAtualizar || []) {
        const { error: updateError } = await supabase
          .from('romaneio_itens')
          .update({
            quantidade_recebida: item.quantidade_recebida,
            peso_recebido_kg: item.peso_recebido_kg
          })
          .eq('id', item.id);

        if (updateError) throw updateError;
      }

      // Atualizar status do romaneio
      const { error } = await supabase
        .from('romaneios')
        .update({
          status: 'recebido',
          data_recebimento: new Date().toISOString(),
          recebido_por_id: user.id,
          recebido_por_nome: userProfile?.nome || 'Usuário',
          observacao: observacaoRecebimento[romaneioId] || null
        })
        .eq('id', romaneioId);

      if (error) throw error;

      toast.success('Recebimento confirmado com sucesso!');

      // Limpar estados de recebimento
      const updatedRecebimentos = { ...recebimentos };
      itensData?.forEach(item => delete updatedRecebimentos[item.id]);
      setRecebimentos(updatedRecebimentos);
      
      const updatedObservacoes = { ...observacaoRecebimento };
      delete updatedObservacoes[romaneioId];
      setObservacaoRecebimento(updatedObservacoes);

      fetchRomaneiosEnviados();
      fetchRomaneiosHistorico();
    } catch (error: any) {
      console.error('Erro ao confirmar recebimento:', error);
      toast.error(error.message || 'Erro ao confirmar recebimento');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarRomaneio = async (romaneioId: string) => {
    try {
      setLoading(true);

      // Buscar itens do romaneio
      const { data: romaneioItens, error: itensError } = await supabase
        .from('romaneio_itens')
        .select('item_porcionado_id, quantidade, item_nome')
        .eq('romaneio_id', romaneioId);

      if (itensError) throw itensError;

      // VALIDAR ESTOQUE ANTES DE ENVIAR
      for (const item of romaneioItens || []) {
        const { data: estoque } = await supabase
          .from('estoque_cpd')
          .select('quantidade')
          .eq('item_porcionado_id', item.item_porcionado_id)
          .single();
        
        const estoqueAtual = estoque?.quantidade || 0;
        
        if (estoqueAtual < item.quantidade) {
          toast.error(`Estoque insuficiente para ${item.item_nome}. Disponível: ${estoqueAtual} un, Solicitado: ${item.quantidade} un`);
          return; // Impede o envio
        }
      }

      // Decrementar estoque CPD para cada item do romaneio
      for (const item of romaneioItens || []) {
        const { error: estoqueError } = await supabase.rpc('decrementar_estoque_cpd', {
          p_item_id: item.item_porcionado_id,
          p_quantidade: item.quantidade
        });

        if (estoqueError) {
          console.error('Erro ao decrementar estoque:', estoqueError);
          throw new Error('Erro ao atualizar estoque');
        }
      }

      // Atualizar status do romaneio
      const { error } = await supabase
        .from('romaneios')
        .update({
          status: 'enviado',
          data_envio: new Date().toISOString(),
        })
        .eq('id', romaneioId);

      if (error) throw error;

      toast.success('Romaneio enviado com sucesso!');

      setLastCreatedRomaneioId(null);
      setSelectedLoja('');
      
      // Recarregar dados
      await fetchRomaneiosEnviados();
      await fetchRomaneiosPendentes();
      await fetchRomaneiosHistorico();
      await fetchItensDisponiveis();
    } catch (error) {
      console.error('Erro ao enviar romaneio:', error);
      toast.error('Erro ao enviar romaneio');
    } finally {
      setLoading(false);
    }
  };

  const addItem = (item: ItemDisponivel) => {
    const jaAdicionado = itensSelecionados.find(i => i.item_id === item.item_id);
    if (jaAdicionado) {
      toast.error('Item já adicionado ao romaneio');
      return;
    }

    if (item.quantidade_disponivel <= 0) {
      toast.error('Este item não possui estoque disponível');
      return;
    }

    setItensSelecionados([
      ...itensSelecionados,
      {
        item_id: item.item_id,
        item_nome: item.item_nome,
        quantidade: item.quantidade_disponivel,
        peso_total_kg: 0,
        producao_registro_ids: item.producao_registro_ids
      }
    ]);
    toast.success(`${item.item_nome} adicionado`);
  };

  const removeItem = (item_id: string) => {
    setItensSelecionados(itensSelecionados.filter(i => i.item_id !== item_id));
  };

  const updateQuantidade = (item_id: string, quantidade: number) => {
    const itemDisponivel = itensDisponiveis.find(i => i.item_id === item_id);
    const maxQuantidade = itemDisponivel?.quantidade_disponivel || 0;

    if (quantidade > maxQuantidade) {
      toast.error(`Quantidade máxima disponível: ${maxQuantidade} un`);
      return;
    }

    if (quantidade < 1) {
      toast.error('Quantidade mínima: 1 unidade');
      return;
    }

    setItensSelecionados(
      itensSelecionados.map(i =>
        i.item_id === item_id ? { ...i, quantidade } : i
      )
    );
  };

  const updatePesoTotal = (item_id: string, peso_total_kg: number) => {
    if (peso_total_kg < 0) {
      toast.error('Peso não pode ser negativo');
      return;
    }

    setItensSelecionados(
      itensSelecionados.map(i =>
        i.item_id === item_id ? { ...i, peso_total_kg } : i
      )
    );
  };

  const handleProximoPasso = () => {
    if (currentStep === 1 && !selectedLoja) {
      toast.error('Selecione uma loja de destino');
      return;
    }
    if (currentStep === 2 && itensSelecionados.length === 0) {
      toast.error('Adicione pelo menos um item ao romaneio');
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  const getNomeLojaSelecionada = () => {
    return lojas.find(l => l.id === selectedLoja)?.nome || '';
  };

  const handleVoltarPasso = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFinalizarRomaneio = async () => {
    if (!user || !profile) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (!organizationId) {
      toast.error('Organização não identificada. Faça login novamente.');
      return;
    }

    setLoading(true);

    try {
      const lojaSelecionada = lojas.find(l => l.id === selectedLoja);
      
      // Criar romaneio
      const { data: romaneio, error: romaneioError } = await supabase
        .from('romaneios')
        .insert({
          loja_id: selectedLoja,
          loja_nome: lojaSelecionada?.nome || '',
          usuario_id: user.id,
          usuario_nome: profile.nome,
          observacao: observacao || null,
          status: 'pendente',
          organization_id: organizationId,
        })
        .select()
        .single();

      if (romaneioError) throw romaneioError;

      // Criar itens do romaneio
      const itensParaInserir = itensSelecionados.map(item => ({
        romaneio_id: romaneio.id,
        item_porcionado_id: item.item_id,
        item_nome: item.item_nome,
        quantidade: item.quantidade,
        producao_registro_id: item.producao_registro_ids[0],
        organization_id: organizationId,
      }));

      const { error: itensError } = await supabase
        .from('romaneio_itens')
        .insert(itensParaInserir);

      if (itensError) throw itensError;

      toast.success('Romaneio criado com sucesso!');
      
      setLastCreatedRomaneioId(romaneio.id);
      setCurrentStep(1);
      setItensSelecionados([]);
      setObservacao('');
      fetchItensDisponiveis();
      fetchRomaneiosPendentes();
      fetchRomaneiosHistorico();
      
    } catch (error) {
      console.error('Erro ao criar romaneio:', error);
      toast.error('Erro ao criar romaneio');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirRomaneio = async (romaneioId: string) => {
    const confirmDelete = window.confirm(
      'Tem certeza que deseja excluir este romaneio? Esta ação não pode ser desfeita.'
    );
    
    if (!confirmDelete) return;
    
    try {
      setLoading(true);
      
      // 1. Excluir itens do romaneio primeiro
      const { error: itensError } = await supabase
        .from('romaneio_itens')
        .delete()
        .eq('romaneio_id', romaneioId);
      
      if (itensError) throw itensError;
      
      // 2. Excluir o romaneio
      const { error: romaneioError } = await supabase
        .from('romaneios')
        .delete()
        .eq('id', romaneioId)
        .eq('status', 'pendente');
      
      if (romaneioError) throw romaneioError;
      
      toast.success('Romaneio excluído com sucesso!');
      
      // 3. Recarregar dados
      await fetchRomaneiosPendentes();
      await fetchItensDisponiveis();
      
    } catch (error) {
      console.error('Erro ao excluir romaneio:', error);
      toast.error('Erro ao excluir romaneio');
    } finally {
      setLoading(false);
    }
  };

  const itensFiltrados = itensDisponiveis.filter(item =>
    item.item_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Romaneio</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie romaneios de envio, recebimento e reposição de estoque das lojas
          </p>
        </div>

        <Tabs defaultValue="romaneio" className="w-full" onValueChange={(value) => {
          if (value === 'romaneio') {
            fetchItensDisponiveis();
          }
        }}>
          <TabsList>
            <TabsTrigger value="romaneio" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Criar Romaneio
            </TabsTrigger>
            <TabsTrigger value="receber" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Receber Porcionados
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="romaneio" className="space-y-6">
            {/* Romaneios Pendentes de Envio */}
            {romaneiosPendentes.length > 0 && (
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                    <Clock className="h-5 w-5" />
                    Romaneios Pendentes de Envio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {romaneiosPendentes.map((romaneio) => (
                    <div key={romaneio.id} className="p-4 border rounded-lg bg-background space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <p className="font-semibold">{romaneio.loja_nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {romaneio.romaneio_itens.length} {romaneio.romaneio_itens.length === 1 ? 'item' : 'itens'} • Criado em {format(new Date(romaneio.data_criacao), 'dd/MM/yyyy HH:mm')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleExcluirRomaneio(romaneio.id)}
                            disabled={loading}
                            title="Excluir romaneio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleEnviarRomaneio(romaneio.id)}
                            disabled={loading}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Enviar
                          </Button>
                        </div>
                      </div>
                      
                      {/* Resumo dos itens */}
                      <div className="pl-4 border-l-2 border-muted space-y-1">
                        {romaneio.romaneio_itens.map((item, idx) => (
                          <div key={idx} className="text-sm text-muted-foreground">
                            • <span className="font-medium text-foreground">{item.item_nome}</span>: {item.quantidade} un
                            {item.peso_total_kg && <span className="text-xs"> ({item.peso_total_kg.toFixed(1)} kg)</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Stepper */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-0">
                  <StepIndicator step={1} current={currentStep} label="Selecionar loja" />
                  <StepIndicator step={2} current={currentStep} label="Escolher Itens" />
                  <StepIndicator step={3} current={currentStep} label="Conferir e Enviar" />
                </div>
              </CardContent>
            </Card>

            {/* Passo 1: Selecionar Loja */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Selecionar Loja de Destino</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Loja de Destino</Label>
                    <Select value={selectedLoja} onValueChange={setSelectedLoja}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma loja" />
                      </SelectTrigger>
                      <SelectContent>
                        {lojas.map(loja => (
                          <SelectItem key={loja.id} value={loja.id}>
                            {loja.nome} - {loja.responsavel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">Data:</span>
                    <span>{format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleProximoPasso} disabled={!selectedLoja}>
                      Próximo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Passo 2: Escolher Itens */}
            {currentStep === 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Header com loja selecionada */}
                <div className="lg:col-span-3 mb-2">
                  <div className="bg-primary/10 p-3 rounded-lg flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    <span className="font-semibold">
                      Enviando para: {getNomeLojaSelecionada()}
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Itens Disponíveis para Envio</CardTitle>
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar itens..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {itensFiltrados.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhum item disponível para envio
                        </p>
                      ) : (
                        itensFiltrados.map(item => (
                          <Card key={item.item_id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="font-semibold">{item.item_nome}</p>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className={item.quantidade_disponivel > 0 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400'}>
                                    Disponível: {item.quantidade_disponivel} un
                                  </span>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-muted-foreground">Produzido: {format(new Date(item.data_producao), 'dd/MM/yyyy')}</span>
                                </div>
                              </div>
                              <Button
                                onClick={() => addItem(item)}
                                size="sm"
                                disabled={itensSelecionados.some(i => i.item_id === item.item_id) || item.quantidade_disponivel <= 0}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Adicionar
                              </Button>
                            </div>
                          </Card>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        ITENS SELECIONADOS PARA ENVIO
                      </CardTitle>
                      <Badge variant="secondary" className="w-fit">
                        {itensSelecionados.length} {itensSelecionados.length === 1 ? 'item' : 'itens'}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {itensSelecionados.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhum item selecionado
                        </p>
                      ) : (
                        itensSelecionados.map(item => {
                          const itemDisponivel = itensDisponiveis.find(i => i.item_id === item.item_id);
                          const maxQuantidade = itemDisponivel?.quantidade_disponivel || 0;
                          
                          return (
                            <div key={item.item_id} className="space-y-3 p-3 border rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{item.item_nome}</p>
                                  <p className="text-xs text-muted-foreground">Máx: {maxQuantidade} un</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(item.item_id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`quantidade-${item.item_id}`} className="text-xs">
                                    Quantidade (un)
                                  </Label>
                                  <Input
                                    id={`quantidade-${item.item_id}`}
                                    type="number"
                                    min={1}
                                    max={maxQuantidade}
                                    value={item.quantidade}
                                    onChange={(e) => updateQuantidade(item.item_id, parseInt(e.target.value) || 0)}
                                    className="h-9"
                                  />
                                  <p className="text-xs text-muted-foreground italic">
                                    {numberToWords(item.quantidade, 'unidade')}
                                  </p>
                                </div>

                                <div className="space-y-1">
                                  <Label htmlFor={`peso-${item.item_id}`} className="text-xs">
                                    Peso Total (kg)
                                  </Label>
                                  <Input
                                    id={`peso-${item.item_id}`}
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={item.peso_total_kg}
                                    onChange={(e) => updatePesoTotal(item.item_id, parseFloat(e.target.value) || 0)}
                                    className="h-9"
                                  />
                                  <p className="text-xs text-muted-foreground italic">
                                    {numberToWords(item.peso_total_kg, 'kg')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleVoltarPasso} className="flex-1">
                      Voltar
                    </Button>
                    <Button onClick={handleProximoPasso} className="flex-1" disabled={itensSelecionados.length === 0}>
                      Próximo
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Passo 3: Conferir e Enviar */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <div className="space-y-3">
                    <CardTitle>Conferir e Finalizar Romaneio</CardTitle>
                    <div className="bg-primary/10 p-3 rounded-lg flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      <span className="font-semibold">
                        Enviando para: {getNomeLojaSelecionada()}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Loja de Destino</p>
                      <p className="font-semibold">{lojas.find(l => l.id === selectedLoja)?.nome}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data</p>
                      <p className="font-semibold">{format(new Date(), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Itens do Romaneio ({itensSelecionados.length})</Label>
                    <div className="border rounded-lg divide-y">
                      {itensSelecionados.map(item => (
                        <div key={item.item_id} className="p-3 flex justify-between items-center">
                          <span className="font-medium">{item.item_nome}</span>
                          <div className="text-right">
                            <div className="text-muted-foreground">{item.quantidade} un</div>
                            <div className="text-xs text-muted-foreground">{item.peso_total_kg.toFixed(1)} kg</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      placeholder="Adicione observações sobre este romaneio..."
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleVoltarPasso} className="flex-1">
                      Voltar
                    </Button>
                    <Button onClick={handleFinalizarRomaneio} className="flex-1" disabled={loading}>
                      {loading ? 'Finalizando...' : 'Finalizar Romaneio'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="receber">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Romaneios Pendentes de Recebimento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {romaneiosEnviados.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum romaneio pendente de recebimento
                  </p>
                ) : (
                  romaneiosEnviados.map((romaneio) => (
                    <Card key={romaneio.id} className="border-2">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">
                              Romaneio #{romaneio.id.slice(0, 8)}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Enviado em: {format(new Date(romaneio.data_envio!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-sm font-medium">
                              De: CPD | Para: {romaneio.loja_nome}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-yellow-500/10">
                            <Clock className="h-3 w-3 mr-1" />
                            Aguardando
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-3">Itens Enviados:</h4>
                          <div className="space-y-4">
                            {romaneio.romaneio_itens.map((item, idx) => {
                              const itemId = item.id || `${romaneio.id}-${idx}`;
                              const recebimento = recebimentos[itemId] || { quantidade_recebida: item.quantidade, peso_recebido_kg: item.peso_total_kg };
                              const hasDivergenciaQtd = recebimento.quantidade_recebida !== item.quantidade;
                              const hasDivergenciaPeso = item.peso_total_kg ? Math.abs(recebimento.peso_recebido_kg - item.peso_total_kg) > 0.1 : false;
                              const hasDivergencia = hasDivergenciaQtd || hasDivergenciaPeso;
                              
                              return (
                                <div key={itemId} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{item.item_nome}</span>
                                    {hasDivergencia ? (
                                      <Badge variant="destructive" className="text-xs">⚠️ Divergência</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs bg-green-500/10">✓ OK</Badge>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Qtd Enviada</Label>
                                      <div className="p-2 bg-background rounded border">
                                        <p className="font-semibold">{item.quantidade} un</p>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Qtd Recebida *</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={recebimento.quantidade_recebida}
                                        onChange={(e) => {
                                          const valor = parseInt(e.target.value) || 0;
                                          setRecebimentos(prev => ({
                                            ...prev,
                                            [itemId]: {
                                              ...prev[itemId],
                                              quantidade_recebida: valor,
                                              peso_recebido_kg: prev[itemId]?.peso_recebido_kg || item.peso_total_kg
                                            }
                                          }));
                                        }}
                                        className={hasDivergenciaQtd ? 'border-yellow-500' : ''}
                                      />
                                      <p className="text-xs text-muted-foreground italic">
                                        {numberToWords(recebimento.quantidade_recebida, 'unidade')}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {item.peso_total_kg > 0 && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Peso Enviado</Label>
                                        <div className="p-2 bg-background rounded border">
                                          <p className="font-semibold">{item.peso_total_kg.toFixed(1)} kg</p>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Peso Recebido *</Label>
                                        <Input
                                          type="number"
                                          step="0.1"
                                          min={0}
                                          value={recebimento.peso_recebido_kg}
                                          onChange={(e) => {
                                            const valor = parseFloat(e.target.value) || 0;
                                            setRecebimentos(prev => ({
                                              ...prev,
                                              [itemId]: {
                                                ...prev[itemId],
                                                quantidade_recebida: prev[itemId]?.quantidade_recebida || item.quantidade,
                                                peso_recebido_kg: valor
                                              }
                                            }));
                                          }}
                                          className={hasDivergenciaPeso ? 'border-yellow-500' : ''}
                                        />
                                        <p className="text-xs text-muted-foreground italic">
                                          {numberToWords(recebimento.peso_recebido_kg, 'kg')}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {romaneio.observacao && (
                          <div className="pt-2 border-t">
                            <p className="text-sm text-muted-foreground">
                              <strong>Observação CPD:</strong> {romaneio.observacao}
                            </p>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <Label htmlFor={`obs-${romaneio.id}`}>Observação de Divergência (opcional)</Label>
                          <Textarea
                            id={`obs-${romaneio.id}`}
                            placeholder="Ex: 2 unidades danificadas no transporte..."
                            value={observacaoRecebimento[romaneio.id] || ''}
                            onChange={(e) => setObservacaoRecebimento(prev => ({
                              ...prev,
                              [romaneio.id]: e.target.value
                            }))}
                            rows={2}
                          />
                        </div>
                        
                        <Button
                          onClick={() => handleConfirmarRecebimento(romaneio.id)}
                          disabled={loading}
                          className="w-full"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirmar Recebimento
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Histórico de Romaneios
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pendente">Pendentes</SelectItem>
                        <SelectItem value="enviado">Enviados</SelectItem>
                        <SelectItem value="recebido">Recebidos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {romaneiosHistorico.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum romaneio encontrado
                  </p>
                ) : (
                  romaneiosHistorico.map((romaneio) => (
                    <Card key={romaneio.id} className="border-2">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">
                                {format(new Date(romaneio.data_criacao), "dd/MM/yyyy", { locale: ptBR })}
                              </CardTitle>
                              <span className="text-sm text-muted-foreground">
                                | {romaneio.loja_nome}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {romaneio.romaneio_itens.length} {romaneio.romaneio_itens.length === 1 ? 'item' : 'itens'}
                            </p>
                          </div>
                          <Badge
                            variant={
                              romaneio.status === 'recebido'
                                ? 'default'
                                : romaneio.status === 'enviado'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {romaneio.status === 'recebido' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {romaneio.status === 'enviado' && <Send className="h-3 w-3 mr-1" />}
                            {romaneio.status === 'pendente' && <Clock className="h-3 w-3 mr-1" />}
                            {romaneio.status === 'recebido'
                              ? 'Recebido'
                              : romaneio.status === 'enviado'
                              ? 'Enviado'
                              : 'Pendente'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Criado por:</span>
                            <span className="font-medium">{romaneio.usuario_nome}</span>
                          </div>
                          {romaneio.data_envio && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Enviado em:</span>
                              <span className="font-medium">
                                {format(new Date(romaneio.data_envio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          )}
                          {romaneio.data_recebimento && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Recebido em:</span>
                                <span className="font-medium">
                                  {format(new Date(romaneio.data_recebimento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Recebido por:</span>
                                <span className="font-medium">{romaneio.recebido_por_nome}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default RomaneioPorcionados;
