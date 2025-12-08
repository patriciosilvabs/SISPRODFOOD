import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Plus, Trash2, Send, CheckCircle, Clock, History, Package, ArrowRightLeft, Store, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUserLoja } from '@/hooks/useUserLoja';
import { useCPDLoja } from '@/hooks/useCPDLoja';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

// ==================== INTERFACES ====================

interface Loja {
  id: string;
  nome: string;
  responsavel?: string;
}

// Interfaces para Romaneio de Porcionados
interface ItemDisponivel {
  item_id: string;
  item_nome: string;
  quantidade_disponivel: number;
  quantidade_estoque_cpd: number;
  quantidade_demanda_loja: number;
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

// Interface removida - não é mais usada para romaneio avulso

interface RomaneioAvulso {
  id: string;
  loja_origem_id: string;
  loja_origem_nome: string;
  loja_destino_id: string;
  loja_destino_nome: string;
  status: string;
  data_criacao: string;
  data_envio: string | null;
  data_recebimento: string | null;
  usuario_criacao_nome: string;
  recebido_por_nome: string | null;
  observacao: string | null;
  itens: Array<{
    id?: string;
    item_nome: string;
    quantidade: number;
    peso_kg: number;
    quantidade_recebida?: number;
  }>;
}


// ==================== COMPONENTE PRINCIPAL ====================

const Romaneio = () => {
  const { user, profile, isAdmin, hasRole } = useAuth();
  const { organizationId } = useOrganization();
  const { primaryLoja, userLojas } = useUserLoja();
  const { cpdLojaId } = useCPDLoja();

  // Check user roles
  const isLojaOnly = hasRole('Loja') && !isAdmin() && !hasRole('Produção');
  const canManageProduction = isAdmin() || hasRole('Produção');

  // ==================== ESTADOS: PORCIONADOS ====================
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [selectedLoja, setSelectedLoja] = useState<string>('');
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemDisponivel[]>([]);
  const [itensSelecionados, setItensSelecionados] = useState<ItemSelecionado[]>([]);
  const [loadingPorcionados, setLoadingPorcionados] = useState(false);
  const [romaneiosEnviados, setRomaneiosEnviados] = useState<Romaneio[]>([]);
  const [romaneiosHistorico, setRomaneiosHistorico] = useState<Romaneio[]>([]);
  
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [userLojasIds, setUserLojasIds] = useState<string[]>([]);
  
  // Romaneio Avulso (livre digitação)
  const [todasLojas, setTodasLojas] = useState<Loja[]>([]); // Todas as lojas para seleção de destino
  const [lojaOrigemAvulso, setLojaOrigemAvulso] = useState<string>(''); // Seleção manual de origem (para CPD/Admin)
  const [lojaDestinoAvulso, setLojaDestinoAvulso] = useState<string>('');
  const [itensAvulsoLivre, setItensAvulsoLivre] = useState<{ id: string; descricao: string; quantidade: number }[]>([]);
  const [novoItemDescricao, setNovoItemDescricao] = useState('');
  const [novoItemQuantidade, setNovoItemQuantidade] = useState<number>(1);
  const [observacaoAvulso, setObservacaoAvulso] = useState('');
  const [romaneiosAvulsosPendentes, setRomaneiosAvulsosPendentes] = useState<RomaneioAvulso[]>([]);
  const [romaneiosAvulsosReceber, setRomaneiosAvulsosReceber] = useState<RomaneioAvulso[]>([]);
  
  const [recebimentos, setRecebimentos] = useState<{
    [itemId: string]: {
      quantidade_recebida: number;
      peso_recebido_kg: number;
    }
  }>({});
  const [observacaoRecebimento, setObservacaoRecebimento] = useState<{ [romaneioId: string]: string }>({});

  

  // ==================== EFFECTS ====================

  useEffect(() => {
    fetchLojas();
    fetchTodasLojas();
    fetchUserLojas();

    let isMounted = true;
    
    const channel = supabase
      .channel('estoque-loja-itens-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_loja_itens' }, () => {
        if (isMounted && selectedLoja) fetchItensDisponiveis();
      })
      .subscribe();

    return () => { 
      isMounted = false;
      channel.unsubscribe().then(() => supabase.removeChannel(channel));
    };
  }, []);

  useEffect(() => {
    if (selectedLoja) fetchItensDisponiveis();
  }, [selectedLoja]);

  useEffect(() => {
    if (userLojasIds.length > 0 || isAdmin()) {
      fetchRomaneiosEnviados();
      fetchRomaneiosHistorico();
      fetchRomaneiosAvulsos();
    }
  }, [userLojasIds, filtroStatus]);

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

  // ==================== FETCH FUNCTIONS ====================

  const fetchUserLojas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: lojas } = await supabase.from('lojas_acesso').select('loja_id').eq('user_id', user.id);
    setUserLojasIds(lojas?.map(l => l.loja_id) || []);
  };

  const fetchLojas = async () => {
    try {
      if (isLojaOnly) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: lojasAcesso } = await supabase
          .from('lojas_acesso')
          .select('loja_id')
          .eq('user_id', user.id);
        
        const lojasIds = lojasAcesso?.map(la => la.loja_id) || [];
        
        if (lojasIds.length > 0) {
          const { data, error } = await supabase
            .from('lojas')
            .select('*')
            .in('id', lojasIds)
            .neq('tipo', 'cpd')
            .order('nome');
          
          if (error) throw error;
          setLojas(data || []);
        }
      } else {
        // Excluir CPD da lista de lojas destino para romaneio
        const { data, error } = await supabase.from('lojas').select('*').neq('tipo', 'cpd').order('nome');
        if (error) throw error;
        setLojas(data || []);
      }
    } catch (error) {
      toast.error('Erro ao carregar lojas');
    }
  };

  // Buscar TODAS as lojas da organização para romaneio avulso (incluindo CPD)
  const fetchTodasLojas = async () => {
    try {
      // Incluir CPD para permitir transferências de/para CPD
      const { data, error } = await supabase.from('lojas').select('*, tipo').order('nome');
      if (error) throw error;
      setTodasLojas(data || []);
    } catch (error) {
      console.error('Erro ao carregar todas as lojas:', error);
    }
  };


  const fetchItensDisponiveis = async () => {
    if (!selectedLoja || !cpdLojaId) { setItensDisponiveis([]); return; }

    try {
      // CORREÇÃO: Usar estoque CPD como fonte principal de disponibilidade
      // Não depender mais de detalhes_lojas (que pode estar vazio)
      
      // 1. Buscar TODO o estoque CPD com quantidade > 0
      const { data: estoqueCpd, error: estoqueError } = await supabase
        .from('estoque_loja_itens')
        .select(`item_porcionado_id, quantidade, itens_porcionados!inner(nome, peso_unitario_g)`)
        .eq('loja_id', cpdLojaId)
        .gt('quantidade', 0);

      if (estoqueError) throw estoqueError;

      // 2. Buscar romaneios pendentes para QUALQUER loja (para deduzir do estoque)
      const { data: romaneiosPendentes, error: romaneiosError } = await supabase
        .from('romaneio_itens')
        .select(`item_porcionado_id, quantidade, romaneios!inner(loja_id, status)`)
        .in('romaneios.status', ['pendente', 'enviado']);

      if (romaneiosError) throw romaneiosError;

      // Calcular quantidades já comprometidas em romaneios pendentes
      const comprometidoPorItem: Record<string, number> = {};
      romaneiosPendentes?.forEach(ri => {
        const itemId = ri.item_porcionado_id;
        comprometidoPorItem[itemId] = (comprometidoPorItem[itemId] || 0) + ri.quantidade;
      });

      // 3. Construir lista de itens disponíveis
      const itensFinais: ItemDisponivel[] = [];
      
      estoqueCpd?.forEach(est => {
        const estoqueCpdQtd = est.quantidade || 0;
        const comprometido = comprometidoPorItem[est.item_porcionado_id] || 0;
        const disponivel = Math.max(0, estoqueCpdQtd - comprometido);
        
        if (disponivel > 0) {
          itensFinais.push({
            item_id: est.item_porcionado_id,
            item_nome: (est.itens_porcionados as any).nome,
            quantidade_disponivel: disponivel,
            quantidade_estoque_cpd: estoqueCpdQtd,
            quantidade_demanda_loja: disponivel, // Simplificado: oferecer tudo disponível
            data_producao: new Date().toISOString(),
            producao_registro_ids: []
          });
        }
      });

      // Ordenar por nome
      itensFinais.sort((a, b) => a.item_nome.localeCompare(b.item_nome));

      setItensDisponiveis(itensFinais);
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
      toast.error('Erro ao carregar itens disponíveis');
    }
  };

  // Removida função fetchItensLojaEstoque - não é mais necessária para romaneio avulso

  const fetchRomaneiosEnviados = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('romaneios')
        .select(`*, romaneio_itens (id, item_nome, quantidade, peso_total_kg)`)
        .eq('status', 'enviado')
        .order('data_envio', { ascending: false });

      if (!isAdmin() && userLojasIds.length > 0) {
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
        .select(`*, romaneio_itens (item_nome, quantidade, peso_total_kg)`)
        .order('data_criacao', { ascending: false });

      if (!isAdmin() && userLojasIds.length > 0) {
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

  const fetchRomaneiosAvulsos = async () => {
    try {
      // Se tem loja principal, buscar romaneios onde é origem
      if (primaryLoja) {
        const { data: pendentes } = await supabase
          .from('romaneios_avulsos')
          .select(`*, romaneios_avulsos_itens (id, item_nome, quantidade, peso_kg)`)
          .eq('loja_origem_id', primaryLoja.loja_id)
          .eq('status', 'pendente')
          .order('data_criacao', { ascending: false });

        setRomaneiosAvulsosPendentes((pendentes || []).map((r: any) => ({
          ...r,
          itens: r.romaneios_avulsos_itens || []
        })));

        const { data: paraReceber } = await supabase
          .from('romaneios_avulsos')
          .select(`*, romaneios_avulsos_itens (id, item_nome, quantidade, peso_kg, quantidade_recebida)`)
          .eq('loja_destino_id', primaryLoja.loja_id)
          .eq('status', 'enviado')
          .order('data_envio', { ascending: false });

        setRomaneiosAvulsosReceber((paraReceber || []).map((r: any) => ({
          ...r,
          itens: r.romaneios_avulsos_itens || []
        })));
      } else if (isAdmin()) {
        // Admin/CPD pode ver todos os romaneios avulsos pendentes
        const { data: pendentes } = await supabase
          .from('romaneios_avulsos')
          .select(`*, romaneios_avulsos_itens (id, item_nome, quantidade, peso_kg)`)
          .eq('status', 'pendente')
          .order('data_criacao', { ascending: false });

        setRomaneiosAvulsosPendentes((pendentes || []).map((r: any) => ({
          ...r,
          itens: r.romaneios_avulsos_itens || []
        })));
        
        setRomaneiosAvulsosReceber([]);
      }
    } catch (error) {
      console.error('Erro ao buscar romaneios avulsos:', error);
    }
  };



  // ==================== HANDLERS: PORCIONADOS ====================

  const handleConfirmarRecebimento = async (romaneioId: string) => {
    try {
      setLoadingPorcionados(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      const romaneio = romaneiosEnviados.find(r => r.id === romaneioId);
      if (!romaneio) throw new Error('Romaneio não encontrado');

      const { data: itensData, error: itensError } = await supabase
        .from('romaneio_itens')
        .select('id, item_nome')
        .eq('romaneio_id', romaneioId);

      if (itensError) throw itensError;

      const itensParaAtualizar = itensData?.map(item => {
        const recebimento = recebimentos[item.id];
        if (!recebimento || recebimento.quantidade_recebida === undefined) {
          throw new Error(`Informe a quantidade recebida de ${item.item_nome}`);
        }
        return { id: item.id, quantidade_recebida: recebimento.quantidade_recebida, peso_recebido_kg: recebimento.peso_recebido_kg || null };
      });

      for (const item of itensParaAtualizar || []) {
        await supabase.from('romaneio_itens').update({ quantidade_recebida: item.quantidade_recebida, peso_recebido_kg: item.peso_recebido_kg }).eq('id', item.id);
      }

      await supabase.from('romaneios').update({
        status: 'recebido',
        data_recebimento: new Date().toISOString(),
        recebido_por_id: user.id,
        recebido_por_nome: userProfile?.nome || 'Usuário',
        observacao: observacaoRecebimento[romaneioId] || null
      }).eq('id', romaneioId);

      toast.success('Recebimento confirmado!');
      fetchRomaneiosEnviados();
      fetchRomaneiosHistorico();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao confirmar');
    } finally {
      setLoadingPorcionados(false);
    }
  };

  const addItem = (item: ItemDisponivel) => {
    const existe = itensSelecionados.find(i => i.item_id === item.item_id);
    if (existe) {
      toast.error('Item já adicionado');
      return;
    }
    setItensSelecionados([...itensSelecionados, {
      item_id: item.item_id,
      item_nome: item.item_nome,
      quantidade: item.quantidade_disponivel,
      peso_total_kg: 0,
      producao_registro_ids: item.producao_registro_ids
    }]);
  };

  const removeItem = (itemId: string) => {
    setItensSelecionados(itensSelecionados.filter(i => i.item_id !== itemId));
  };

  const updateQuantidade = (itemId: string, quantidade: number) => {
    setItensSelecionados(itensSelecionados.map(i => 
      i.item_id === itemId ? { ...i, quantidade: Math.max(1, quantidade) } : i
    ));
  };

  const handleCriarRomaneio = async () => {
    if (!selectedLoja || itensSelecionados.length === 0) {
      toast.error('Selecione uma loja e adicione itens');
      return;
    }

    try {
      setLoadingPorcionados(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Validar estoque antes de criar (tabela unificada)
      for (const item of itensSelecionados) {
        const { data: estoque } = await supabase
          .from('estoque_loja_itens')
          .select('quantidade')
          .eq('loja_id', cpdLojaId)
          .eq('item_porcionado_id', item.item_id)
          .maybeSingle();
        const estoqueAtual = estoque?.quantidade || 0;
        
        if (estoqueAtual < item.quantidade) {
          toast.error(`Estoque insuficiente: ${item.item_nome}. Disponível: ${estoqueAtual}, Solicitado: ${item.quantidade}`);
          setLoadingPorcionados(false);
          return;
        }
      }

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      const loja = lojas.find(l => l.id === selectedLoja);
      const agora = new Date().toISOString();

      // Criar romaneio JÁ COMO ENVIADO (fluxo unificado)
      const { data: romaneio, error: romaneioError } = await supabase.from('romaneios').insert({
        loja_id: selectedLoja,
        loja_nome: loja?.nome || '',
        status: 'enviado',
        data_criacao: agora,
        data_envio: agora,
        usuario_id: user.id,
        usuario_nome: userProfile?.nome || 'Usuário',
        organization_id: organizationId
      }).select().single();

      if (romaneioError) throw romaneioError;

      const itens = itensSelecionados.map(item => ({
        romaneio_id: romaneio.id,
        item_porcionado_id: item.item_id,
        item_nome: item.item_nome,
        quantidade: item.quantidade,
        peso_total_kg: item.peso_total_kg,
        organization_id: organizationId
      }));

      await supabase.from('romaneio_itens').insert(itens);

      // DEBITAR ESTOQUE CPD IMEDIATAMENTE
      for (const item of itensSelecionados) {
        await supabase.rpc('decrementar_estoque_cpd', { p_item_id: item.item_id, p_quantidade: item.quantidade });
      }

      toast.success(`Romaneio enviado para ${loja?.nome}!`);
      setItensSelecionados([]);
      setSelectedLoja('');
      fetchRomaneiosEnviados();
      fetchRomaneiosHistorico();
      fetchItensDisponiveis();
    } catch (error) {
      toast.error('Erro ao criar romaneio');
    } finally {
      setLoadingPorcionados(false);
    }
  };

  const handleExcluirRomaneio = async (romaneioId: string) => {
    if (!confirm('Excluir este romaneio?')) return;
    
    try {
      await supabase.from('romaneio_itens').delete().eq('romaneio_id', romaneioId);
      await supabase.from('romaneios').delete().eq('id', romaneioId);
      toast.success('Romaneio excluído');
      fetchRomaneiosHistorico();
      fetchItensDisponiveis();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  // ==================== HANDLERS: ROMANEIO AVULSO (LIVRE DIGITAÇÃO) ====================

  const handleAdicionarItemAvulsoLivre = () => {
    if (!novoItemDescricao.trim()) {
      toast.error('Informe a descrição do item');
      return;
    }
    if (novoItemQuantidade <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }
    
    setItensAvulsoLivre([...itensAvulsoLivre, {
      id: crypto.randomUUID(),
      descricao: novoItemDescricao.trim(),
      quantidade: novoItemQuantidade
    }]);
    setNovoItemDescricao('');
    setNovoItemQuantidade(1);
  };

  const handleRemoverItemAvulsoLivre = (id: string) => {
    setItensAvulsoLivre(itensAvulsoLivre.filter(i => i.id !== id));
  };

  const handleCriarRomaneioAvulso = async () => {
    // Determinar origem: se tem primaryLoja usa ela, senão usa a selecionada manualmente
    const origemId = primaryLoja?.loja_id || lojaOrigemAvulso;
    const origemNome = primaryLoja?.loja_nome || todasLojas.find(l => l.id === lojaOrigemAvulso)?.nome;
    
    if (!origemId || !lojaDestinoAvulso || itensAvulsoLivre.length === 0) {
      toast.error('Selecione origem, destino e adicione itens');
      return;
    }

    if (lojaDestinoAvulso === origemId) {
      toast.error('A loja destino deve ser diferente da origem');
      return;
    }

    try {
      setLoadingPorcionados(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      const lojaDestino = todasLojas.find(l => l.id === lojaDestinoAvulso);
      const agora = new Date().toISOString();

      // Criar romaneio JÁ COMO ENVIADO (não precisa etapa separada)
      const { data: romaneio, error: romaneioError } = await supabase.from('romaneios_avulsos').insert({
        loja_origem_id: origemId,
        loja_origem_nome: origemNome || '',
        loja_destino_id: lojaDestinoAvulso,
        loja_destino_nome: lojaDestino?.nome || '',
        status: 'enviado',
        data_criacao: agora,
        data_envio: agora,
        usuario_criacao_id: user.id,
        usuario_criacao_nome: userProfile?.nome || 'Usuário',
        observacao: observacaoAvulso || null,
        organization_id: organizationId
      }).select().single();

      if (romaneioError) throw romaneioError;

      // Inserir itens com item_porcionado_id = null (livre digitação)
      const itens = itensAvulsoLivre.map(item => ({
        romaneio_avulso_id: romaneio.id,
        item_porcionado_id: null,  // SEM VÍNCULO com itens cadastrados
        item_nome: item.descricao,
        quantidade: item.quantidade,
        peso_kg: null,
        organization_id: organizationId
      }));

      await supabase.from('romaneios_avulsos_itens').insert(itens);

      // NÃO DEBITA ESTOQUE - é livre digitação

      toast.success(`Romaneio avulso enviado para ${lojaDestino?.nome}!`);
      setItensAvulsoLivre([]);
      setLojaDestinoAvulso('');
      setLojaOrigemAvulso('');
      setObservacaoAvulso('');
      fetchRomaneiosAvulsos();
    } catch (error) {
      console.error('Erro ao criar romaneio avulso:', error);
      toast.error('Erro ao criar romaneio avulso');
    } finally {
      setLoadingPorcionados(false);
    }
  };

  const handleReceberRomaneioAvulso = async (romaneioId: string) => {
    if (!primaryLoja) return;
    
    try {
      setLoadingPorcionados(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();

      const { data: itens, error: itensError } = await supabase
        .from('romaneios_avulsos_itens')
        .select('id, quantidade')
        .eq('romaneio_avulso_id', romaneioId);

      if (itensError) throw itensError;

      // Atualizar quantidade recebida nos itens
      for (const item of itens || []) {
        const recebimento = recebimentos[item.id];
        const qtdRecebida = recebimento?.quantidade_recebida ?? item.quantidade;

        await supabase.from('romaneios_avulsos_itens').update({
          quantidade_recebida: qtdRecebida,
          peso_recebido_kg: recebimento?.peso_recebido_kg || null
        }).eq('id', item.id);
      }

      // NÃO CREDITA ESTOQUE - é livre digitação

      await supabase.from('romaneios_avulsos').update({
        status: 'recebido',
        data_recebimento: new Date().toISOString(),
        recebido_por_id: user.id,
        recebido_por_nome: userProfile?.nome || 'Usuário',
        observacao: observacaoRecebimento[romaneioId] || null
      }).eq('id', romaneioId);

      toast.success('Romaneio avulso recebido!');
      fetchRomaneiosAvulsos();
    } catch (error) {
      console.error('Erro ao receber romaneio avulso:', error);
      toast.error('Erro ao receber romaneio avulso');
    } finally {
      setLoadingPorcionados(false);
    }
  };

  const handleExcluirRomaneioAvulso = async (romaneioId: string) => {
    if (!confirm('Excluir este romaneio avulso?')) return;
    
    try {
      await supabase.from('romaneios_avulsos_itens').delete().eq('romaneio_avulso_id', romaneioId);
      await supabase.from('romaneios_avulsos').delete().eq('id', romaneioId);
      toast.success('Romaneio avulso excluído');
      fetchRomaneiosAvulsos();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };



  // ==================== HELPERS ====================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente': return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'enviado': return <Badge variant="outline" className="text-blue-600"><Send className="w-3 h-3 mr-1" />Enviado</Badge>;
      case 'recebido': return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Recebido</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ==================== REFRESH HANDLER ====================

  const handleRefresh = async () => {
    setLoadingPorcionados(true);
    try {
      await Promise.all([
        fetchItensDisponiveis(),
        fetchRomaneiosEnviados(),
        fetchRomaneiosHistorico(),
        fetchRomaneiosAvulsos()
      ]);
      toast.success('Dados atualizados!');
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar dados');
    } finally {
      setLoadingPorcionados(false);
    }
  };

  // ==================== RENDER ====================

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Romaneio</h1>
          </div>
          <Button 
            size="sm" 
            onClick={handleRefresh} 
            disabled={loadingPorcionados}
            className="!bg-green-600 hover:!bg-green-700 text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingPorcionados ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* ==================== SEÇÃO: ROMANEIO DE PORCIONADOS ==================== */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Romaneio de Porcionados
            </CardTitle>
            <CardDescription>Gestão de remessas de itens porcionados do CPD para as lojas</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={isLojaOnly ? 'receber' : 'enviar'} className="space-y-4">
              <TabsList className={`grid w-full ${isLojaOnly ? 'grid-cols-3' : 'grid-cols-4'}`}>
                {!isLojaOnly && <TabsTrigger value="enviar">Enviar</TabsTrigger>}
                <TabsTrigger value="receber">Receber</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
                <TabsTrigger value="avulso">
                  <ArrowRightLeft className="w-4 h-4 mr-1" />
                  Romaneio Avulso
                </TabsTrigger>
              </TabsList>

              {/* TAB: ENVIAR (fluxo unificado - criar e enviar em 1 passo) */}
              {!isLojaOnly && (
                <TabsContent value="enviar" className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <Select value={selectedLoja} onValueChange={setSelectedLoja}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a loja destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {lojas.map(loja => (
                            <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleCriarRomaneio} 
                      disabled={!selectedLoja || itensSelecionados.length === 0 || loadingPorcionados}
                    >
                      {loadingPorcionados ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-1" />
                      )}
                      Enviar Romaneio
                    </Button>
                  </div>

                  {selectedLoja && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Itens Disponíveis</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                          {itensDisponiveis.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhum item disponível</p>
                          ) : (
                            itensDisponiveis.map(item => (
                              <div key={item.item_id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                                <div>
                                  <p className="font-medium text-sm">{item.item_nome}</p>
                                  <div className="flex gap-2 text-xs text-muted-foreground">
                                    <span className="text-primary font-medium">Disponível: {item.quantidade_disponivel} un</span>
                                    <span>•</span>
                                    <span>CPD: {item.quantidade_estoque_cpd} un</span>
                                    <span>•</span>
                                    <span>Demanda: {item.quantidade_demanda_loja} un</span>
                                  </div>
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => addItem(item)}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Itens Selecionados ({itensSelecionados.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                          {itensSelecionados.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Clique + para adicionar</p>
                          ) : (
                            itensSelecionados.map(item => (
                              <div key={item.item_id} className="flex items-center gap-2 p-2 border rounded">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{item.item_nome}</p>
                                </div>
                                <Input
                                  type="number"
                                  value={item.quantidade || ''}
                                  onChange={(e) => updateQuantidade(item.item_id, parseInt(e.target.value) || 0)}
                                  className="w-20 h-8 text-center"
                                  min={1}
                                />
                                <span className="text-xs text-muted-foreground">un</span>
                                <Button size="sm" variant="ghost" onClick={() => removeItem(item.item_id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>
              )}


              {/* TAB: RECEBER */}
              <TabsContent value="receber" className="space-y-4">
                {romaneiosEnviados.length === 0 && romaneiosAvulsosReceber.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Nenhum romaneio para receber</p>
                  </div>
                ) : (
                  <>
                    {romaneiosEnviados.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">Romaneios do CPD</h3>
                        {romaneiosEnviados.map(romaneio => (
                          <Card key={romaneio.id}>
                            <CardHeader className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-sm">{romaneio.loja_nome}</CardTitle>
                                  <p className="text-xs text-muted-foreground">Por: {romaneio.usuario_nome}</p>
                                </div>
                                <Badge variant="outline" className="text-blue-600">
                                  Enviado {format(new Date(romaneio.data_envio!), "dd/MM HH:mm")}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {romaneio.romaneio_itens.map((item, idx) => {
                                const itemId = item.id || `${romaneio.id}-${idx}`;
                                return (
                                  <div key={itemId} className="flex items-center gap-2 p-2 border rounded">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{item.item_nome}</p>
                                      <p className="text-xs text-muted-foreground">Enviado: {item.quantidade} un</p>
                                    </div>
                                    <Input
                                      type="number"
                                      value={recebimentos[itemId]?.quantidade_recebida ?? ''}
                                      onChange={(e) => setRecebimentos(prev => ({
                                        ...prev,
                                        [itemId]: { ...prev[itemId], quantidade_recebida: parseInt(e.target.value) || 0 }
                                      }))}
                                      className="w-20 h-8"
                                      placeholder="Qtd"
                                    />
                                  </div>
                                );
                              })}
                              <Textarea
                                placeholder="Observação (opcional)"
                                value={observacaoRecebimento[romaneio.id] || ''}
                                onChange={(e) => setObservacaoRecebimento(prev => ({ ...prev, [romaneio.id]: e.target.value }))}
                                className="h-16"
                              />
                              <Button onClick={() => handleConfirmarRecebimento(romaneio.id)} disabled={loadingPorcionados} className="w-full">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Confirmar Recebimento
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {romaneiosAvulsosReceber.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">Romaneios Avulsos (Entre Lojas)</h3>
                        {romaneiosAvulsosReceber.map(romaneio => (
                          <Card key={romaneio.id}>
                            <CardHeader className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-sm">De: {romaneio.loja_origem_nome}</CardTitle>
                                  <p className="text-xs text-muted-foreground">Por: {romaneio.usuario_criacao_nome}</p>
                                </div>
                                <Badge variant="outline" className="text-purple-600">
                                  <ArrowRightLeft className="w-3 h-3 mr-1" />
                                  Avulso
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {romaneio.itens.map((item, idx) => {
                                const itemId = item.id || `avulso-${romaneio.id}-${idx}`;
                                return (
                                  <div key={itemId} className="flex items-center gap-2 p-2 border rounded">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{item.item_nome}</p>
                                      <p className="text-xs text-muted-foreground">Enviado: {item.quantidade} un</p>
                                    </div>
                                    <Input
                                      type="number"
                                      value={recebimentos[itemId]?.quantidade_recebida ?? item.quantidade}
                                      onChange={(e) => setRecebimentos(prev => ({
                                        ...prev,
                                        [itemId]: { ...prev[itemId], quantidade_recebida: parseInt(e.target.value) || 0 }
                                      }))}
                                      className="w-20 h-8"
                                      placeholder="Qtd"
                                    />
                                  </div>
                                );
                              })}
                              <Textarea
                                placeholder="Observação (opcional)"
                                value={observacaoRecebimento[romaneio.id] || ''}
                                onChange={(e) => setObservacaoRecebimento(prev => ({ ...prev, [romaneio.id]: e.target.value }))}
                                className="h-16"
                              />
                              <Button onClick={() => handleReceberRomaneioAvulso(romaneio.id)} disabled={loadingPorcionados} className="w-full">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Confirmar Recebimento
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* TAB: HISTÓRICO */}
              <TabsContent value="historico" className="space-y-4">
                <div className="flex gap-2">
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-40">
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

                {romaneiosHistorico.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Nenhum romaneio encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {romaneiosHistorico.map(romaneio => (
                      <div key={romaneio.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium">{romaneio.loja_nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(romaneio.data_criacao), "dd/MM/yyyy HH:mm")} • {romaneio.usuario_nome}
                            </p>
                          </div>
                          {getStatusBadge(romaneio.status)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {romaneio.romaneio_itens.map((item, i) => (
                            <span key={i}>{item.item_nome}: {item.quantidade}un{i < romaneio.romaneio_itens.length - 1 ? ' • ' : ''}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* TAB: ROMANEIO AVULSO (LIVRE DIGITAÇÃO) */}
              <TabsContent value="avulso" className="space-y-4">
                {/* Seleção de Origem e Destino */}
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Origem: Se tem primaryLoja, mostra fixo. Senão, dropdown */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Origem</label>
                      {primaryLoja ? (
                        <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
                          <Store className="w-4 h-4 mr-2 text-muted-foreground" />
                          {primaryLoja.loja_nome}
                        </div>
                      ) : (
                        <Select value={lojaOrigemAvulso} onValueChange={setLojaOrigemAvulso}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a origem" />
                          </SelectTrigger>
                          <SelectContent>
                            {todasLojas.map(loja => (
                              <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Destino: Sempre dropdown com todas as lojas exceto origem */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">Destino</label>
                      <Select value={lojaDestinoAvulso} onValueChange={setLojaDestinoAvulso}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {todasLojas
                            .filter(l => l.id !== (primaryLoja?.loja_id || lojaOrigemAvulso))
                            .map(loja => (
                              <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Badge mostrando direção da transferência */}
                  {(primaryLoja || lojaOrigemAvulso) && lojaDestinoAvulso && (
                    <Badge variant="secondary" className="w-fit py-2">
                      <ArrowRightLeft className="w-3 h-3 mr-2" />
                      {primaryLoja?.loja_nome || todasLojas.find(l => l.id === lojaOrigemAvulso)?.nome} → {todasLojas.find(l => l.id === lojaDestinoAvulso)?.nome}
                    </Badge>
                  )}
                </div>

                {((primaryLoja || lojaOrigemAvulso) && lojaDestinoAvulso) && (
                  <>
                    {/* Formulário de Livre Digitação */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Adicionar Item</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1">
                            <Input
                              placeholder="Descrição do item (ex: 10 pratos, 5 cadeiras, 1 caixa de talheres)"
                              value={novoItemDescricao}
                              onChange={(e) => setNovoItemDescricao(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAdicionarItemAvulsoLivre()}
                            />
                          </div>
                          <div className="w-24">
                            <Input
                              type="number"
                              min={1}
                              value={novoItemQuantidade}
                              onChange={(e) => setNovoItemQuantidade(parseInt(e.target.value) || 1)}
                              placeholder="Qtd"
                              className="text-center"
                            />
                          </div>
                          <Button onClick={handleAdicionarItemAvulsoLivre} variant="outline">
                            <Plus className="w-4 h-4 mr-1" />
                            Adicionar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Lista de Itens a Transferir */}
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Itens a Transferir ({itensAvulsoLivre.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                        {itensAvulsoLivre.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Adicione itens usando o formulário acima</p>
                        ) : (
                          itensAvulsoLivre.map(item => (
                            <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.descricao}</p>
                              </div>
                              <Badge variant="secondary">{item.quantidade}</Badge>
                              <Button size="sm" variant="ghost" onClick={() => handleRemoverItemAvulsoLivre(item.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* Observação */}
                    <Textarea
                      placeholder="Observação (opcional)"
                      value={observacaoAvulso}
                      onChange={(e) => setObservacaoAvulso(e.target.value)}
                      className="h-20"
                    />

                    {/* Botão Enviar */}
                    <Button 
                      onClick={handleCriarRomaneioAvulso} 
                      disabled={itensAvulsoLivre.length === 0 || loadingPorcionados}
                      className="w-full"
                    >
                      {loadingPorcionados ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-1" />
                      )}
                      Enviar Romaneio Avulso
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
};

export default Romaneio;
