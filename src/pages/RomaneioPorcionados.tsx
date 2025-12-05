import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Plus, Trash2, Send, CheckCircle, Clock, History, Package, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUserLoja } from '@/hooks/useUserLoja';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

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

interface ItemLojaEstoque {
  item_id: string;
  item_nome: string;
  quantidade_disponivel: number;
}

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

const RomaneioPorcionados = () => {
  const { user, profile, isAdmin, hasRole } = useAuth();
  const { organizationId } = useOrganization();
  const { primaryLoja, userLojas } = useUserLoja();
  
  // State for regular romaneio
  const [selectedLoja, setSelectedLoja] = useState<string>('');
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemDisponivel[]>([]);
  const [itensSelecionados, setItensSelecionados] = useState<ItemSelecionado[]>([]);
  const [loading, setLoading] = useState(false);
  const [romaneiosEnviados, setRomaneiosEnviados] = useState<Romaneio[]>([]);
  const [romaneiosHistorico, setRomaneiosHistorico] = useState<Romaneio[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [userLojasIds, setUserLojasIds] = useState<string[]>([]);
  const [romaneiosPendentes, setRomaneiosPendentes] = useState<Romaneio[]>([]);
  
  // State for romaneio avulso
  const [lojaDestinoAvulso, setLojaDestinoAvulso] = useState<string>('');
  const [itensLojaEstoque, setItensLojaEstoque] = useState<ItemLojaEstoque[]>([]);
  const [itensSelecionadosAvulso, setItensSelecionadosAvulso] = useState<ItemSelecionado[]>([]);
  const [romaneiosAvulsosPendentes, setRomaneiosAvulsosPendentes] = useState<RomaneioAvulso[]>([]);
  const [romaneiosAvulsosReceber, setRomaneiosAvulsosReceber] = useState<RomaneioAvulso[]>([]);
  
  const [recebimentos, setRecebimentos] = useState<{
    [itemId: string]: {
      quantidade_recebida: number;
      peso_recebido_kg: number;
    }
  }>({});
  const [observacaoRecebimento, setObservacaoRecebimento] = useState<{
    [romaneioId: string]: string
  }>({});

  // Check if user is Loja-only (no Admin or Produção roles)
  const isLojaOnly = hasRole('Loja') && !isAdmin() && !hasRole('Produção');
  const canManageProduction = isAdmin() || hasRole('Produção');

  useEffect(() => {
    fetchLojas();
    fetchUserLojas();
    fetchRomaneiosPendentes();

    const channel = supabase
      .channel('estoque-cpd-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_cpd' }, () => {
        if (selectedLoja) fetchItensDisponiveis();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
    if (primaryLoja) {
      fetchItensLojaEstoque();
    }
  }, [primaryLoja]);
  
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

  const fetchUserLojas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: lojas } = await supabase.from('lojas_acesso').select('loja_id').eq('user_id', user.id);
    setUserLojasIds(lojas?.map(l => l.loja_id) || []);
  };

  const fetchLojas = async () => {
    const { data, error } = await supabase.from('lojas').select('*').order('nome');
    if (error) { toast.error('Erro ao carregar lojas'); return; }
    setLojas(data || []);
  };

  const fetchItensDisponiveis = async () => {
    if (!selectedLoja) { setItensDisponiveis([]); return; }

    try {
      const { data: estoqueCpd, error: estoqueError } = await supabase
        .from('estoque_cpd')
        .select(`item_porcionado_id, quantidade, itens_porcionados!inner(nome, peso_unitario_g)`)
        .gt('quantidade', 0);

      if (estoqueError) throw estoqueError;

      const { data: producoes, error: producoesError } = await supabase
        .from('producao_registros')
        .select('item_id, item_nome, detalhes_lojas, data_fim')
        .eq('status', 'finalizado')
        .order('data_fim', { ascending: false });

      if (producoesError) throw producoesError;

      const ultimaProducaoPorItem = new Map<string, any>();
      producoes?.forEach(prod => {
        if (!ultimaProducaoPorItem.has(prod.item_id)) {
          ultimaProducaoPorItem.set(prod.item_id, prod);
        }
      });

      const quantidadesPorItem = new Map<string, number>();
      ultimaProducaoPorItem.forEach((prod, item_id) => {
        const detalhes = prod.detalhes_lojas as any[];
        const detalheLoja = detalhes?.find((d: any) => d.loja_id === selectedLoja);
        if (detalheLoja && detalheLoja.quantidade > 0) {
          quantidadesPorItem.set(item_id, detalheLoja.quantidade);
        }
      });

      const { data: romaneiosPendentes, error: romaneiosError } = await supabase
        .from('romaneio_itens')
        .select(`item_porcionado_id, quantidade, romaneios!inner(loja_id, status)`)
        .eq('romaneios.loja_id', selectedLoja)
        .eq('romaneios.status', 'pendente');

      if (romaneiosError) throw romaneiosError;

      romaneiosPendentes?.forEach(ri => {
        const atual = quantidadesPorItem.get(ri.item_porcionado_id) || 0;
        quantidadesPorItem.set(ri.item_porcionado_id, Math.max(0, atual - ri.quantidade));
      });

      const itensFinais: ItemDisponivel[] = [];
      estoqueCpd?.forEach(est => {
        const quantidadeDaLoja = quantidadesPorItem.get(est.item_porcionado_id) || 0;
        const disponivel = Math.min(quantidadeDaLoja, est.quantidade || 0);
        
        if (disponivel > 0) {
          itensFinais.push({
            item_id: est.item_porcionado_id,
            item_nome: (est.itens_porcionados as any).nome,
            quantidade_disponivel: disponivel,
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

  const fetchItensLojaEstoque = async () => {
    if (!primaryLoja) return;
    
    try {
      const { data, error } = await supabase
        .from('estoque_loja_itens')
        .select(`item_porcionado_id, quantidade, itens_porcionados!inner(nome)`)
        .eq('loja_id', primaryLoja.loja_id)
        .gt('quantidade', 0);

      if (error) throw error;

      const itens: ItemLojaEstoque[] = (data || []).map((item: any) => ({
        item_id: item.item_porcionado_id,
        item_nome: item.itens_porcionados.nome,
        quantidade_disponivel: item.quantidade || 0
      }));

      setItensLojaEstoque(itens);
    } catch (error) {
      console.error('Erro ao buscar estoque da loja:', error);
    }
  };

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

  const fetchRomaneiosPendentes = async () => {
    try {
      const { data, error } = await supabase
        .from('romaneios')
        .select(`*, romaneio_itens (item_nome, quantidade, peso_total_kg)`)
        .eq('status', 'pendente')
        .order('data_criacao', { ascending: false });

      if (error) throw error;
      setRomaneiosPendentes(data || []);
    } catch (error) {
      console.error('Erro ao buscar romaneios pendentes:', error);
    }
  };

  const fetchRomaneiosAvulsos = async () => {
    if (!primaryLoja) return;
    
    try {
      // Romaneios avulsos pendentes de envio (origem = minha loja)
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

      // Romaneios avulsos para receber (destino = minha loja, status = enviado)
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
    } catch (error) {
      console.error('Erro ao buscar romaneios avulsos:', error);
    }
  };

  const handleConfirmarRecebimento = async (romaneioId: string) => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  const handleEnviarRomaneio = async (romaneioId: string) => {
    try {
      setLoading(true);

      const { data: romaneioItens, error: itensError } = await supabase
        .from('romaneio_itens')
        .select('item_porcionado_id, quantidade, item_nome')
        .eq('romaneio_id', romaneioId);

      if (itensError) throw itensError;

      for (const item of romaneioItens || []) {
        const { data: estoque } = await supabase.from('estoque_cpd').select('quantidade').eq('item_porcionado_id', item.item_porcionado_id).single();
        const estoqueAtual = estoque?.quantidade || 0;
        
        if (estoqueAtual < item.quantidade) {
          toast.error(`Estoque insuficiente: ${item.item_nome}. Disponível: ${estoqueAtual}, Solicitado: ${item.quantidade}`);
          return;
        }
      }

      for (const item of romaneioItens || []) {
        await supabase.rpc('decrementar_estoque_cpd', { p_item_id: item.item_porcionado_id, p_quantidade: item.quantidade });
      }

      await supabase.from('romaneios').update({ status: 'enviado', data_envio: new Date().toISOString() }).eq('id', romaneioId);

      toast.success('Romaneio enviado!');
      fetchRomaneiosPendentes();
      fetchRomaneiosEnviados();
      fetchItensDisponiveis();
    } catch (error) {
      toast.error('Erro ao enviar romaneio');
    } finally {
      setLoading(false);
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
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      const loja = lojas.find(l => l.id === selectedLoja);

      const { data: romaneio, error: romaneioError } = await supabase.from('romaneios').insert({
        loja_id: selectedLoja,
        loja_nome: loja?.nome || '',
        status: 'pendente',
        data_criacao: new Date().toISOString(),
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

      toast.success('Romaneio criado!');
      setItensSelecionados([]);
      fetchRomaneiosPendentes();
      fetchItensDisponiveis();
    } catch (error) {
      toast.error('Erro ao criar romaneio');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirRomaneio = async (romaneioId: string) => {
    if (!confirm('Excluir este romaneio?')) return;
    
    try {
      await supabase.from('romaneio_itens').delete().eq('romaneio_id', romaneioId);
      await supabase.from('romaneios').delete().eq('id', romaneioId);
      toast.success('Romaneio excluído');
      fetchRomaneiosPendentes();
      fetchItensDisponiveis();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  // Romaneio Avulso Functions
  const addItemAvulso = (item: ItemLojaEstoque) => {
    const existe = itensSelecionadosAvulso.find(i => i.item_id === item.item_id);
    if (existe) {
      toast.error('Item já adicionado');
      return;
    }
    setItensSelecionadosAvulso([...itensSelecionadosAvulso, {
      item_id: item.item_id,
      item_nome: item.item_nome,
      quantidade: item.quantidade_disponivel,
      peso_total_kg: 0,
      producao_registro_ids: []
    }]);
  };

  const removeItemAvulso = (itemId: string) => {
    setItensSelecionadosAvulso(itensSelecionadosAvulso.filter(i => i.item_id !== itemId));
  };

  const updateQuantidadeAvulso = (itemId: string, quantidade: number) => {
    setItensSelecionadosAvulso(itensSelecionadosAvulso.map(i => 
      i.item_id === itemId ? { ...i, quantidade: Math.max(1, quantidade) } : i
    ));
  };

  const handleCriarRomaneioAvulso = async () => {
    if (!primaryLoja || !lojaDestinoAvulso || itensSelecionadosAvulso.length === 0) {
      toast.error('Selecione uma loja destino e adicione itens');
      return;
    }

    if (lojaDestinoAvulso === primaryLoja.loja_id) {
      toast.error('A loja destino deve ser diferente da sua loja');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      const lojaDestino = lojas.find(l => l.id === lojaDestinoAvulso);

      const { data: romaneio, error: romaneioError } = await supabase.from('romaneios_avulsos').insert({
        loja_origem_id: primaryLoja.loja_id,
        loja_origem_nome: primaryLoja.loja_nome,
        loja_destino_id: lojaDestinoAvulso,
        loja_destino_nome: lojaDestino?.nome || '',
        status: 'pendente',
        data_criacao: new Date().toISOString(),
        usuario_criacao_id: user.id,
        usuario_criacao_nome: userProfile?.nome || 'Usuário',
        organization_id: organizationId
      }).select().single();

      if (romaneioError) throw romaneioError;

      const itens = itensSelecionadosAvulso.map(item => ({
        romaneio_avulso_id: romaneio.id,
        item_porcionado_id: item.item_id,
        item_nome: item.item_nome,
        quantidade: item.quantidade,
        peso_kg: item.peso_total_kg,
        organization_id: organizationId
      }));

      await supabase.from('romaneios_avulsos_itens').insert(itens);

      toast.success('Romaneio avulso criado!');
      setItensSelecionadosAvulso([]);
      setLojaDestinoAvulso('');
      fetchRomaneiosAvulsos();
    } catch (error) {
      console.error('Erro ao criar romaneio avulso:', error);
      toast.error('Erro ao criar romaneio avulso');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarRomaneioAvulso = async (romaneioId: string) => {
    if (!primaryLoja) return;
    
    try {
      setLoading(true);

      const { data: itens, error: itensError } = await supabase
        .from('romaneios_avulsos_itens')
        .select('item_porcionado_id, quantidade, item_nome')
        .eq('romaneio_avulso_id', romaneioId);

      if (itensError) throw itensError;

      // Verificar e debitar estoque da loja origem
      for (const item of itens || []) {
        const { data: estoque } = await supabase
          .from('estoque_loja_itens')
          .select('quantidade')
          .eq('item_porcionado_id', item.item_porcionado_id)
          .eq('loja_id', primaryLoja.loja_id)
          .single();

        const estoqueAtual = estoque?.quantidade || 0;
        
        if (estoqueAtual < item.quantidade) {
          toast.error(`Estoque insuficiente: ${item.item_nome}. Disponível: ${estoqueAtual}, Solicitado: ${item.quantidade}`);
          return;
        }

        // Debitar do estoque da loja origem
        await supabase
          .from('estoque_loja_itens')
          .update({ 
            quantidade: estoqueAtual - item.quantidade,
            data_ultima_movimentacao: new Date().toISOString()
          })
          .eq('item_porcionado_id', item.item_porcionado_id)
          .eq('loja_id', primaryLoja.loja_id);
      }

      await supabase.from('romaneios_avulsos').update({ 
        status: 'enviado', 
        data_envio: new Date().toISOString() 
      }).eq('id', romaneioId);

      toast.success('Romaneio avulso enviado!');
      fetchRomaneiosAvulsos();
      fetchItensLojaEstoque();
    } catch (error) {
      console.error('Erro ao enviar romaneio avulso:', error);
      toast.error('Erro ao enviar romaneio avulso');
    } finally {
      setLoading(false);
    }
  };

  const handleReceberRomaneioAvulso = async (romaneioId: string) => {
    if (!primaryLoja) return;
    
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();

      const { data: itens, error: itensError } = await supabase
        .from('romaneios_avulsos_itens')
        .select('id, item_porcionado_id, quantidade, item_nome')
        .eq('romaneio_avulso_id', romaneioId);

      if (itensError) throw itensError;

      // Atualizar quantidade recebida e creditar estoque da loja destino
      for (const item of itens || []) {
        const recebimento = recebimentos[item.id];
        const qtdRecebida = recebimento?.quantidade_recebida ?? item.quantidade;

        // Atualizar item com quantidade recebida
        await supabase.from('romaneios_avulsos_itens').update({
          quantidade_recebida: qtdRecebida,
          peso_recebido_kg: recebimento?.peso_recebido_kg || null
        }).eq('id', item.id);

        // Creditar no estoque da loja destino
        const { data: estoqueAtual } = await supabase
          .from('estoque_loja_itens')
          .select('quantidade')
          .eq('item_porcionado_id', item.item_porcionado_id)
          .eq('loja_id', primaryLoja.loja_id)
          .single();

        if (estoqueAtual) {
          await supabase
            .from('estoque_loja_itens')
            .update({ 
              quantidade: (estoqueAtual.quantidade || 0) + qtdRecebida,
              data_ultima_movimentacao: new Date().toISOString()
            })
            .eq('item_porcionado_id', item.item_porcionado_id)
            .eq('loja_id', primaryLoja.loja_id);
        } else {
          await supabase
            .from('estoque_loja_itens')
            .insert({
              item_porcionado_id: item.item_porcionado_id,
              loja_id: primaryLoja.loja_id,
              quantidade: qtdRecebida,
              data_ultima_movimentacao: new Date().toISOString(),
              organization_id: organizationId
            });
        }
      }

      await supabase.from('romaneios_avulsos').update({
        status: 'recebido',
        data_recebimento: new Date().toISOString(),
        recebido_por_id: user.id,
        recebido_por_nome: userProfile?.nome || 'Usuário',
        observacao: observacaoRecebimento[romaneioId] || null
      }).eq('id', romaneioId);

      toast.success('Romaneio avulso recebido!');
      fetchRomaneiosAvulsos();
      fetchItensLojaEstoque();
    } catch (error) {
      console.error('Erro ao receber romaneio avulso:', error);
      toast.error('Erro ao receber romaneio avulso');
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente': return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'enviado': return <Badge variant="outline" className="text-blue-600"><Send className="w-3 h-3 mr-1" />Enviado</Badge>;
      case 'recebido': return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Recebido</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Define visible tabs based on user role
  const visibleTabs = isLojaOnly 
    ? ['receber', 'historico', 'avulso']
    : ['gerar', 'enviar', 'receber', 'historico', 'avulso'];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Romaneio</h1>
        </div>

        <Tabs defaultValue={isLojaOnly ? 'receber' : 'gerar'} className="space-y-4">
          <TabsList className={`grid w-full ${isLojaOnly ? 'grid-cols-3' : 'grid-cols-5'}`}>
            {!isLojaOnly && <TabsTrigger value="gerar">Gerar</TabsTrigger>}
            {!isLojaOnly && <TabsTrigger value="enviar">Enviar</TabsTrigger>}
            <TabsTrigger value="receber">Receber</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="avulso">
              <ArrowRightLeft className="w-4 h-4 mr-1" />
              Avulso
            </TabsTrigger>
          </TabsList>

          {/* TAB: GERAR ROMANEIO */}
          {!isLojaOnly && (
            <TabsContent value="gerar" className="space-y-4">
              <Card>
                <CardContent className="pt-4">
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
                      disabled={!selectedLoja || itensSelecionados.length === 0 || loading}
                      className="whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Criar Romaneio
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {selectedLoja && (
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Itens Disponíveis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {itensDisponiveis.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum item disponível</p>
                      ) : (
                        itensDisponiveis.map(item => (
                          <div key={item.item_id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                            <div>
                              <p className="font-medium text-sm">{item.item_nome}</p>
                              <p className="text-xs text-muted-foreground">{item.quantidade_disponivel} un</p>
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
                    <CardContent className="space-y-2">
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

          {/* TAB: ENVIAR ROMANEIO */}
          {!isLojaOnly && (
            <TabsContent value="enviar" className="space-y-4">
              {romaneiosPendentes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Send className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Nenhum romaneio pendente de envio</p>
                  </CardContent>
                </Card>
              ) : (
                romaneiosPendentes.map(romaneio => (
                  <Card key={romaneio.id}>
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{romaneio.loja_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {romaneio.romaneio_itens.length} itens • {format(new Date(romaneio.data_criacao), "dd/MM HH:mm")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleExcluirRomaneio(romaneio.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" onClick={() => handleEnviarRomaneio(romaneio.id)} disabled={loading}>
                            <Send className="w-4 h-4 mr-1" />
                            Enviar
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {romaneio.romaneio_itens.map((item, i) => (
                          <span key={i}>{item.item_nome}: {item.quantidade}un{i < romaneio.romaneio_itens.length - 1 ? ' • ' : ''}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          )}

          {/* TAB: RECEBER PORCIONADOS */}
          <TabsContent value="receber" className="space-y-4">
            {/* Romaneios de Produção */}
            {romaneiosEnviados.length === 0 && romaneiosAvulsosReceber.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum romaneio pendente de recebimento</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Romaneios de Produção */}
                {romaneiosEnviados.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Romaneios de Produção</h3>
                    {romaneiosEnviados.map(romaneio => (
                      <Card key={romaneio.id}>
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{romaneio.loja_nome}</CardTitle>
                            <Badge variant="outline" className="text-blue-600">
                              {format(new Date(romaneio.data_envio!), "dd/MM HH:mm")}
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
                          <Button onClick={() => handleConfirmarRecebimento(romaneio.id)} disabled={loading} className="w-full">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Confirmar Recebimento
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Romaneios Avulsos para Receber */}
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
                          <Button onClick={() => handleReceberRomaneioAvulso(romaneio.id)} disabled={loading} className="w-full">
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
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum romaneio encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {romaneiosHistorico.map(romaneio => (
                  <Card key={romaneio.id}>
                    <CardContent className="py-3">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB: ROMANEIO AVULSO */}
          <TabsContent value="avulso" className="space-y-4">
            {!primaryLoja ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Você precisa estar vinculado a uma loja para usar o romaneio avulso</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Criar Romaneio Avulso */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4" />
                      Transferir Itens para Outra Loja
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Select value={lojaDestinoAvulso} onValueChange={setLojaDestinoAvulso}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a loja destino" />
                          </SelectTrigger>
                          <SelectContent>
                            {lojas.filter(l => l.id !== primaryLoja.loja_id).map(loja => (
                              <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={handleCriarRomaneioAvulso} 
                        disabled={!lojaDestinoAvulso || itensSelecionadosAvulso.length === 0 || loading}
                        className="whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Criar Romaneio
                      </Button>
                    </div>

                    {lojaDestinoAvulso && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Seu Estoque ({primaryLoja.loja_nome})</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {itensLojaEstoque.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item no estoque</p>
                            ) : (
                              itensLojaEstoque.map(item => (
                                <div key={item.item_id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                                  <div>
                                    <p className="font-medium text-sm">{item.item_nome}</p>
                                    <p className="text-xs text-muted-foreground">{item.quantidade_disponivel} un</p>
                                  </div>
                                  <Button size="sm" variant="ghost" onClick={() => addItemAvulso(item)}>
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium mb-2">Itens a Transferir ({itensSelecionadosAvulso.length})</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {itensSelecionadosAvulso.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">Clique + para adicionar</p>
                            ) : (
                              itensSelecionadosAvulso.map(item => (
                                <div key={item.item_id} className="flex items-center gap-2 p-2 border rounded">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{item.item_nome}</p>
                                  </div>
                                  <Input
                                    type="number"
                                    value={item.quantidade || ''}
                                    onChange={(e) => updateQuantidadeAvulso(item.item_id, parseInt(e.target.value) || 0)}
                                    className="w-20 h-8 text-center"
                                    min={1}
                                  />
                                  <span className="text-xs text-muted-foreground">un</span>
                                  <Button size="sm" variant="ghost" onClick={() => removeItemAvulso(item.item_id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Romaneios Avulsos Pendentes de Envio */}
                {romaneiosAvulsosPendentes.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Pendentes de Envio</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {romaneiosAvulsosPendentes.map(romaneio => (
                        <div key={romaneio.id} className="border rounded p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Para: {romaneio.loja_destino_nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {romaneio.itens.length} itens • {format(new Date(romaneio.data_criacao), "dd/MM HH:mm")}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleExcluirRomaneioAvulso(romaneio.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => handleEnviarRomaneioAvulso(romaneio.id)} disabled={loading}>
                                <Send className="w-4 h-4 mr-1" />
                                Enviar
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {romaneio.itens.map((item, i) => (
                              <span key={i}>{item.item_nome}: {item.quantidade}un{i < romaneio.itens.length - 1 ? ' • ' : ''}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default RomaneioPorcionados;
