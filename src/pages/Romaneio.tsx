import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Plus, Trash2, Send, CheckCircle, Clock, History, Package, ArrowRightLeft, Store, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
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
import { WeightInput } from '@/components/ui/weight-input';
import { VolumeInput } from '@/components/ui/volume-input';

// ==================== INTERFACES ====================

interface Loja {
  id: string;
  nome: string;
  responsavel?: string;
  tipo?: string;
}

interface ItemDemandaLoja {
  item_id: string;
  item_nome: string;
  quantidade_demanda: number;
  quantidade_estoque_cpd: number;
  quantidade_disponivel: number;
  quantidade_ja_enviada: number;
}

interface ItemSelecionadoLoja {
  item_id: string;
  item_nome: string;
  quantidade: number;
}

interface DemandaPorLoja {
  loja_id: string;
  loja_nome: string;
  itens: ItemDemandaLoja[];
  itensSelecionados: ItemSelecionadoLoja[];
  enviando: boolean;
  pesoTotalEnvio: string;
  quantidadeVolumes: string;
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


// ==================== COMPONENTE: SEÇÃO POR LOJA ====================

interface SecaoLojaRomaneioProps {
  demanda: DemandaPorLoja;
  onEnviar: (lojaId: string, itens: ItemSelecionadoLoja[], pesoTotal: string, volumes: string) => Promise<void>;
  onUpdateQuantidade: (lojaId: string, itemId: string, quantidade: number) => void;
  onRemoveItem: (lojaId: string, itemId: string) => void;
  onAddItem: (lojaId: string, item: ItemDemandaLoja) => void;
  onUpdatePesoTotal: (lojaId: string, valor: string) => void;
  onUpdateVolumes: (lojaId: string, valor: string) => void;
}

const SecaoLojaRomaneio = ({ demanda, onEnviar, onUpdateQuantidade, onRemoveItem, onAddItem, onUpdatePesoTotal, onUpdateVolumes }: SecaoLojaRomaneioProps) => {
  const itensNaoSelecionados = demanda.itens.filter(
    item => !demanda.itensSelecionados.find(sel => sel.item_id === item.item_id)
  );

  const handleEnviar = () => {
    if (demanda.itensSelecionados.length === 0) {
      toast.error('Nenhum item para enviar');
      return;
    }
    onEnviar(demanda.loja_id, demanda.itensSelecionados, demanda.pesoTotalEnvio, demanda.quantidadeVolumes);
  };

  const totalItens = demanda.itensSelecionados.reduce((acc, item) => acc + item.quantidade, 0);

  // Não renderizar se não há itens disponíveis nem selecionados
  if (demanda.itens.length === 0 && demanda.itensSelecionados.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="w-4 h-4 text-primary" />
            {demanda.loja_nome}
          </CardTitle>
          <div className="flex items-center gap-2">
            {demanda.itensSelecionados.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {demanda.itensSelecionados.length} itens • {totalItens} un
              </Badge>
            )}
            <Button 
              size="sm" 
              onClick={handleEnviar} 
              disabled={demanda.itensSelecionados.length === 0 || demanda.enviando}
              className="gap-1"
            >
              {demanda.enviando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar Romaneio
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid md:grid-cols-2 gap-4">
          {/* Itens Disponíveis (para adicionar) */}
          <div className="border rounded-lg p-3 bg-muted/30">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Package className="w-3 h-3" />
              Itens Disponíveis
            </h4>
            {itensNaoSelecionados.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                Todos os itens já foram adicionados
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {itensNaoSelecionados.map(item => (
                  <div key={item.item_id} className="flex items-center justify-between p-2 bg-background border rounded text-sm hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.item_nome}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span className="text-primary font-medium">Disponível: {item.quantidade_disponivel} un</span>
                        {item.quantidade_ja_enviada > 0 && (
                          <span className="text-orange-600">• Já enviado: {item.quantidade_ja_enviada}</span>
                        )}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0"
                      onClick={() => onAddItem(demanda.loja_id, item)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Itens Selecionados (prontos para envio) */}
          <div className="border rounded-lg p-3 border-primary/30 bg-primary/5">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-primary" />
              Pronto para Envio ({demanda.itensSelecionados.length})
            </h4>
            {demanda.itensSelecionados.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                Adicione itens da lista ao lado
              </p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {demanda.itensSelecionados.map(item => (
                    <div key={item.item_id} className="flex items-center gap-2 p-2 bg-background border rounded text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.item_nome}</p>
                      </div>
                      <Input
                        type="number"
                        value={item.quantidade || ''}
                        onChange={(e) => onUpdateQuantidade(demanda.loja_id, item.item_id, parseInt(e.target.value) || 0)}
                        className="w-16 h-7 text-center text-sm"
                        min={1}
                      />
                      <span className="text-xs text-muted-foreground">un</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0"
                        onClick={() => onRemoveItem(demanda.loja_id, item.item_id)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                {/* Campos de Peso Total e Quantidade de Volumes */}
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t">
                  <WeightInput
                    value={demanda.pesoTotalEnvio}
                    onChange={(v) => onUpdatePesoTotal(demanda.loja_id, v)}
                    label="Peso Total"
                    compact
                    showLabel
                    placeholder="Ex: 5500"
                  />
                  <VolumeInput
                    value={demanda.quantidadeVolumes}
                    onChange={(v) => onUpdateVolumes(demanda.loja_id, v)}
                    label="Qtd. Volumes"
                    compact
                    showLabel
                    placeholder="Ex: 3"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


// ==================== COMPONENTE PRINCIPAL ====================

const Romaneio = () => {
  const { user, profile, isAdmin, hasRole } = useAuth();
  const { organizationId } = useOrganization();
  const { primaryLoja, userLojas } = useUserLoja();
  const { cpdLojaId } = useCPDLoja();

  const isLojaOnly = hasRole('Loja') && !isAdmin() && !hasRole('Produção');
  const canManageProduction = isAdmin() || hasRole('Produção');

  // ==================== ESTADOS ====================
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [todasLojas, setTodasLojas] = useState<Loja[]>([]);
  const [demandasPorLoja, setDemandasPorLoja] = useState<DemandaPorLoja[]>([]);
  const [loadingDemandas, setLoadingDemandas] = useState(false);
  
  const [romaneiosEnviados, setRomaneiosEnviados] = useState<Romaneio[]>([]);
  const [romaneiosHistorico, setRomaneiosHistorico] = useState<Romaneio[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [userLojasIds, setUserLojasIds] = useState<string[]>([]);
  
  // Romaneio Avulso
  const [lojaOrigemAvulso, setLojaOrigemAvulso] = useState<string>('');
  const [lojaDestinoAvulso, setLojaDestinoAvulso] = useState<string>('');
  const [itensAvulsoLivre, setItensAvulsoLivre] = useState<{ id: string; descricao: string; quantidade: number }[]>([]);
  const [novoItemDescricao, setNovoItemDescricao] = useState('');
  const [novoItemQuantidade, setNovoItemQuantidade] = useState<number>(1);
  const [observacaoAvulso, setObservacaoAvulso] = useState('');
  const [romaneiosAvulsosPendentes, setRomaneiosAvulsosPendentes] = useState<RomaneioAvulso[]>([]);
  const [romaneiosAvulsosReceber, setRomaneiosAvulsosReceber] = useState<RomaneioAvulso[]>([]);
  const [loadingAvulso, setLoadingAvulso] = useState(false);
  
  const [recebimentos, setRecebimentos] = useState<{
    [itemId: string]: { quantidade_recebida: number; peso_recebido_kg: number }
  }>({});
  const [observacaoRecebimento, setObservacaoRecebimento] = useState<{ [romaneioId: string]: string }>({});
  const [loadingRecebimento, setLoadingRecebimento] = useState(false);

  // ==================== EFFECTS ====================

  useEffect(() => {
    fetchLojas();
    fetchTodasLojas();
    fetchUserLojas();
  }, []);

  // Buscar demandas quando lojas e CPD estiverem disponíveis
  useEffect(() => {
    if (lojas.length > 0 && cpdLojaId && canManageProduction) {
      fetchDemandasTodasLojas();
    }
  }, [lojas, cpdLojaId, canManageProduction]);

  // Realtime listener para produções finalizadas, romaneios e estoque
  useEffect(() => {
    if (!cpdLojaId || !canManageProduction) return;
    
    const channel = supabase
      .channel('romaneio-producao-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'producao_registros'
      }, (payload) => {
        console.log('[Romaneio] Produção atualizada:', payload);
        // Atualizar demandas quando produção é finalizada
        if (payload.new && (payload.new as any).status === 'finalizado') {
          console.log('[Romaneio] Produção finalizada detectada, atualizando demandas...');
          fetchDemandasTodasLojas();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'estoque_loja_itens'
      }, (payload) => {
        console.log('[Romaneio] Estoque CPD atualizado:', payload);
        fetchDemandasTodasLojas();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'romaneios'
      }, (payload) => {
        console.log('[Romaneio] Romaneio atualizado:', payload);
        fetchDemandasTodasLojas();
        fetchRomaneiosEnviados();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'romaneio_itens'
      }, (payload) => {
        console.log('[Romaneio] Romaneio item atualizado:', payload);
        fetchDemandasTodasLojas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cpdLojaId, canManageProduction]);

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
      // Buscar lojas excluindo CPD para envio de romaneio
      const { data, error } = await supabase.from('lojas').select('*').neq('tipo', 'cpd').order('nome');
      if (error) throw error;
      setLojas(data || []);
    } catch (error) {
      toast.error('Erro ao carregar lojas');
    }
  };

  const fetchTodasLojas = async () => {
    try {
      const { data, error } = await supabase.from('lojas').select('*, tipo').order('nome');
      if (error) throw error;
      setTodasLojas(data || []);
    } catch (error) {
      console.error('Erro ao carregar todas as lojas:', error);
    }
  };

  const fetchDemandasTodasLojas = async () => {
    if (!cpdLojaId || lojas.length === 0) return;
    
    setLoadingDemandas(true);
    console.log('[Romaneio] Iniciando fetchDemandasTodasLojas...');
    console.log('[Romaneio] CPD ID:', cpdLojaId);
    console.log('[Romaneio] Lojas disponíveis:', lojas.map(l => ({ id: l.id, nome: l.nome })));
    
    try {
      // 0. Buscar data do servidor (timezone-safe)
      const { data: serverDateResult } = await supabase.rpc('get_current_date');
      const serverDate = serverDateResult || new Date().toISOString().split('T')[0];
      console.log('[Romaneio] Data do servidor:', serverDate);

      // 1. Buscar estoque CPD
      const { data: estoqueCpd, error: estoqueError } = await supabase
        .from('estoque_loja_itens')
        .select(`item_porcionado_id, quantidade, itens_porcionados!inner(nome)`)
        .eq('loja_id', cpdLojaId)
        .gt('quantidade', 0);

      if (estoqueError) throw estoqueError;
      console.log('[Romaneio] Estoque CPD encontrado:', estoqueCpd?.length, 'itens');

      // 2. Buscar APENAS produções finalizadas do dia atual com detalhes_lojas não vazios
      const { data: producoesRaw, error: producoesError } = await supabase
        .from('producao_registros')
        .select('id, item_id, item_nome, detalhes_lojas, data_fim, sequencia_traco')
        .eq('status', 'finalizado')
        .eq('data_referencia', serverDate)
        .not('detalhes_lojas', 'is', null)
        .order('data_fim', { ascending: false });

      if (producoesError) throw producoesError;
      console.log('[Romaneio] Produções brutas encontradas:', producoesRaw?.length);

      // 3. Filtrar produções com detalhes_lojas vazios (traços secundários têm [])
      const producoes = producoesRaw?.filter(prod => {
        const detalhes = prod.detalhes_lojas as Array<any> | null;
        // Excluir se detalhes_lojas é null, não é array, ou está vazio
        return detalhes && Array.isArray(detalhes) && detalhes.length > 0;
      }) || [];
      
      console.log('[Romaneio] Produções após filtro (detalhes_lojas não vazio):', producoes.length);
      producoes.forEach(p => {
        console.log(`[Romaneio] - ${p.item_nome}: detalhes_lojas =`, p.detalhes_lojas);
      });

      // 3. Buscar romaneios pendentes/enviados
      const { data: romaneiosPendentes, error: romaneiosError } = await supabase
        .from('romaneio_itens')
        .select(`item_porcionado_id, quantidade, romaneios!inner(loja_id, status)`)
        .in('romaneios.status', ['pendente', 'enviado']);

      if (romaneiosError) throw romaneiosError;
      console.log('[Romaneio] Romaneios pendentes/enviados:', romaneiosPendentes?.length);

      // 4. Construir mapa de estoque CPD
      const estoqueMap: Record<string, { quantidade: number; nome: string }> = {};
      estoqueCpd?.forEach(est => {
        estoqueMap[est.item_porcionado_id] = {
          quantidade: est.quantidade || 0,
          nome: (est.itens_porcionados as any).nome
        };
      });
      console.log('[Romaneio] Mapa de estoque CPD:', estoqueMap);

      // 5. Calcular demanda por loja baseado em detalhes_lojas (apenas última produção por item)
      const demandaPorLojaItem: Record<string, Record<string, number>> = {};
      const itemsProcessados = new Set<string>();
      
      // Produções já ordenadas por data_fim DESC, então primeira aparição é a mais recente
      producoes?.forEach(prod => {
        // Pular se já processamos este item (usar apenas a última produção)
        if (itemsProcessados.has(prod.item_id)) return;
        itemsProcessados.add(prod.item_id);
        
        const detalhes = prod.detalhes_lojas as Array<{ loja_id: string; loja_nome?: string; quantidade: number }> | null;
        
        // Verificar se detalhes_lojas existe E não está vazio
        if (!detalhes || !Array.isArray(detalhes) || detalhes.length === 0) return;
        
        detalhes.forEach(d => {
          if (d.quantidade > 0 && d.loja_id) {
            if (!demandaPorLojaItem[d.loja_id]) {
              demandaPorLojaItem[d.loja_id] = {};
            }
            demandaPorLojaItem[d.loja_id][prod.item_id] = d.quantidade;
          }
        });
      });
      
      console.log('[Romaneio] Demanda por loja/item:', demandaPorLojaItem);

      // 6. Calcular já enviado por loja e item
      const jaEnviadoPorLojaItem: Record<string, Record<string, number>> = {};
      romaneiosPendentes?.forEach(ri => {
        const lojaId = (ri.romaneios as any).loja_id;
        const itemId = ri.item_porcionado_id;
        if (!jaEnviadoPorLojaItem[lojaId]) {
          jaEnviadoPorLojaItem[lojaId] = {};
        }
        jaEnviadoPorLojaItem[lojaId][itemId] = (jaEnviadoPorLojaItem[lojaId][itemId] || 0) + ri.quantidade;
      });
      console.log('[Romaneio] Já enviado por loja/item:', jaEnviadoPorLojaItem);

      // 7. Construir demandas para cada loja
      const demandasProcessadas: DemandaPorLoja[] = lojas.map(loja => {
        const demandaItens = demandaPorLojaItem[loja.id] || {};
        const jaEnviado = jaEnviadoPorLojaItem[loja.id] || {};
        
        const itens: ItemDemandaLoja[] = [];
        const itensSelecionados: ItemSelecionadoLoja[] = [];
        
        Object.entries(demandaItens).forEach(([itemId, quantidade]) => {
          const estoque = estoqueMap[itemId];
          if (!estoque) {
            console.log(`[Romaneio] Item ${itemId} não encontrado no estoque CPD`);
            return;
          }
          
          const qtdJaEnviada = jaEnviado[itemId] || 0;
          const demandaPendente = Math.max(0, quantidade - qtdJaEnviada);
          const disponivel = Math.min(demandaPendente, estoque.quantidade);
          
          console.log(`[Romaneio] ${loja.nome} - ${estoque.nome}: demanda=${quantidade}, jaEnviado=${qtdJaEnviada}, pendente=${demandaPendente}, disponivel=${disponivel}`);
          
          if (disponivel > 0) {
            const itemDemanda: ItemDemandaLoja = {
              item_id: itemId,
              item_nome: estoque.nome,
              quantidade_demanda: quantidade,
              quantidade_estoque_cpd: estoque.quantidade,
              quantidade_disponivel: disponivel,
              quantidade_ja_enviada: qtdJaEnviada
            };
            itens.push(itemDemanda);
            
            // Pré-selecionar automaticamente todos os itens disponíveis
            itensSelecionados.push({
              item_id: itemId,
              item_nome: estoque.nome,
              quantidade: disponivel
            });
          }
        });
        
        // Ordenar por nome
        itens.sort((a, b) => a.item_nome.localeCompare(b.item_nome));
        itensSelecionados.sort((a, b) => a.item_nome.localeCompare(b.item_nome));
        
        return {
          loja_id: loja.id,
          loja_nome: loja.nome,
          itens,
          itensSelecionados,
          enviando: false,
          pesoTotalEnvio: '',
          quantidadeVolumes: ''
        };
      });

      // Filtrar apenas lojas que têm demanda real (itens ou itensSelecionados)
      const lojasComDemanda = demandasProcessadas.filter(d => 
        d.itens.length > 0 || d.itensSelecionados.length > 0
      );
      
      // Log das lojas SEM demanda para debug
      const lojasSemDemanda = lojas.filter(l => !lojasComDemanda.find(d => d.loja_id === l.id));
      console.log('[Romaneio] Lojas COM demanda:', lojasComDemanda.map(d => d.loja_nome));
      console.log('[Romaneio] Lojas SEM demanda:', lojasSemDemanda.map(l => l.nome));
      
      setDemandasPorLoja(lojasComDemanda);
    } catch (error) {
      console.error('[Romaneio] Erro ao buscar demandas:', error);
      toast.error('Erro ao carregar demandas das lojas');
    } finally {
      setLoadingDemandas(false);
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

  const fetchRomaneiosAvulsos = async () => {
    try {
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

  // ==================== HANDLERS: ENVIAR POR LOJA ====================

  const handleEnviarRomaneioLoja = async (lojaId: string, itens: ItemSelecionadoLoja[], pesoTotal: string, volumes: string) => {
    if (itens.length === 0) {
      toast.error('Nenhum item selecionado');
      return;
    }
    console.log(`[Romaneio] Enviando para loja ${lojaId} - Peso Total: ${pesoTotal}, Volumes: ${volumes}`);

    // Marcar loja como enviando
    setDemandasPorLoja(prev => prev.map(d => 
      d.loja_id === lojaId ? { ...d, enviando: true } : d
    ));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Validar estoque antes de enviar
      for (const item of itens) {
        const { data: estoque } = await supabase
          .from('estoque_loja_itens')
          .select('quantidade')
          .eq('loja_id', cpdLojaId)
          .eq('item_porcionado_id', item.item_id)
          .maybeSingle();
        
        const estoqueAtual = estoque?.quantidade || 0;
        if (estoqueAtual < item.quantidade) {
          toast.error(`Estoque insuficiente: ${item.item_nome}. Disponível: ${estoqueAtual}, Solicitado: ${item.quantidade}`);
          setDemandasPorLoja(prev => prev.map(d => 
            d.loja_id === lojaId ? { ...d, enviando: false } : d
          ));
          return;
        }
      }

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      const loja = lojas.find(l => l.id === lojaId);
      const agora = new Date().toISOString();

      // Criar romaneio como ENVIADO
      const { data: romaneio, error: romaneioError } = await supabase.from('romaneios').insert({
        loja_id: lojaId,
        loja_nome: loja?.nome || '',
        status: 'enviado',
        data_criacao: agora,
        data_envio: agora,
        usuario_id: user.id,
        usuario_nome: userProfile?.nome || 'Usuário',
        organization_id: organizationId
      }).select().single();

      if (romaneioError) throw romaneioError;

      // Inserir itens
      const itensRomaneio = itens.map(item => ({
        romaneio_id: romaneio.id,
        item_porcionado_id: item.item_id,
        item_nome: item.item_nome,
        quantidade: item.quantidade,
        peso_total_kg: 0,
        organization_id: organizationId
      }));

      await supabase.from('romaneio_itens').insert(itensRomaneio);

      // Debitar estoque CPD
      for (const item of itens) {
        await supabase.rpc('decrementar_estoque_cpd', { p_item_id: item.item_id, p_quantidade: item.quantidade });
      }

      toast.success(`Romaneio enviado para ${loja?.nome}!`);
      
      // Atualizar dados
      fetchDemandasTodasLojas();
      fetchRomaneiosEnviados();
      fetchRomaneiosHistorico();
    } catch (error) {
      console.error('Erro ao enviar romaneio:', error);
      toast.error('Erro ao enviar romaneio');
    } finally {
      setDemandasPorLoja(prev => prev.map(d => 
        d.loja_id === lojaId ? { ...d, enviando: false } : d
      ));
    }
  };

  const handleUpdateQuantidadeLoja = (lojaId: string, itemId: string, quantidade: number) => {
    setDemandasPorLoja(prev => prev.map(d => {
      if (d.loja_id !== lojaId) return d;
      return {
        ...d,
        itensSelecionados: d.itensSelecionados.map(item =>
          item.item_id === itemId ? { ...item, quantidade: Math.max(1, quantidade) } : item
        )
      };
    }));
  };

  const handleUpdatePesoTotalLoja = (lojaId: string, valor: string) => {
    setDemandasPorLoja(prev => prev.map(d => 
      d.loja_id === lojaId ? { ...d, pesoTotalEnvio: valor } : d
    ));
  };

  const handleUpdateVolumesLoja = (lojaId: string, valor: string) => {
    setDemandasPorLoja(prev => prev.map(d => 
      d.loja_id === lojaId ? { ...d, quantidadeVolumes: valor } : d
    ));
  };

  const handleRemoveItemLoja = (lojaId: string, itemId: string) => {
    setDemandasPorLoja(prev => prev.map(d => {
      if (d.loja_id !== lojaId) return d;
      return {
        ...d,
        itensSelecionados: d.itensSelecionados.filter(item => item.item_id !== itemId)
      };
    }));
  };

  const handleAddItemLoja = (lojaId: string, item: ItemDemandaLoja) => {
    setDemandasPorLoja(prev => prev.map(d => {
      if (d.loja_id !== lojaId) return d;
      const jaExiste = d.itensSelecionados.find(sel => sel.item_id === item.item_id);
      if (jaExiste) return d;
      return {
        ...d,
        itensSelecionados: [...d.itensSelecionados, {
          item_id: item.item_id,
          item_nome: item.item_nome,
          quantidade: item.quantidade_disponivel
        }]
      };
    }));
  };

  // ==================== HANDLERS: RECEBIMENTO ====================

  const handleConfirmarRecebimento = async (romaneioId: string) => {
    try {
      setLoadingRecebimento(true);
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
      setLoadingRecebimento(false);
    }
  };

  // ==================== HANDLERS: ROMANEIO AVULSO ====================

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
      setLoadingAvulso(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();
      const lojaDestino = todasLojas.find(l => l.id === lojaDestinoAvulso);
      const agora = new Date().toISOString();

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

      const itens = itensAvulsoLivre.map(item => ({
        romaneio_avulso_id: romaneio.id,
        item_porcionado_id: null,
        item_nome: item.descricao,
        quantidade: item.quantidade,
        peso_kg: null,
        organization_id: organizationId
      }));

      await supabase.from('romaneios_avulsos_itens').insert(itens);

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
      setLoadingAvulso(false);
    }
  };

  const handleReceberRomaneioAvulso = async (romaneioId: string) => {
    if (!primaryLoja) return;
    
    try {
      setLoadingRecebimento(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();

      const { data: itens, error: itensError } = await supabase
        .from('romaneios_avulsos_itens')
        .select('id, quantidade')
        .eq('romaneio_avulso_id', romaneioId);

      if (itensError) throw itensError;

      for (const item of itens || []) {
        const recebimento = recebimentos[item.id];
        const qtdRecebida = recebimento?.quantidade_recebida ?? item.quantidade;

        await supabase.from('romaneios_avulsos_itens').update({
          quantidade_recebida: qtdRecebida,
          peso_recebido_kg: recebimento?.peso_recebido_kg || null
        }).eq('id', item.id);
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
    } catch (error) {
      console.error('Erro ao receber romaneio avulso:', error);
      toast.error('Erro ao receber romaneio avulso');
    } finally {
      setLoadingRecebimento(false);
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

  const handleRefresh = async () => {
    setLoadingDemandas(true);
    try {
      await Promise.all([
        fetchDemandasTodasLojas(),
        fetchRomaneiosEnviados(),
        fetchRomaneiosHistorico(),
        fetchRomaneiosAvulsos()
      ]);
      toast.success('Dados atualizados!');
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar dados');
    } finally {
      setLoadingDemandas(false);
    }
  };

  // Contagem de lojas com itens
  const lojasComItens = useMemo(() => 
    demandasPorLoja.filter(d => d.itens.length > 0 || d.itensSelecionados.length > 0),
    [demandasPorLoja]
  );

  // ==================== RENDER ====================

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Romaneio</h1>
          </div>
          <Button 
            size="sm" 
            onClick={handleRefresh} 
            disabled={loadingDemandas}
            className="!bg-green-600 hover:!bg-green-700 text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingDemandas ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* SEÇÃO: ROMANEIO DE PORCIONADOS */}
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
                  Avulso
                </TabsTrigger>
              </TabsList>

              {/* TAB: ENVIAR - SEÇÕES INDEPENDENTES POR LOJA */}
              {!isLojaOnly && (
                <TabsContent value="enviar" className="space-y-4">
                  {/* Botão de Atualizar */}
                  <div className="flex justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fetchDemandasTodasLojas()}
                      disabled={loadingDemandas}
                      className="gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingDemandas ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                  
                  {loadingDemandas ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Carregando demandas...</span>
                    </div>
                  ) : lojasComItens.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-lg font-medium">Nenhum item disponível para envio</p>
                      <p className="text-sm mt-1">
                        Itens aparecerão automaticamente quando a produção for finalizada
                      </p>
                      
                      {/* Indicador de lojas sem demanda */}
                      {lojas.length > 0 && (
                        <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-dashed max-w-md mx-auto">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Lojas cadastradas ({lojas.length}):
                          </p>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {lojas.map(loja => (
                              <Badge key={loja.id} variant="outline" className="text-xs">
                                {loja.nome}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Nenhuma demanda pendente para estas lojas
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="w-4 h-4" />
                        <span>
                          {lojasComItens.length} {lojasComItens.length === 1 ? 'loja' : 'lojas'} com itens pendentes
                        </span>
                      </div>
                      
                      {lojasComItens.map(demanda => (
                        <SecaoLojaRomaneio
                          key={demanda.loja_id}
                          demanda={demanda}
                          onEnviar={handleEnviarRomaneioLoja}
                          onUpdateQuantidade={handleUpdateQuantidadeLoja}
                          onRemoveItem={handleRemoveItemLoja}
                          onAddItem={handleAddItemLoja}
                          onUpdatePesoTotal={handleUpdatePesoTotalLoja}
                          onUpdateVolumes={handleUpdateVolumesLoja}
                        />
                      ))}
                      
                      {/* Indicador de lojas sem demanda quando há algumas com demanda */}
                      {lojas.length > lojasComItens.length && (
                        <div className="p-3 bg-muted/30 rounded-lg border border-dashed">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Lojas sem demanda pendente ({lojas.length - lojasComItens.length}):
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {lojas
                              .filter(loja => !lojasComItens.find(d => d.loja_id === loja.id))
                              .map(loja => (
                                <Badge key={loja.id} variant="outline" className="text-xs opacity-60">
                                  {loja.nome}
                                </Badge>
                              ))
                            }
                          </div>
                        </div>
                      )}
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
                              <Button onClick={() => handleConfirmarRecebimento(romaneio.id)} disabled={loadingRecebimento} className="w-full">
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
                        <h3 className="text-sm font-medium text-muted-foreground">Romaneios Avulsos</h3>
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
                              <Button onClick={() => handleReceberRomaneioAvulso(romaneio.id)} disabled={loadingRecebimento} className="w-full">
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

              {/* TAB: ROMANEIO AVULSO */}
              <TabsContent value="avulso" className="space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  {(primaryLoja || lojaOrigemAvulso) && lojaDestinoAvulso && (
                    <Badge variant="secondary" className="w-fit py-2">
                      <ArrowRightLeft className="w-3 h-3 mr-2" />
                      {primaryLoja?.loja_nome || todasLojas.find(l => l.id === lojaOrigemAvulso)?.nome} → {todasLojas.find(l => l.id === lojaDestinoAvulso)?.nome}
                    </Badge>
                  )}
                </div>

                {((primaryLoja || lojaOrigemAvulso) && lojaDestinoAvulso) && (
                  <>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Adicionar Item</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1">
                            <Input
                              placeholder="Descrição do item"
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

                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Itens a Transferir ({itensAvulsoLivre.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                        {itensAvulsoLivre.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Adicione itens acima</p>
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

                    <Textarea
                      placeholder="Observação (opcional)"
                      value={observacaoAvulso}
                      onChange={(e) => setObservacaoAvulso(e.target.value)}
                      className="h-20"
                    />

                    <Button 
                      onClick={handleCriarRomaneioAvulso} 
                      disabled={itensAvulsoLivre.length === 0 || loadingAvulso}
                      className="w-full"
                    >
                      {loadingAvulso ? (
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
