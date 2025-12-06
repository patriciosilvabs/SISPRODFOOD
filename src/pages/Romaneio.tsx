import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Plus, Trash2, Send, CheckCircle, Clock, History, Package, ArrowRightLeft, Store, Search, Loader2, ClipboardList, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUserLoja } from '@/hooks/useUserLoja';
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

// Interfaces para Romaneio de Produtos
interface Produto {
  id: string;
  nome: string;
  codigo: string | null;
  unidade_consumo: string | null;
  modo_envio?: string | null;
  peso_por_unidade_kg?: number | null;
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

interface ProdutoEstoque {
  id: string;
  nome: string;
  quantidade: number;
  unidade_consumo: string | null;
  quantidadeNecessaria?: number;
  estoqueMinimoDia?: number;
  estoqueAtualLoja?: number;
  modo_envio?: string | null;
  peso_por_unidade_kg?: number | null;
  estoqueEmUnidades?: number | null;
}

// Componente para item de produto no romaneio
const ProdutoRomaneioItem = ({ 
  produto, 
  onAdicionar 
}: { 
  produto: ProdutoEstoque; 
  onAdicionar: (produto: ProdutoEstoque, qtd: number) => void;
}) => {
  const isUnidadeMode = produto.modo_envio === 'unidade';
  const [qtdTemp, setQtdTemp] = useState(produto.quantidadeNecessaria || 1);
  
  // Reset qtdTemp when quantidadeNecessaria changes
  useEffect(() => {
    if (produto.quantidadeNecessaria && produto.quantidadeNecessaria > 0) {
      setQtdTemp(Math.min(produto.quantidadeNecessaria, produto.quantidade));
    }
  }, [produto.quantidadeNecessaria, produto.quantidade]);

  const handleQtdChange = (value: string) => {
    let newValue = Number(value);
    if (isUnidadeMode) {
      // Apenas valores inteiros para unidades
      newValue = Math.floor(newValue);
    }
    setQtdTemp(Math.min(Math.max(0, newValue), produto.quantidade));
  };
  
  return (
    <div className="p-3 flex flex-col gap-2 border-b last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{produto.nome}</p>
          
          {isUnidadeMode ? (
            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground mt-0.5">
              <span>CPD: {produto.quantidade} un</span>
              <span>•</span>
              <span>Loja: {produto.estoqueEmUnidades?.toFixed(2) ?? '-'} un ({produto.estoqueAtualLoja ?? 0} kg)</span>
              <span>•</span>
              <span>Mín: {produto.estoqueMinimoDia ?? '-'} un</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground mt-0.5">
              <span>CPD: {produto.quantidade}</span>
              <span>•</span>
              <span>Loja: {produto.estoqueAtualLoja ?? '-'}</span>
              <span>•</span>
              <span>Mín: {produto.estoqueMinimoDia ?? '-'}</span>
            </div>
          )}
          
          <div className="flex flex-wrap gap-1 mt-1">
            {isUnidadeMode && (
              <Badge variant="secondary" className="text-xs">
                📦 Unidade
              </Badge>
            )}
            {(produto.quantidadeNecessaria ?? 0) > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                A Enviar: {produto.quantidadeNecessaria}{isUnidadeMode ? ' un' : ''}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={produto.quantidade}
            step={isUnidadeMode ? 1 : 0.1}
            value={qtdTemp}
            onChange={(e) => handleQtdChange(e.target.value)}
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
    </div>
  );
};

// ==================== COMPONENTE PRINCIPAL ====================

const Romaneio = () => {
  const { user, profile, isAdmin, hasRole } = useAuth();
  const { organizationId } = useOrganization();
  const { primaryLoja, userLojas } = useUserLoja();

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
  const [romaneiosPendentes, setRomaneiosPendentes] = useState<Romaneio[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [userLojasIds, setUserLojasIds] = useState<string[]>([]);
  
  // Romaneio Avulso
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
  const [observacaoRecebimento, setObservacaoRecebimento] = useState<{ [romaneioId: string]: string }>({});

  // ==================== ESTADOS: PRODUTOS ====================
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [estoquesProdutos, setEstoquesProdutos] = useState<{ produto_id: string; quantidade: number }[]>([]);
  const [lojaSelecionadaProduto, setLojaSelecionadaProduto] = useState("");
  const [carrinhoProduto, setCarrinhoProduto] = useState<{ produto_id: string; produto_nome: string; quantidade: number; unidade: string | null }[]>([]);
  const [searchProduto, setSearchProduto] = useState("");
  const [romaneiosProdutosPendentes, setRomaneiosProdutosPendentes] = useState<RomaneioProduto[]>([]);
  const [itensRomaneiosProdutos, setItensRomaneiosProdutos] = useState<{ [key: string]: RomaneioProdutoItem[] }>({});
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [enviandoProduto, setEnviandoProduto] = useState(false);
  const [savingProduto, setSavingProduto] = useState(false);
  const [estoqueMinimoSemanal, setEstoqueMinimoSemanal] = useState<any[]>([]);
  const [estoqueLojaAtual, setEstoqueLojaAtual] = useState<any[]>([]);
  
  // Estados para recebimento de Romaneio de Produtos
  const [romaneiosProdutosEnviados, setRomaneiosProdutosEnviados] = useState<RomaneioProduto[]>([]);
  const [recebimentosProduto, setRecebimentosProduto] = useState<{[itemId: string]: { quantidade_recebida: number; divergencia?: boolean; observacao_divergencia?: string }}>({});

  // ==================== EFFECTS ====================

  useEffect(() => {
    fetchLojas();
    fetchUserLojas();
    fetchRomaneiosPendentes();
    fetchProdutos();
    fetchEstoquesProdutos();
    fetchRomaneiosProdutos();
    fetchRomaneiosProdutosEnviados();

    let isMounted = true;
    
    const channel = supabase
      .channel('estoque-cpd-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_cpd' }, () => {
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

  // Buscar dados da loja selecionada para produtos
  useEffect(() => {
    if (lojaSelecionadaProduto && organizationId) {
      fetchDadosLojaSelecionada();
    } else {
      setEstoqueMinimoSemanal([]);
      setEstoqueLojaAtual([]);
    }
  }, [lojaSelecionadaProduto, organizationId]);

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
            .order('nome');
          
          if (error) throw error;
          setLojas(data || []);
        }
      } else {
        const { data, error } = await supabase.from('lojas').select('*').order('nome');
        if (error) throw error;
        setLojas(data || []);
      }
    } catch (error) {
      toast.error('Erro ao carregar lojas');
    }
  };

  const fetchProdutos = async () => {
    try {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, codigo, unidade_consumo, modo_envio, peso_por_unidade_kg")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  };

  const getDiaSemana = () => {
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    return dias[new Date().getDay()];
  };

  const fetchDadosLojaSelecionada = async () => {
    if (!lojaSelecionadaProduto || !organizationId) return;
    
    try {
      // Buscar estoque mínimo semanal da loja
      const { data: minimoSemanal, error: minimoError } = await supabase
        .from('produtos_estoque_minimo_semanal')
        .select('produto_id, segunda, terca, quarta, quinta, sexta, sabado, domingo')
        .eq('loja_id', lojaSelecionadaProduto)
        .eq('organization_id', organizationId);
      
      if (minimoError) throw minimoError;
      
      // Buscar estoque atual da loja
      const { data: estoqueAtual, error: estoqueError } = await supabase
        .from('estoque_loja_produtos')
        .select('produto_id, quantidade')
        .eq('loja_id', lojaSelecionadaProduto)
        .eq('organization_id', organizationId);
      
      if (estoqueError) throw estoqueError;
      
      setEstoqueMinimoSemanal(minimoSemanal || []);
      setEstoqueLojaAtual(estoqueAtual || []);
    } catch (error) {
      console.error('Erro ao buscar dados da loja:', error);
    }
  };

  const fetchEstoquesProdutos = async () => {
    if (!organizationId) return;
    try {
      const { data, error } = await supabase
        .from("estoque_cpd_produtos")
        .select("produto_id, quantidade")
        .eq("organization_id", organizationId);
      if (error) throw error;
      setEstoquesProdutos(data || []);
    } catch (error) {
      console.error("Erro ao buscar estoques:", error);
    }
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
    } catch (error) {
      console.error('Erro ao buscar romaneios avulsos:', error);
    }
  };

  const fetchRomaneiosProdutos = async () => {
    if (!organizationId) return;
    setLoadingProdutos(true);
    try {
      const { data, error } = await supabase
        .from("romaneios_produtos")
        .select("*")
        .eq("organization_id", organizationId)
        .in("status", ["pendente", "enviado"])
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      setRomaneiosProdutosPendentes(data || []);

      for (const romaneio of data || []) {
        const { data: itens } = await supabase
          .from("romaneios_produtos_itens")
          .select("*")
          .eq("romaneio_id", romaneio.id);
        
        setItensRomaneiosProdutos(prev => ({
          ...prev,
          [romaneio.id]: itens || []
        }));
      }
    } catch (error: any) {
      console.error("Erro ao buscar romaneios de produtos:", error);
    } finally {
      setLoadingProdutos(false);
    }
  };

  const fetchRomaneiosProdutosEnviados = async () => {
    if (!organizationId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("romaneios_produtos")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "enviado")
        .order("data_envio", { ascending: false });

      // Se for usuário de loja, filtrar por lojas vinculadas
      if (!isAdmin() && userLojasIds.length > 0) {
        query = query.in('loja_id', userLojasIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRomaneiosProdutosEnviados(data || []);
      
      // Buscar itens de cada romaneio enviado
      for (const romaneio of data || []) {
        const { data: itens } = await supabase
          .from("romaneios_produtos_itens")
          .select("*")
          .eq("romaneio_id", romaneio.id);
        
        setItensRomaneiosProdutos(prev => ({
          ...prev,
          [romaneio.id]: itens || []
        }));
        
        // Inicializar estado de recebimento
        itens?.forEach((item: RomaneioProdutoItem) => {
          setRecebimentosProduto(prev => ({
            ...prev,
            [item.id]: {
              quantidade_recebida: item.quantidade,
              divergencia: false,
              observacao_divergencia: ''
            }
          }));
        });
      }
    } catch (error: any) {
      console.error("Erro ao buscar romaneios de produtos enviados:", error);
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

  const handleEnviarRomaneio = async (romaneioId: string) => {
    try {
      setLoadingPorcionados(true);

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
      setLoadingPorcionados(false);
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

  // ==================== HANDLERS: AVULSO ====================

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
      setLoadingPorcionados(true);
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
      setLoadingPorcionados(false);
    }
  };

  const handleEnviarRomaneioAvulso = async (romaneioId: string) => {
    if (!primaryLoja) return;
    
    try {
      setLoadingPorcionados(true);

      const { data: itens, error: itensError } = await supabase
        .from('romaneios_avulsos_itens')
        .select('item_porcionado_id, quantidade, item_nome')
        .eq('romaneio_avulso_id', romaneioId);

      if (itensError) throw itensError;

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
        .select('id, item_porcionado_id, quantidade, item_nome')
        .eq('romaneio_avulso_id', romaneioId);

      if (itensError) throw itensError;

      for (const item of itens || []) {
        const recebimento = recebimentos[item.id];
        const qtdRecebida = recebimento?.quantidade_recebida ?? item.quantidade;

        await supabase.from('romaneios_avulsos_itens').update({
          quantidade_recebida: qtdRecebida,
          peso_recebido_kg: recebimento?.peso_recebido_kg || null
        }).eq('id', item.id);

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

  // ==================== HANDLERS: PRODUTOS ====================

  const produtosParaRomaneio = useMemo(() => {
    const diaSemana = getDiaSemana();
    
    return produtos.filter(p => {
      const estoque = estoquesProdutos.find(e => e.produto_id === p.id);
      const quantidade = estoque?.quantidade || 0;
      if (quantidade <= 0) return false;
      const matchSearch = searchProduto === "" ||
        p.nome.toLowerCase().includes(searchProduto.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(searchProduto.toLowerCase());
      return matchSearch;
    }).map(p => {
      const estoque = estoquesProdutos.find(e => e.produto_id === p.id);
      const minimo = estoqueMinimoSemanal.find(m => m.produto_id === p.id);
      const estoqueLoja = estoqueLojaAtual.find(e => e.produto_id === p.id);
      
      const estoqueMinimoDia = minimo?.[diaSemana] || 0;
      const estoqueAtualLojaRaw = estoqueLoja?.quantidade || 0;
      
      let quantidadeNecessaria: number;
      let estoqueEmUnidades: number | null = null;
      
      // Lógica de conversão peso → unidades
      if (p.modo_envio === 'unidade' && p.peso_por_unidade_kg && p.peso_por_unidade_kg > 0) {
        // Converter peso em kg para unidades
        estoqueEmUnidades = estoqueAtualLojaRaw / p.peso_por_unidade_kg;
        // Calcular faltante e arredondar para cima (Math.ceil)
        const faltante = estoqueMinimoDia - estoqueEmUnidades;
        quantidadeNecessaria = Math.max(0, Math.ceil(faltante));
      } else {
        // Produtos por peso: cálculo normal sem arredondamento
        quantidadeNecessaria = Math.max(0, estoqueMinimoDia - estoqueAtualLojaRaw);
      }
      
      return {
        ...p,
        quantidade: estoque?.quantidade || 0,
        quantidadeNecessaria,
        estoqueMinimoDia,
        estoqueAtualLoja: estoqueAtualLojaRaw,
        estoqueEmUnidades,
      };
    });
  }, [produtos, estoquesProdutos, searchProduto, estoqueMinimoSemanal, estoqueLojaAtual]);

  const handleAdicionarAoCarrinhoProduto = (produto: ProdutoEstoque, qtd: number) => {
    if (qtd <= 0 || qtd > produto.quantidade) return;
    
    setCarrinhoProduto(prev => {
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

  const handleRemoverDoCarrinhoProduto = (produtoId: string) => {
    setCarrinhoProduto(prev => prev.filter(p => p.produto_id !== produtoId));
  };

  const handleCriarRomaneioProduto = async () => {
    if (!organizationId || !profile || !lojaSelecionadaProduto || carrinhoProduto.length === 0) {
      toast.error('Selecione uma loja e adicione produtos ao carrinho');
      return;
    }

    setSavingProduto(true);
    try {
      const loja = lojas.find(l => l.id === lojaSelecionadaProduto);
      
      for (const item of carrinhoProduto) {
        const estoque = estoquesProdutos.find(e => e.produto_id === item.produto_id);
        if (!estoque || estoque.quantidade < item.quantidade) {
          toast.error(`Produto "${item.produto_nome}" não tem estoque suficiente`);
          setSavingProduto(false);
          return;
        }
      }

      const { data: romaneioData, error: romaneioError } = await supabase
        .from("romaneios_produtos")
        .insert({
          loja_id: lojaSelecionadaProduto,
          loja_nome: loja?.nome || "Loja",
          usuario_id: profile.id,
          usuario_nome: profile.nome,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (romaneioError) throw romaneioError;

      const itensParaInserir = carrinhoProduto.map(item => ({
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

      toast.success(`Romaneio para ${loja?.nome} criado com ${carrinhoProduto.length} produtos`);

      setCarrinhoProduto([]);
      setLojaSelecionadaProduto("");
      setSearchProduto("");
      fetchRomaneiosProdutos();
      fetchEstoquesProdutos(); // Atualizar estoque disponível após criar romaneio
    } catch (error: any) {
      console.error("Erro ao criar romaneio:", error);
      toast.error(error.message || 'Erro ao criar romaneio');
    } finally {
      setSavingProduto(false);
    }
  };

  const handleEnviarRomaneioProduto = async (romaneioId: string) => {
    if (!organizationId || !profile) return;
    setEnviandoProduto(true);

    try {
      const itens = itensRomaneiosProdutos[romaneioId] || [];
      
      for (const item of itens) {
        const estoque = estoquesProdutos.find(e => e.produto_id === item.produto_id);
        if (!estoque || estoque.quantidade < item.quantidade) {
          toast.error(`Produto "${item.produto_nome}" não tem estoque suficiente. Disponível: ${estoque?.quantidade || 0}, Necessário: ${item.quantidade}`);
          setEnviandoProduto(false);
          return;
        }
      }

      for (const item of itens) {
        const estoque = estoquesProdutos.find(e => e.produto_id === item.produto_id);
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

      await supabase
        .from("romaneios_produtos")
        .update({
          status: "enviado",
          data_envio: new Date().toISOString(),
        })
        .eq("id", romaneioId);

      toast.success("Romaneio enviado! Estoque debitado.");

      fetchEstoquesProdutos();
      fetchRomaneiosProdutos();
    } catch (error: any) {
      console.error("Erro ao enviar romaneio:", error);
      toast.error(error.message || 'Erro ao enviar');
    } finally {
      setEnviandoProduto(false);
    }
  };

  const handleExcluirRomaneioProduto = async (romaneioId: string) => {
    if (!confirm("Excluir este romaneio pendente?")) return;

    try {
      await supabase
        .from("romaneios_produtos")
        .delete()
        .eq("id", romaneioId);

      toast.success("Romaneio excluído");
      fetchRomaneiosProdutos();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir');
    }
  };

  const handleConfirmarRecebimentoProduto = async (romaneioId: string) => {
    if (!organizationId) return;
    
    try {
      setLoadingProdutos(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      const romaneio = romaneiosProdutosEnviados.find(r => r.id === romaneioId);
      if (!romaneio) throw new Error('Romaneio não encontrado');

      const itens = itensRomaneiosProdutos[romaneioId] || [];
      
      // Atualizar cada item com quantidade recebida e verificar divergências
      for (const item of itens) {
        const recebimento = recebimentosProduto[item.id];
        const qtdRecebida = recebimento?.quantidade_recebida ?? item.quantidade;
        const divergencia = qtdRecebida !== item.quantidade;
        
        await supabase
          .from('romaneios_produtos_itens')
          .update({
            quantidade_recebida: qtdRecebida,
            divergencia,
            observacao_divergencia: divergencia ? (recebimento?.observacao_divergencia || null) : null
          })
          .eq('id', item.id);

        // Atualizar estoque da loja
        const { data: estoqueAtual } = await supabase
          .from('estoque_loja_produtos')
          .select('id, quantidade')
          .eq('produto_id', item.produto_id)
          .eq('loja_id', romaneio.loja_id)
          .single();

        if (estoqueAtual) {
          await supabase
            .from('estoque_loja_produtos')
            .update({
              quantidade: (estoqueAtual.quantidade || 0) + qtdRecebida,
              data_ultima_atualizacao: new Date().toISOString(),
              data_confirmacao_recebimento: new Date().toISOString()
            })
            .eq('id', estoqueAtual.id);
        } else {
          await supabase
            .from('estoque_loja_produtos')
            .insert({
              produto_id: item.produto_id,
              loja_id: romaneio.loja_id,
              quantidade: qtdRecebida,
              data_ultima_atualizacao: new Date().toISOString(),
              data_confirmacao_recebimento: new Date().toISOString(),
              organization_id: organizationId
            });
        }
      }

      // Atualizar status do romaneio para recebido
      await supabase
        .from('romaneios_produtos')
        .update({
          status: 'recebido',
          data_recebimento: new Date().toISOString(),
          recebido_por_id: user.id,
          recebido_por_nome: userProfile?.nome || 'Usuário',
          observacao_recebimento: observacaoRecebimento[romaneioId] || null
        })
        .eq('id', romaneioId);

      toast.success('Recebimento de produtos confirmado!');
      fetchRomaneiosProdutosEnviados();
      fetchRomaneiosProdutos();
    } catch (error: any) {
      console.error('Erro ao confirmar recebimento:', error);
      toast.error(error.message || 'Erro ao confirmar recebimento');
    } finally {
      setLoadingProdutos(false);
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

  // ==================== RENDER ====================

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Romaneio</h1>
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

              {/* TAB: GERAR */}
              {!isLojaOnly && (
                <TabsContent value="gerar" className="space-y-4">
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
                      <Plus className="w-4 h-4 mr-1" />
                      Criar Romaneio
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

              {/* TAB: ENVIAR */}
              {!isLojaOnly && (
                <TabsContent value="enviar" className="space-y-4">
                  {romaneiosPendentes.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <Send className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Nenhum romaneio pendente de envio</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {romaneiosPendentes.map(romaneio => (
                        <div key={romaneio.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
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
                              <Button size="sm" onClick={() => handleEnviarRomaneio(romaneio.id)} disabled={loadingPorcionados}>
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
                        </div>
                      ))}
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

              {/* TAB: AVULSO */}
              <TabsContent value="avulso" className="space-y-4">
                {!primaryLoja ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Você precisa estar vinculado a uma loja para usar o romaneio avulso</p>
                  </div>
                ) : (
                  <>
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
                        disabled={!lojaDestinoAvulso || itensSelecionadosAvulso.length === 0 || loadingPorcionados}
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

                    {romaneiosAvulsosPendentes.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium mb-2">Pendentes de Envio</h4>
                        <div className="space-y-3">
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
                                  <Button size="sm" onClick={() => handleEnviarRomaneioAvulso(romaneio.id)} disabled={loadingPorcionados}>
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
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ==================== SEÇÃO: ROMANEIO DE PRODUTOS ==================== */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store className="h-5 w-5" />
              Romaneio de Produtos
            </CardTitle>
            <CardDescription>
              {canManageProduction ? 'Envio de produtos do estoque CPD para as lojas' : 'Recebimento de produtos enviados pelo CPD'}
            </CardDescription>
          </CardHeader>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="h-5 w-5" />
                Romaneio de Produtos
              </CardTitle>
              <CardDescription>Envio de produtos do estoque CPD para as lojas</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={isLojaOnly ? 'receber-produtos' : 'criar'} className="space-y-4">
                <TabsList className={`grid w-full ${isLojaOnly ? 'grid-cols-1' : 'grid-cols-3'}`}>
                  {!isLojaOnly && <TabsTrigger value="criar">Criar / Enviar</TabsTrigger>}
                  {!isLojaOnly && (
                    <TabsTrigger value="pendentes">
                      Pendentes
                      {romaneiosProdutosPendentes.filter(r => r.status === "pendente").length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                          {romaneiosProdutosPendentes.filter(r => r.status === "pendente").length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="receber-produtos">
                    Receber
                    {romaneiosProdutosEnviados.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                        {romaneiosProdutosEnviados.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* TAB: CRIAR */}
                <TabsContent value="criar" className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <Select value={lojaSelecionadaProduto} onValueChange={setLojaSelecionadaProduto}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a loja destino" />
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
                    <Button 
                      onClick={handleCriarRomaneioProduto} 
                      disabled={savingProduto || !lojaSelecionadaProduto || carrinhoProduto.length === 0}
                    >
                      {savingProduto ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-1" />
                      )}
                      Criar Romaneio
                    </Button>
                  </div>

                  {lojaSelecionadaProduto && (
                    <div className="grid lg:grid-cols-2 gap-4">
                      {/* Produtos Disponíveis */}
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Produtos Disponíveis</CardTitle>
                          <div className="relative mt-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Buscar produto..."
                              value={searchProduto}
                              onChange={(e) => setSearchProduto(e.target.value)}
                              className="pl-9 h-8"
                            />
                          </div>
                        </CardHeader>
                        <CardContent className="max-h-64 overflow-y-auto p-0">
                          {produtosParaRomaneio.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto com estoque</p>
                          ) : (
                            produtosParaRomaneio.slice(0, 20).map((produto) => (
                              <ProdutoRomaneioItem
                                key={produto.id}
                                produto={produto}
                                onAdicionar={handleAdicionarAoCarrinhoProduto}
                              />
                            ))
                          )}
                        </CardContent>
                      </Card>

                      {/* Carrinho */}
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4" />
                            Carrinho ({carrinhoProduto.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-64 overflow-y-auto p-0">
                          {carrinhoProduto.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Adicione produtos ao carrinho</p>
                          ) : (
                            carrinhoProduto.map((item) => (
                              <div key={item.produto_id} className="p-3 flex items-center justify-between gap-2 border-b last:border-0">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{item.produto_nome}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.quantidade} {item.unidade || "un"}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoverDoCarrinhoProduto(item.produto_id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* TAB: PENDENTES */}
                {!isLojaOnly && (
                  <TabsContent value="pendentes" className="space-y-4">
                    {loadingProdutos ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : romaneiosProdutosPendentes.filter(r => r.status === "pendente").length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
                        <p>Nenhum romaneio pendente de envio</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {romaneiosProdutosPendentes
                          .filter(r => r.status === "pendente")
                          .map((romaneio) => {
                            const itens = itensRomaneiosProdutos[romaneio.id] || [];
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
                                    onClick={() => handleExcluirRomaneioProduto(romaneio.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Excluir
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleEnviarRomaneioProduto(romaneio.id)}
                                    disabled={enviandoProduto}
                                  >
                                    {enviandoProduto ? (
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
                  </TabsContent>
                )}

                {/* TAB: RECEBER PRODUTOS */}
                <TabsContent value="receber-produtos" className="space-y-4">
                  {romaneiosProdutosEnviados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mb-4 opacity-50" />
                      <p>Nenhum romaneio de produtos para receber</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {romaneiosProdutosEnviados.map((romaneio) => {
                        const itens = itensRomaneiosProdutos[romaneio.id] || [];
                        return (
                          <Card key={romaneio.id}>
                            <CardHeader className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <Store className="h-4 w-4" />
                                    {romaneio.loja_nome}
                                  </CardTitle>
                                  <p className="text-xs text-muted-foreground">
                                    Enviado por: {romaneio.usuario_nome} • {romaneio.data_envio && format(new Date(romaneio.data_envio), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-blue-600">
                                  <Send className="w-3 h-3 mr-1" />
                                  Enviado
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {itens.map((item) => {
                                const recebimento = recebimentosProduto[item.id];
                                const qtdRecebida = recebimento?.quantidade_recebida ?? item.quantidade;
                                const divergencia = qtdRecebida !== item.quantidade;
                                
                                return (
                                  <div key={item.id} className="p-3 border rounded space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-medium text-sm">{item.produto_nome}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Enviado: {item.quantidade} {item.unidade || "un"}
                                        </p>
                                      </div>
                                      {divergencia ? (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                          ⚠️ Divergência
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-green-600 border-green-300">
                                          ✓ OK
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Recebido:</span>
                                      <Input
                                        type="number"
                                        min={0}
                                        step={0.1}
                                        value={qtdRecebida}
                                        onChange={(e) => setRecebimentosProduto(prev => ({
                                          ...prev,
                                          [item.id]: {
                                            ...prev[item.id],
                                            quantidade_recebida: parseFloat(e.target.value) || 0
                                          }
                                        }))}
                                        className="w-24 h-8"
                                      />
                                      <span className="text-xs text-muted-foreground">{item.unidade || "un"}</span>
                                    </div>
                                    {divergencia && (
                                      <Input
                                        placeholder="Motivo da divergência..."
                                        value={recebimento?.observacao_divergencia || ''}
                                        onChange={(e) => setRecebimentosProduto(prev => ({
                                          ...prev,
                                          [item.id]: {
                                            ...prev[item.id],
                                            observacao_divergencia: e.target.value
                                          }
                                        }))}
                                        className="h-8 text-sm"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                              <Textarea
                                placeholder="Observação geral (opcional)"
                                value={observacaoRecebimento[romaneio.id] || ''}
                                onChange={(e) => setObservacaoRecebimento(prev => ({ ...prev, [romaneio.id]: e.target.value }))}
                                className="h-16"
                              />
                              <Button 
                                onClick={() => handleConfirmarRecebimentoProduto(romaneio.id)} 
                                disabled={loadingProdutos}
                                className="w-full"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Confirmar Recebimento
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
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
