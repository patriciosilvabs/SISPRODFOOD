import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Plus, Trash2, Send, CheckCircle, Clock, History, Package, ArrowRightLeft, Store, Loader2, RefreshCw, AlertCircle, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUserLoja } from '@/hooks/useUserLoja';
import { useCPDLoja } from '@/hooks/useCPDLoja';
import { toast } from 'sonner';
import { format, subDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Send as SendIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { WeightInput } from '@/components/ui/weight-input';
import { VolumeInput } from '@/components/ui/volume-input';
import { parsePesoProgressivo, formatPesoParaInput, rawToKg } from '@/lib/weightUtils';
import { pesoProgressivoToWords } from '@/lib/numberToWords';
import { useRomaneioAutomatico } from '@/hooks/useRomaneioAutomatico';

// Formatar código do lote adicionando data legível
// Entrada: "LOTE-20260110-003"
// Saída: "10/01 LOTE-20260110-003"
const formatarCodigoLoteComData = (codigoLote: string): string => {
  const match = codigoLote.match(/LOTE-(\d{4})(\d{2})(\d{2})-/);
  if (match) {
    const [, , mes, dia] = match;
    return `${dia}/${mes} ${codigoLote}`;
  }
  return codigoLote;
};

// ==================== COMPONENTE: INPUT PESO INLINE COMPACTO ====================

interface PesoInputInlineCompactoProps {
  value: string;
  onChange: (value: string) => void;
}

const PesoInputInlineCompacto = ({ value, onChange }: PesoInputInlineCompactoProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    onChange(rawValue);
  };

  const parsed = parsePesoProgressivo(value);
  const hasValue = parsed.valorRaw > 0;
  const displayValue = isFocused ? value : (hasValue ? formatPesoParaInput(value) : '');

  return (
    <div className="flex flex-col items-center">
      <Input
        type="text"
        inputMode="numeric"
        placeholder="Peso"
        value={displayValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-32 h-10 text-center text-base font-medium"
      />
      {hasValue && !isFocused && (
        <span 
          className="text-xs text-primary font-medium truncate max-w-32 leading-tight" 
          title={pesoProgressivoToWords(value)}
        >
          {pesoProgressivoToWords(value)}
        </span>
      )}
    </div>
  );
};

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
  codigo_lote?: string;
  producao_registro_id?: string;
}

interface ItemSelecionadoLoja {
  item_id: string;
  item_nome: string;
  quantidade: number;
  peso_g: string;  // Peso em gramas por item
  volumes: string; // Quantidade de volumes por item
  codigo_lote?: string;
  producao_registro_id?: string;
  salvo: boolean;  // Indica se o item foi confirmado/salvo
}

interface DemandaPorLoja {
  loja_id: string;
  loja_nome: string;
  itens: ItemDemandaLoja[];
  itensSelecionados: ItemSelecionadoLoja[];
  enviando: boolean;
}

interface Romaneio {
  id: string;
  loja_id: string;
  loja_nome: string;
  data_criacao: string;
  data_envio: string | null;
  data_recebimento: string | null;
  data_referencia?: string; // Data da demanda (do producao_registros)
  status: string;
  usuario_nome: string;
  recebido_por_nome: string | null;
  observacao: string | null;
  peso_total_envio_g?: number;
  quantidade_volumes_envio?: number;
  peso_total_recebido_g?: number;
  quantidade_volumes_recebido?: number;
  romaneio_itens: Array<{
    id?: string;
    item_nome: string;
    quantidade: number;
    peso_total_kg: number;
    codigo_lote?: string;
    producao_registro_id?: string;
    data_referencia?: string;
  }>;
}

// Helper para descrição do dia da demanda
const getDescricaoDia = (dataStr: string): string => {
  const data = new Date(dataStr + 'T12:00:00'); // Evitar problemas de timezone
  const hoje = new Date();
  const ontem = subDays(hoje, 1);
  const anteontem = subDays(hoje, 2);
  
  if (isSameDay(data, hoje)) return "hoje";
  if (isSameDay(data, ontem)) return "ontem";
  if (isSameDay(data, anteontem)) return "anteontem";
  return format(data, "EEEE", { locale: ptBR }); // "segunda-feira", etc.
};

// Componente de Tarjas de Data
interface DateTagsProps {
  dataEnvio?: string | null;
  dataReferencia?: string | null;
  lojaNome?: string;
}

const DateTags = ({ dataEnvio, dataReferencia, lojaNome }: DateTagsProps) => {
  return (
    <div className="space-y-2 mb-3">
      {/* Tarja Azul - Data do Envio */}
      {dataEnvio && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-700 rounded-lg">
          <SendIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            ENVIO: Romaneio realizado em {format(new Date(dataEnvio), "dd/MM/yyyy")} às {format(new Date(dataEnvio), "HH:mm")}
          </span>
        </div>
      )}
      
      {/* Tarja Vermelha - Data da Demanda */}
      {dataReferencia && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-700 rounded-lg">
          <CalendarDays className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            DEMANDA: Referente à demanda de {getDescricaoDia(dataReferencia)}, {format(new Date(dataReferencia + 'T12:00:00'), "dd/MM/yyyy")}{lojaNome ? ` - ${lojaNome}` : ''}
          </span>
        </div>
      )}
    </div>
  );
};

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

// Interface para romaneios aguardando conferência (criados automaticamente)
interface RomaneioAguardandoConferencia {
  id: string;
  loja_id: string;
  loja_nome: string;
  data_criacao: string;
  data_referencia?: string;
  usuario_nome: string;
  itens: Array<{
    id: string;
    item_nome: string;
    quantidade: number;
    peso_g: string;
    volumes: string;
    salvo: boolean;
    producao_registro_id?: string;
    data_referencia?: string;
  }>;
}


// ==================== COMPONENTE: SEÇÃO POR LOJA ====================

interface SecaoLojaRomaneioProps {
  demanda: DemandaPorLoja;
  onEnviar: (lojaId: string, itens: ItemSelecionadoLoja[]) => Promise<void>;
  onUpdateQuantidade: (lojaId: string, itemId: string, quantidade: number) => void;
  onUpdatePesoItem: (lojaId: string, itemId: string, peso: string) => void;
  onUpdateVolumesItem: (lojaId: string, itemId: string, volumes: string) => void;
  onRemoveItem: (lojaId: string, itemId: string) => void;
  onAddItem: (lojaId: string, item: ItemDemandaLoja) => void;
  onSalvarItem: (lojaId: string, itemId: string) => void;
}

const SecaoLojaRomaneio = ({ demanda, onEnviar, onUpdateQuantidade, onUpdatePesoItem, onUpdateVolumesItem, onRemoveItem, onAddItem, onSalvarItem }: SecaoLojaRomaneioProps) => {
  const itensNaoSelecionados = demanda.itens.filter(
    item => !demanda.itensSelecionados.find(sel => sel.item_id === item.item_id)
  );

  const handleEnviar = () => {
    if (demanda.itensSelecionados.length === 0) {
      toast.error('Nenhum item para enviar');
      return;
    }
    
    // Validação: todos os itens devem estar salvos
    const itensNaoSalvos = demanda.itensSelecionados.filter(item => !item.salvo);
    if (itensNaoSalvos.length > 0) {
      toast.error(`${itensNaoSalvos.length} item(ns) não foi(ram) salvo(s). Salve todos os itens antes de enviar.`);
      return;
    }
    
    // Validação de peso e volumes por item
    for (const item of demanda.itensSelecionados) {
      if (!item.peso_g || item.peso_g === '0') {
        toast.error(`Informe o peso do item: ${item.item_nome}`);
        return;
      }
      if (!item.volumes || item.volumes === '0') {
        toast.error(`Informe a quantidade de volumes do item: ${item.item_nome}`);
        return;
      }
    }
    
    onEnviar(demanda.loja_id, demanda.itensSelecionados);
  };

  const totalItens = demanda.itensSelecionados.reduce((acc, item) => acc + item.quantidade, 0);
  const pesoTotalCalculado = demanda.itensSelecionados.reduce((acc, item) => acc + parsePesoProgressivo(item.peso_g).valorGramas, 0);
  const volumesTotalCalculado = demanda.itensSelecionados.reduce((acc, item) => acc + (parseInt(item.volumes) || 0), 0);
  
  // Verificar se campos obrigatórios estão preenchidos E todos salvos
  const todosCamposPreenchidos = demanda.itensSelecionados.every(item => 
    item.peso_g && item.peso_g !== '0' && item.volumes && item.volumes !== '0'
  );
  const todosItensSalvos = demanda.itensSelecionados.every(item => item.salvo);
  const todosItensProntos = todosCamposPreenchidos && todosItensSalvos;
  const itensNaoSalvosCount = demanda.itensSelecionados.filter(item => !item.salvo).length;

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
            {itensNaoSalvosCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {itensNaoSalvosCount} não salvo(s)
              </Badge>
            )}
            <Button 
              size="sm" 
              onClick={handleEnviar} 
              disabled={demanda.itensSelecionados.length === 0 || demanda.enviando || !todosItensProntos}
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
        {/* Layout adaptativo: esconde "Itens Disponíveis" quando vazio e expande "Pronto para Envio" */}
        {(() => {
          const layoutExpandido = itensNaoSelecionados.length === 0;
          
          return (
            <div className={layoutExpandido ? "grid grid-cols-1 gap-4" : "grid md:grid-cols-2 gap-4"}>
              {/* Itens Disponíveis (para adicionar) - ESCONDIDO quando vazio */}
              {!layoutExpandido && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    Itens Disponíveis
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {itensNaoSelecionados.map(item => (
                      <div key={item.item_id} className="flex items-center justify-between p-2 bg-background border rounded text-sm hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.item_nome}</p>
                          {item.codigo_lote && (
                            <Badge variant="outline" className="text-xs font-mono mt-0.5">
                              📦 {formatarCodigoLoteComData(item.codigo_lote)}
                            </Badge>
                          )}
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
                </div>
              )}

              {/* Itens Selecionados (prontos para envio) - EXPANDIDO quando sozinho */}
              <div className={`border rounded-lg ${layoutExpandido ? 'p-4' : 'p-3'} border-primary/30 bg-primary/5`}>
                <h4 className={`font-medium mb-2 flex items-center gap-1 ${layoutExpandido ? 'text-base' : 'text-sm'}`}>
                  <CheckCircle className={`text-primary ${layoutExpandido ? 'w-4 h-4' : 'w-3 h-3'}`} />
                  Pronto para Envio ({demanda.itensSelecionados.length})
                </h4>
                {demanda.itensSelecionados.length === 0 ? (
                  <p className={`text-muted-foreground text-center py-3 ${layoutExpandido ? 'text-sm' : 'text-xs'}`}>
                    Adicione itens da lista ao lado
                  </p>
                ) : (
                  <>
                    <div className={`space-y-2 overflow-y-auto ${layoutExpandido ? 'max-h-96' : 'max-h-48'}`}>
                      {demanda.itensSelecionados.map(item => {
                        const camposPreenchidos = item.peso_g && item.peso_g !== '0' && item.volumes && item.volumes !== '0';
                        const precisaSalvar = !item.salvo && camposPreenchidos;
                        
                        return (
                          <div key={item.item_id} className={`flex items-center gap-3 bg-background border rounded ${layoutExpandido ? 'p-3' : 'p-2'} ${item.salvo ? 'border-green-500/50 bg-green-50/50' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-medium truncate ${layoutExpandido ? 'text-base' : 'text-sm'}`}>{item.item_nome}</p>
                                {item.salvo && (
                                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                )}
                              </div>
                              {item.codigo_lote && (
                                <span className={`font-mono text-muted-foreground ${layoutExpandido ? 'text-sm' : 'text-xs'}`}>
                                  📦 {formatarCodigoLoteComData(item.codigo_lote)}
                                </span>
                              )}
                            </div>
                            <Input
                              type="number"
                              value={item.quantidade || ''}
                              onChange={(e) => onUpdateQuantidade(demanda.loja_id, item.item_id, parseInt(e.target.value) || 0)}
                              className={layoutExpandido ? "w-24 h-12 text-center text-lg font-medium" : "w-20 h-10 text-center text-base font-medium"}
                              min={1}
                            />
                            <span className={`text-muted-foreground ${layoutExpandido ? 'text-base' : 'text-sm'}`}>un</span>
                            <PesoInputInlineCompacto
                              value={item.peso_g}
                              onChange={(valor) => onUpdatePesoItem(demanda.loja_id, item.item_id, valor)}
                            />
                            <Input
                              type="number"
                              value={item.volumes || ''}
                              onChange={(e) => onUpdateVolumesItem(demanda.loja_id, item.item_id, e.target.value)}
                              className={layoutExpandido ? "w-24 h-12 text-center text-lg font-medium" : "w-20 h-10 text-center text-base font-medium"}
                              placeholder="Vol"
                              min={1}
                            />
                            <span className={`text-muted-foreground ${layoutExpandido ? 'text-base' : 'text-sm'}`}>vol</span>
                            
                            {/* Botão Salvar */}
                            <Button
                              size={layoutExpandido ? "sm" : "sm"}
                              variant={item.salvo ? "ghost" : "default"}
                              className={`${layoutExpandido ? "h-9 px-3" : "h-7 px-2"} ${
                                item.salvo 
                                  ? "text-green-600 hover:text-green-700 hover:bg-green-50" 
                                  : precisaSalvar 
                                    ? "bg-primary hover:bg-primary/90 text-primary-foreground animate-pulse"
                                    : "bg-muted text-muted-foreground"
                              }`}
                              onClick={() => onSalvarItem(demanda.loja_id, item.item_id)}
                              disabled={item.salvo || !camposPreenchidos}
                            >
                              {item.salvo ? (
                                <Check className={layoutExpandido ? "w-4 h-4" : "w-3 h-3"} />
                              ) : (
                                <>
                                  <Save className={layoutExpandido ? "w-4 h-4" : "w-3 h-3"} />
                                  <span className={layoutExpandido ? "ml-1" : "sr-only"}>Salvar</span>
                                </>
                              )}
                            </Button>
                            
                            <Button 
                              size={layoutExpandido ? "default" : "sm"}
                              variant="ghost" 
                              className={layoutExpandido ? "h-10 w-10 p-0" : "h-7 w-7 p-0"}
                              onClick={() => onRemoveItem(demanda.loja_id, item.item_id)}
                            >
                              <Trash2 className={`text-destructive ${layoutExpandido ? 'w-4 h-4' : 'w-3 h-3'}`} />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Peso Total e Volumes calculados */}
                    <div className={`grid grid-cols-2 gap-3 border-t ${layoutExpandido ? 'mt-4 pt-4' : 'mt-3 pt-3'}`}>
                      <div className="space-y-1">
                        <p className={`font-medium text-muted-foreground ${layoutExpandido ? 'text-sm' : 'text-xs'}`}>Peso Total</p>
                        <p className={`font-semibold ${layoutExpandido ? 'text-lg' : 'text-sm'}`}>
                          {pesoTotalCalculado > 0 ? `${(pesoTotalCalculado / 1000).toFixed(2)} kg` : '—'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className={`font-medium text-muted-foreground ${layoutExpandido ? 'text-sm' : 'text-xs'}`}>Total Volumes</p>
                        <p className={`font-semibold ${layoutExpandido ? 'text-lg' : 'text-sm'}`}>
                          {volumesTotalCalculado > 0 ? volumesTotalCalculado : '—'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}
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
  const { buscarProducoesPendentes } = useRomaneioAutomatico();

  // Verificar se usuário é restrito (não-admin) - todos não-admin usam lojas_acesso
  const isRestrictedUser = !isAdmin();
  const canManageProduction = isAdmin() || hasRole('Produção');

  // ==================== ESTADOS ====================
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [todasLojas, setTodasLojas] = useState<Loja[]>([]);
  const [demandasPorLoja, setDemandasPorLoja] = useState<DemandaPorLoja[]>([]);
  const [loadingDemandas, setLoadingDemandas] = useState(false);
  
  const [romaneiosEnviados, setRomaneiosEnviados] = useState<Romaneio[]>([]);
  const [romaneiosHistorico, setRomaneiosHistorico] = useState<Romaneio[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('recebido'); // Padrão: finalizados
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
  
  // Estados para peso e volumes no recebimento (POR ITEM - igual ao envio)
  interface ItemRecebimentoState {
    quantidade_recebida: number;
    peso_g: string;
    volumes: string;
    salvo: boolean;
  }
  const [recebimentosPorItem, setRecebimentosPorItem] = useState<{ [itemId: string]: ItemRecebimentoState }>({});
  
  // Romaneios aguardando conferência
  const [romaneiosAguardando, setRomaneiosAguardando] = useState<RomaneioAguardandoConferencia[]>([]);
  const [loadingBuscarPendentes, setLoadingBuscarPendentes] = useState(false);

  // ==================== EFFECTS ====================

  useEffect(() => {
    fetchLojas();
    fetchTodasLojas();
    fetchUserLojas();
  }, []);

  // Buscar demandas e romaneios aguardando quando lojas e CPD estiverem disponíveis
  useEffect(() => {
    if (lojas.length > 0 && cpdLojaId && canManageProduction) {
      fetchDemandasTodasLojas();
      fetchRomaneiosAguardando();
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
        // SEMPRE atualizar quando há qualquer mudança em produções
        fetchDemandasTodasLojas();
        
        // Notificar quando produção é finalizada
        if (payload.new && (payload.new as any).status === 'finalizado') {
          const itemNome = (payload.new as any).item_nome || 'Item';
          console.log('[Romaneio] Produção finalizada detectada:', itemNome);
          toast.info(`📦 Produção finalizada: ${itemNome}`, {
            description: 'Itens disponíveis para envio no romaneio.'
          });
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'estoque_cpd'
      }, (payload) => {
        console.log('[Romaneio] Estoque CPD atualizado:', payload);
        fetchDemandasTodasLojas();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'estoque_loja_itens'
      }, (payload) => {
        console.log('[Romaneio] Estoque loja atualizado:', payload);
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
        fetchRomaneiosAguardando();
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

      // Calcular ontem para incluir produções recentes
      const ontem = new Date(serverDate);
      ontem.setDate(ontem.getDate() - 1);
      const ontemStr = ontem.toISOString().split('T')[0];
      console.log('[Romaneio] Buscando produções desde:', ontemStr);

      // 1. Buscar estoque CPD (tabela dedicada estoque_cpd)
      const { data: estoqueCpd, error: estoqueError } = await supabase
        .from('estoque_cpd')
        .select(`item_porcionado_id, quantidade, itens_porcionados:itens_porcionados!inner(nome)`)
        .gt('quantidade', 0);

      if (estoqueError) throw estoqueError;
      console.log('[Romaneio] Estoque CPD encontrado:', estoqueCpd?.length, 'itens');

      // 2. Buscar produções finalizadas dos últimos 2 dias com detalhes_lojas não vazios
      const { data: producoesRaw, error: producoesError } = await supabase
        .from('producao_registros')
        .select('id, item_id, item_nome, detalhes_lojas, data_fim, sequencia_traco, data_referencia, codigo_lote')
        .eq('status', 'finalizado')
        .gte('data_referencia', ontemStr)
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

      // 3. Buscar romaneios pendentes/enviados COM data_criacao para filtrar por produção
      const { data: romaneiosPendentes, error: romaneiosError } = await supabase
        .from('romaneio_itens')
        .select(`item_porcionado_id, quantidade, romaneios!inner(loja_id, status, data_criacao)`)
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
      // E criar mapa de data_fim por item para filtrar romaneios
      const demandaPorLojaItem: Record<string, Record<string, { quantidade: number; codigo_lote?: string; producao_registro_id: string }>> = {};
      const dataFimPorItem: Record<string, string> = {}; // Mapa: item_id -> data_fim da última produção
      const itemsProcessados = new Set<string>();
      
      // Produções já ordenadas por data_fim DESC, então primeira aparição é a mais recente
      producoes?.forEach(prod => {
        // Pular se já processamos este item (usar apenas a última produção)
        if (itemsProcessados.has(prod.item_id)) return;
        itemsProcessados.add(prod.item_id);
        
        // Armazenar data_fim desta produção (mais recente)
        if (prod.data_fim) {
          dataFimPorItem[prod.item_id] = prod.data_fim;
        }
        
        const detalhes = prod.detalhes_lojas as Array<{ loja_id: string; loja_nome?: string; quantidade: number }> | null;
        
        // Verificar se detalhes_lojas existe E não está vazio
        if (!detalhes || !Array.isArray(detalhes) || detalhes.length === 0) return;
        
        detalhes.forEach(d => {
          if (d.quantidade > 0 && d.loja_id) {
            if (!demandaPorLojaItem[d.loja_id]) {
              demandaPorLojaItem[d.loja_id] = {};
            }
            demandaPorLojaItem[d.loja_id][prod.item_id] = {
              quantidade: d.quantidade,
              codigo_lote: prod.codigo_lote,
              producao_registro_id: prod.id
            };
          }
        });
      });
      
      console.log('[Romaneio] Demanda por loja/item:', demandaPorLojaItem);
      console.log('[Romaneio] Data fim por item:', dataFimPorItem);

      // 6. Calcular já enviado por loja e item - APENAS romaneios criados APÓS a finalização da produção
      const jaEnviadoPorLojaItem: Record<string, Record<string, number>> = {};
      romaneiosPendentes?.forEach(ri => {
        const lojaId = (ri.romaneios as any).loja_id;
        const itemId = ri.item_porcionado_id;
        const dataCriacaoRomaneio = (ri.romaneios as any).data_criacao;
        const dataFimProd = dataFimPorItem[itemId];
        
        // Só conta como "já enviado" se romaneio foi criado APÓS a finalização da produção atual
        // Se não há produção para este item, também não conta (produção antiga foi substituída)
        if (!dataFimProd) {
          console.log(`[Romaneio] Item ${itemId} sem produção atual - romaneio ignorado`);
          return;
        }
        
        if (dataCriacaoRomaneio <= dataFimProd) {
          console.log(`[Romaneio] Romaneio de ${itemId} criado ANTES da produção atual (${dataCriacaoRomaneio} <= ${dataFimProd}) - ignorado`);
          return;
        }
        
        console.log(`[Romaneio] Romaneio de ${itemId} criado APÓS produção (${dataCriacaoRomaneio} > ${dataFimProd}) - contando...`);
        
        if (!jaEnviadoPorLojaItem[lojaId]) {
          jaEnviadoPorLojaItem[lojaId] = {};
        }
        jaEnviadoPorLojaItem[lojaId][itemId] = (jaEnviadoPorLojaItem[lojaId][itemId] || 0) + ri.quantidade;
      });
      console.log('[Romaneio] Já enviado por loja/item (após filtro por data):', jaEnviadoPorLojaItem);

      // 7. Construir demandas para cada loja
      const demandasProcessadas: DemandaPorLoja[] = lojas.map(loja => {
        const demandaItens = demandaPorLojaItem[loja.id] || {};
        const jaEnviado = jaEnviadoPorLojaItem[loja.id] || {};
        
        const itens: ItemDemandaLoja[] = [];
        const itensSelecionados: ItemSelecionadoLoja[] = [];
        
        Object.entries(demandaItens).forEach(([itemId, itemData]) => {
          const estoque = estoqueMap[itemId];
          if (!estoque) {
            console.log(`[Romaneio] Item ${itemId} não encontrado no estoque CPD`);
            return;
          }
          
          const quantidade = itemData.quantidade;
          const qtdJaEnviada = jaEnviado[itemId] || 0;
          const demandaPendente = Math.max(0, quantidade - qtdJaEnviada);
          const disponivel = Math.min(demandaPendente, estoque.quantidade);
          
          console.log(`[Romaneio] ${loja.nome} - ${estoque.nome}: demanda=${quantidade}, jaEnviado=${qtdJaEnviada}, pendente=${demandaPendente}, disponivel=${disponivel}, codigo_lote=${itemData.codigo_lote}`);
          
          if (disponivel > 0) {
            const itemDemanda: ItemDemandaLoja = {
              item_id: itemId,
              item_nome: estoque.nome,
              quantidade_demanda: quantidade,
              quantidade_estoque_cpd: estoque.quantidade,
              quantidade_disponivel: disponivel,
              quantidade_ja_enviada: qtdJaEnviada,
              codigo_lote: itemData.codigo_lote,
              producao_registro_id: itemData.producao_registro_id
            };
            itens.push(itemDemanda);
            
            // Pré-selecionar automaticamente todos os itens disponíveis
            itensSelecionados.push({
              item_id: itemId,
              item_nome: estoque.nome,
              quantidade: disponivel,
              peso_g: '',
              volumes: '',
              codigo_lote: itemData.codigo_lote,
              producao_registro_id: itemData.producao_registro_id,
              salvo: false
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
          enviando: false
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
        .select(`*, peso_total_envio_g, quantidade_volumes_envio, romaneio_itens (id, item_nome, quantidade, peso_total_kg, producao_registro_id, producao_registros:producao_registro_id (codigo_lote, data_referencia))`)
        .eq('status', 'enviado')
        .order('data_envio', { ascending: false });

      if (!isAdmin() && userLojasIds.length > 0) {
        query = query.in('loja_id', userLojasIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Transformar dados para extrair codigo_lote e data_referencia do join
      const romaneiosFormatados = (data || []).map(r => {
        const itensFormatados = r.romaneio_itens?.map((item: any) => ({
          ...item,
          codigo_lote: item.producao_registros?.codigo_lote || null,
          data_referencia: item.producao_registros?.data_referencia || null
        })) || [];
        
        // Pegar a data_referencia do primeiro item (todos devem ser do mesmo dia)
        const dataRefPrimeiro = itensFormatados[0]?.data_referencia || null;
        
        return {
          ...r,
          data_referencia: dataRefPrimeiro,
          romaneio_itens: itensFormatados
        };
      });
      
      setRomaneiosEnviados(romaneiosFormatados);
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
        .select(`*, peso_total_envio_g, quantidade_volumes_envio, peso_total_recebido_g, quantidade_volumes_recebido, romaneio_itens (item_nome, quantidade, peso_total_kg, producao_registro_id, producao_registros:producao_registro_id (codigo_lote, data_referencia))`)
        .order('data_criacao', { ascending: false });

      if (!isAdmin() && userLojasIds.length > 0) {
        query = query.in('loja_id', userLojasIds);
      }

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Transformar dados para extrair codigo_lote e data_referencia do join
      const romaneiosFormatados = (data || []).map(r => {
        const itensFormatados = r.romaneio_itens?.map((item: any) => ({
          ...item,
          codigo_lote: item.producao_registros?.codigo_lote || null,
          data_referencia: item.producao_registros?.data_referencia || null
        })) || [];
        
        // Pegar a data_referencia do primeiro item
        const dataRefPrimeiro = itensFormatados[0]?.data_referencia || null;
        
        return {
          ...r,
          data_referencia: dataRefPrimeiro,
          romaneio_itens: itensFormatados
        };
      });
      
      setRomaneiosHistorico(romaneiosFormatados);
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

  // ==================== FETCH: ROMANEIOS AGUARDANDO CONFERÊNCIA ====================
  
  const fetchRomaneiosAguardando = async () => {
    try {
      // Buscar romaneios com status 'aguardando_conferencia'
      const { data: romaneios, error } = await supabase
        .from('romaneios')
        .select(`
          id, loja_id, loja_nome, data_criacao, usuario_nome,
          romaneio_itens (id, item_nome, quantidade, peso_total_kg, quantidade_volumes, producao_registro_id, producao_registros:producao_registro_id (data_referencia))
        `)
        .eq('status', 'aguardando_conferencia')
        .order('data_criacao', { ascending: true });

      if (error) throw error;

      // Transformar para o formato esperado
      const romaneiosFormatados: RomaneioAguardandoConferencia[] = (romaneios || []).map(r => {
        const itensFormatados = (r.romaneio_itens || []).map((item: any) => ({
          id: item.id,
          item_nome: item.item_nome,
          quantidade: item.quantidade,
          peso_g: item.peso_total_kg ? String(Math.round(item.peso_total_kg * 1000)) : '',
          volumes: item.quantidade_volumes ? String(item.quantidade_volumes) : '',
          salvo: item.peso_total_kg > 0 && item.quantidade_volumes > 0,
          producao_registro_id: item.producao_registro_id,
          data_referencia: item.producao_registros?.data_referencia || null
        }));
        
        // Pegar a data_referencia do primeiro item
        const dataRefPrimeiro = itensFormatados[0]?.data_referencia || null;
        
        return {
          id: r.id,
          loja_id: r.loja_id,
          loja_nome: r.loja_nome,
          data_criacao: r.data_criacao,
          data_referencia: dataRefPrimeiro,
          usuario_nome: r.usuario_nome,
          itens: itensFormatados
        };
      });

      setRomaneiosAguardando(romaneiosFormatados);
      console.log('[Romaneio] Romaneios aguardando conferência:', romaneiosFormatados.length);
    } catch (error) {
      console.error('[Romaneio] Erro ao buscar romaneios aguardando:', error);
    }
  };

  // ==================== HANDLERS: ROMANEIOS AGUARDANDO CONFERÊNCIA ====================

  const handleUpdatePesoAguardando = (romaneioId: string, itemId: string, peso: string) => {
    setRomaneiosAguardando(prev => prev.map(r => {
      if (r.id !== romaneioId) return r;
      return {
        ...r,
        itens: r.itens.map(item => 
          item.id === itemId ? { ...item, peso_g: peso, salvo: false } : item
        )
      };
    }));
  };

  const handleUpdateVolumesAguardando = (romaneioId: string, itemId: string, volumes: string) => {
    setRomaneiosAguardando(prev => prev.map(r => {
      if (r.id !== romaneioId) return r;
      return {
        ...r,
        itens: r.itens.map(item => 
          item.id === itemId ? { ...item, volumes, salvo: false } : item
        )
      };
    }));
  };

  const handleSalvarItemAguardando = async (romaneioId: string, itemId: string) => {
    const romaneio = romaneiosAguardando.find(r => r.id === romaneioId);
    const item = romaneio?.itens.find(i => i.id === itemId);
    if (!item) return;

    try {
      const pesoKg = rawToKg(item.peso_g);
      const volumes = parseInt(item.volumes) || 0;

      await supabase.from('romaneio_itens').update({
        peso_total_kg: pesoKg,
        quantidade_volumes: volumes
      }).eq('id', itemId);

      setRomaneiosAguardando(prev => prev.map(r => {
        if (r.id !== romaneioId) return r;
        return {
          ...r,
          itens: r.itens.map(i => 
            i.id === itemId ? { ...i, salvo: true } : i
          )
        };
      }));

      toast.success(`${item.item_nome} salvo!`);
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      toast.error('Erro ao salvar item');
    }
  };

  const handleEnviarRomaneioAguardando = async (romaneioId: string) => {
    const romaneio = romaneiosAguardando.find(r => r.id === romaneioId);
    if (!romaneio) return;

    // Validar: todos os itens devem estar salvos
    const itensNaoSalvos = romaneio.itens.filter(i => !i.salvo);
    if (itensNaoSalvos.length > 0) {
      toast.error(`${itensNaoSalvos.length} item(ns) não foi(ram) salvo(s). Salve todos antes de enviar.`);
      return;
    }

    // Validar peso e volumes
    for (const item of romaneio.itens) {
      if (!item.peso_g || item.peso_g === '0') {
        toast.error(`Informe o peso do item: ${item.item_nome}`);
        return;
      }
      if (!item.volumes || item.volumes === '0') {
        toast.error(`Informe a quantidade de volumes do item: ${item.item_nome}`);
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Validar estoque CPD antes de enviar
      for (const item of romaneio.itens) {
        // Buscar item_porcionado_id do romaneio_item
        const { data: romaneioItem } = await supabase
          .from('romaneio_itens')
          .select('item_porcionado_id')
          .eq('id', item.id)
          .single();

        if (romaneioItem?.item_porcionado_id) {
          const { data: estoque } = await supabase
            .from('estoque_cpd')
            .select('quantidade')
            .eq('item_porcionado_id', romaneioItem.item_porcionado_id)
            .maybeSingle();

          const estoqueAtual = estoque?.quantidade || 0;
          if (estoqueAtual < item.quantidade) {
            toast.error(`Estoque insuficiente: ${item.item_nome}. Disponível: ${estoqueAtual}, Solicitado: ${item.quantidade}`);
            return;
          }

          // Debitar estoque CPD
          const novaQuantidade = estoqueAtual - item.quantidade;
          await supabase.from('estoque_cpd').update({
            quantidade: novaQuantidade,
            data_ultima_movimentacao: new Date().toISOString()
          }).eq('item_porcionado_id', romaneioItem.item_porcionado_id);
        }
      }

      // Calcular totais
      const pesoTotalGramas = romaneio.itens.reduce((acc, item) => 
        acc + parsePesoProgressivo(item.peso_g).valorGramas, 0);
      const volumesTotal = romaneio.itens.reduce((acc, item) => 
        acc + (parseInt(item.volumes) || 0), 0);

      // Atualizar romaneio para status 'enviado'
      await supabase.from('romaneios').update({
        status: 'enviado',
        data_envio: new Date().toISOString(),
        peso_total_envio_g: pesoTotalGramas,
        quantidade_volumes_envio: volumesTotal
      }).eq('id', romaneioId);

      toast.success(`📦 Romaneio enviado para ${romaneio.loja_nome}!`);
      
      // Atualizar listas
      await Promise.all([
        fetchRomaneiosAguardando(),
        fetchDemandasTodasLojas(),
        fetchRomaneiosEnviados()
      ]);
    } catch (error) {
      console.error('Erro ao enviar romaneio:', error);
      toast.error('Erro ao enviar romaneio');
    }
  };

  const handleBuscarPendentes = async () => {
    if (!organizationId) return;
    
    setLoadingBuscarPendentes(true);
    try {
      await buscarProducoesPendentes(organizationId);
      await fetchRomaneiosAguardando();
    } catch (error) {
      console.error('Erro ao buscar pendentes:', error);
    } finally {
      setLoadingBuscarPendentes(false);
    }
  };

  // ==================== HANDLERS: ENVIAR POR LOJA ====================

  const handleEnviarRomaneioLoja = async (lojaId: string, itens: ItemSelecionadoLoja[]) => {
    if (itens.length === 0) {
      toast.error('Nenhum item selecionado');
      return;
    }
    const pesoTotalGramas = itens.reduce((acc, item) => acc + (parsePesoProgressivo(item.peso_g).valorGramas), 0);
    const volumesTotal = itens.reduce((acc, item) => acc + (parseInt(item.volumes) || 0), 0);
    console.log(`[Romaneio] Enviando para loja ${lojaId} - Peso Total: ${pesoTotalGramas}g, Volumes: ${volumesTotal}`);

    // Marcar loja como enviando
    setDemandasPorLoja(prev => prev.map(d => 
      d.loja_id === lojaId ? { ...d, enviando: true } : d
    ));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Validar estoque CPD antes de enviar
      for (const item of itens) {
        const { data: estoque } = await supabase
          .from('estoque_cpd')
          .select('quantidade')
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

      // Criar romaneio como ENVIADO com peso e volumes
      const { data: romaneio, error: romaneioError } = await supabase.from('romaneios').insert({
        loja_id: lojaId,
        loja_nome: loja?.nome || '',
        status: 'enviado',
        data_criacao: agora,
        data_envio: agora,
        usuario_id: user.id,
        usuario_nome: userProfile?.nome || 'Usuário',
        organization_id: organizationId,
        peso_total_envio_g: pesoTotalGramas,
        quantidade_volumes_envio: volumesTotal
      }).select().single();

      if (romaneioError) throw romaneioError;

      // Inserir itens com peso e volumes individuais
      const itensRomaneio = itens.map(item => ({
        romaneio_id: romaneio.id,
        item_porcionado_id: item.item_id,
        item_nome: item.item_nome,
        quantidade: item.quantidade,
        peso_total_kg: rawToKg(item.peso_g), // Converter peso raw para kg
        quantidade_volumes: parseInt(item.volumes) || 0,
        organization_id: organizationId,
        producao_registro_id: item.producao_registro_id || null // Vincular ao lote de produção
      }));

      await supabase.from('romaneio_itens').insert(itensRomaneio);

      // Debitar estoque CPD (tabela estoque_cpd)
      for (const item of itens) {
        const { data: estoqueAtual } = await supabase
          .from('estoque_cpd')
          .select('quantidade')
          .eq('item_porcionado_id', item.item_id)
          .maybeSingle();
        
        const novaQuantidade = Math.max(0, (estoqueAtual?.quantidade || 0) - item.quantidade);
        
        await supabase
          .from('estoque_cpd')
          .upsert({
            item_porcionado_id: item.item_id,
            quantidade: novaQuantidade,
            data_ultima_movimentacao: new Date().toISOString(),
            organization_id: organizationId
          }, { onConflict: 'item_porcionado_id' });
      }

      // Verificar se produção foi totalmente expedida e atualizar status
      const producaoIds = itens
        .map(item => item.producao_registro_id)
        .filter((id): id is string => !!id);
      
      if (producaoIds.length > 0) {
        // Para cada registro de produção vinculado, verificar se demanda foi atendida
        for (const producaoId of [...new Set(producaoIds)]) {
          // Buscar demanda do registro de produção
          const { data: registro } = await supabase
            .from('producao_registros')
            .select('demanda_lojas, unidades_programadas')
            .eq('id', producaoId)
            .single();
          
          if (registro) {
            // Buscar total enviado via romaneios para este registro de produção
            const { data: romaneioItens } = await supabase
              .from('romaneio_itens')
              .select('quantidade')
              .eq('producao_registro_id', producaoId);
            
            const qtdTotalEnviada = romaneioItens?.reduce((acc, ri) => acc + (ri.quantidade || 0), 0) || 0;
            const demandaTotal = registro.demanda_lojas || registro.unidades_programadas || 0;
            
            // Se toda a demanda foi atendida, marcar como expedido
            if (demandaTotal > 0 && qtdTotalEnviada >= demandaTotal) {
              await supabase
                .from('producao_registros')
                .update({ status: 'expedido' })
                .eq('id', producaoId);
            }
          }
        }
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
          item.item_id === itemId ? { ...item, quantidade: Math.max(1, quantidade), salvo: false } : item
        )
      };
    }));
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
          quantidade: item.quantidade_disponivel,
          peso_g: '',
          volumes: '',
          codigo_lote: item.codigo_lote,
          producao_registro_id: item.producao_registro_id,
          salvo: false
        }]
      };
    }));
  };

  const handleUpdateVolumesItemLoja = (lojaId: string, itemId: string, volumes: string) => {
    setDemandasPorLoja(prev => prev.map(d => {
      if (d.loja_id !== lojaId) return d;
      return {
        ...d,
        itensSelecionados: d.itensSelecionados.map(item =>
          item.item_id === itemId ? { ...item, volumes, salvo: false } : item
        )
      };
    }));
  };

  const handleUpdatePesoItemLoja = (lojaId: string, itemId: string, peso: string) => {
    setDemandasPorLoja(prev => prev.map(d => {
      if (d.loja_id !== lojaId) return d;
      return {
        ...d,
        itensSelecionados: d.itensSelecionados.map(item =>
          item.item_id === itemId ? { ...item, peso_g: peso, salvo: false } : item
        )
      };
    }));
  };

  const handleSalvarItemLoja = (lojaId: string, itemId: string) => {
    setDemandasPorLoja(prev => prev.map(d => {
      if (d.loja_id !== lojaId) return d;
      
      const item = d.itensSelecionados.find(i => i.item_id === itemId);
      if (!item) return d;
      
      // Validar campos obrigatórios antes de salvar
      if (!item.peso_g || item.peso_g === '0') {
        toast.error(`Informe o peso do item: ${item.item_nome}`);
        return d;
      }
      if (!item.volumes || item.volumes === '0') {
        toast.error(`Informe a quantidade de volumes: ${item.item_nome}`);
        return d;
      }
      
      toast.success(`${item.item_nome} salvo!`);
      
      return {
        ...d,
        itensSelecionados: d.itensSelecionados.map(i =>
          i.item_id === itemId ? { ...i, salvo: true } : i
        )
      };
    }));
  };

  // ==================== HANDLERS: RECEBIMENTO POR ITEM ====================

  const handleUpdateQuantidadeRecebimento = (itemId: string, quantidade: number) => {
    setRecebimentosPorItem(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantidade_recebida: Math.max(0, quantidade), salvo: false }
    }));
  };

  const handleUpdatePesoRecebimento = (itemId: string, peso: string) => {
    setRecebimentosPorItem(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], peso_g: peso, salvo: false }
    }));
  };

  const handleUpdateVolumesRecebimento = (itemId: string, volumes: string) => {
    setRecebimentosPorItem(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], volumes: volumes, salvo: false }
    }));
  };

  const handleSalvarItemRecebimento = (itemId: string, itemNome: string) => {
    const item = recebimentosPorItem[itemId];
    if (!item) return;
    
    if (!item.peso_g || item.peso_g === '0') {
      toast.error(`Informe o peso de: ${itemNome}`);
      return;
    }
    if (!item.volumes || item.volumes === '0') {
      toast.error(`Informe os volumes de: ${itemNome}`);
      return;
    }
    
    setRecebimentosPorItem(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], salvo: true }
    }));
    toast.success(`"${itemNome}" salvo!`);
  };

  // Helper: Calcular totais de recebimento a partir dos itens
  const calcularTotaisRecebimento = (romaneio: Romaneio) => {
    const itensIds = romaneio.romaneio_itens.map((item, idx) => item.id || `${romaneio.id}-${idx}`);
    let pesoTotalG = 0;
    let volumesTotal = 0;
    
    for (const itemId of itensIds) {
      const item = recebimentosPorItem[itemId];
      if (item) {
        const parsed = parsePesoProgressivo(item.peso_g || '0');
        pesoTotalG += parsed.valorGramas;
        volumesTotal += parseInt(item.volumes) || 0;
      }
    }
    
    return { pesoTotalG, volumesTotal };
  };

  // Helper: Verificar se todos os itens do romaneio estão salvos
  const verificarTodosItensSalvos = (romaneio: Romaneio) => {
    const itensIds = romaneio.romaneio_itens.map((item, idx) => item.id || `${romaneio.id}-${idx}`);
    const todosItensSalvos = itensIds.every(id => recebimentosPorItem[id]?.salvo);
    const itensNaoSalvosCount = itensIds.filter(id => !recebimentosPorItem[id]?.salvo).length;
    return { todosItensSalvos, itensNaoSalvosCount };
  };

  // ==================== HELPERS: DIVERGÊNCIA ====================

  // Cálculo de divergência em tempo real (usando totais calculados dos itens)
  // REGRA: Só calcula divergência se houver peso enviado registrado (não NULL)
  const calcularDivergencia = (romaneioId: string, romaneio: Romaneio) => {
    const pesoEnviado = romaneio.peso_total_envio_g ?? null;
    const volumesEnviados = romaneio.quantidade_volumes_envio ?? null;
    const totais = calcularTotaisRecebimento(romaneio);
    const pesoInformado = totais.pesoTotalG;
    const volumesInformados = totais.volumesTotal;
    
    // Se não há dados de envio, não é possível calcular divergência
    const dadosEnvioCompletos = pesoEnviado !== null && pesoEnviado > 0;
    
    if (!dadosEnvioCompletos) {
      return {
        temDivergencia: false,
        temDivergenciaPeso: false,
        temDivergenciaVolumes: false,
        diferencaPeso: 0,
        diferencaVolumes: 0,
        pesoEnviado: pesoEnviado || 0,
        pesoInformado,
        dadosEnvioIncompletos: true
      };
    }
    
    const temDivergenciaPeso = pesoInformado > 0 && pesoInformado !== pesoEnviado;
    const temDivergenciaVolumes = volumesInformados > 0 && volumesInformados !== (volumesEnviados || 0);
    const diferencaPeso = pesoInformado - pesoEnviado;
    const diferencaVolumes = volumesInformados - (volumesEnviados || 0);
    
    return {
      temDivergencia: temDivergenciaPeso || temDivergenciaVolumes,
      temDivergenciaPeso,
      temDivergenciaVolumes,
      diferencaPeso,
      diferencaVolumes,
      pesoEnviado,
      pesoInformado,
      dadosEnvioIncompletos: false
    };
  };

  // Classificar tipo de divergência para cores e ícones
  const getStatusDivergencia = (diferencaPeso: number, diferencaVolumes: number) => {
    const temDivergenciaPeso = diferencaPeso !== 0;
    const temDivergenciaVolumes = diferencaVolumes !== 0;
    
    if (!temDivergenciaPeso && !temDivergenciaVolumes) {
      return { tipo: 'ok' as const, icone: '✅', descricao: 'Conferência perfeita' };
    }
    
    // Prioriza análise do peso (mais importante)
    if (diferencaPeso > 0 || (diferencaPeso === 0 && diferencaVolumes > 0)) {
      return { tipo: 'excedente' as const, icone: '🟢', descricao: 'Recebido a mais' };
    }
    
    return { tipo: 'falta' as const, icone: '🔻', descricao: 'Recebido a menos' };
  };

  // Calcular percentual de divergência para regra anti-fraude
  const calcularPercentualDivergencia = (enviado: number, recebido: number) => {
    if (enviado === 0) return 0;
    return Math.abs((recebido - enviado) / enviado) * 100;
  };

  // Formatar peso para exibição (g ou kg)
  const formatarPesoDivergencia = (gramas: number) => {
    const abs = Math.abs(gramas);
    const sinal = gramas > 0 ? '+' : '';
    return abs >= 1000 
      ? `${sinal}${(gramas / 1000).toFixed(2).replace('.', ',')} kg` 
      : `${sinal}${gramas} g`;
  };

  // ==================== HANDLERS: RECEBIMENTO ====================

  const handleConfirmarRecebimento = async (romaneioId: string) => {
    const romaneio = romaneiosEnviados.find(r => r.id === romaneioId);
    if (!romaneio) {
      toast.error('Romaneio não encontrado');
      return;
    }
    
    // Validar que todos os itens foram salvos
    const { todosItensSalvos, itensNaoSalvosCount } = verificarTodosItensSalvos(romaneio);
    if (!todosItensSalvos) {
      toast.error(`Salve todos os itens antes de confirmar (${itensNaoSalvosCount} pendente(s))`);
      return;
    }
    
    // Calcular totais a partir dos itens
    const totais = calcularTotaisRecebimento(romaneio);
    if (totais.pesoTotalG === 0) {
      toast.error('Nenhum peso informado nos itens');
      return;
    }
    if (totais.volumesTotal === 0) {
      toast.error('Nenhum volume informado nos itens');
      return;
    }

    const div = calcularDivergencia(romaneioId, romaneio);
    const status = getStatusDivergencia(div.diferencaPeso, div.diferencaVolumes);
    
    // Regra anti-fraude: divergência > 2% exige justificativa obrigatória
    const percentual = calcularPercentualDivergencia(div.pesoEnviado, div.pesoInformado);
    const divergenciaCritica = percentual > 2;
    
    if (divergenciaCritica && !observacaoRecebimento[romaneioId]?.trim()) {
      toast.error('Divergência acima de 2%! Justificativa obrigatória no campo de observação.');
      return;
    }
    
    try {
      setLoadingRecebimento(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase.from('profiles').select('nome').eq('id', user.id).single();

      // Atualizar cada item com os dados de recebimento
      for (const item of romaneio.romaneio_itens) {
        const itemId = item.id || `${romaneio.id}-${romaneio.romaneio_itens.indexOf(item)}`;
        const recItem = recebimentosPorItem[itemId];
        if (recItem && item.id) {
          const pesoKg = parsePesoProgressivo(recItem.peso_g || '0').valorKg;
          await supabase.from('romaneio_itens').update({ 
            quantidade_recebida: recItem.quantidade_recebida, 
            peso_recebido_kg: pesoKg
          }).eq('id', item.id);
        }
      }

      const pesoRecebidoNum = totais.pesoTotalG;
      const volumesRecebidoNum = totais.volumesTotal;
      const divergenciaCalculada = pesoRecebidoNum - (romaneio.peso_total_envio_g || 0);

      await supabase.from('romaneios').update({
        status: 'recebido',
        data_recebimento: new Date().toISOString(),
        recebido_por_id: user.id,
        recebido_por_nome: userProfile?.nome || 'Usuário',
        observacao: observacaoRecebimento[romaneioId] || null,
        peso_total_recebido_g: pesoRecebidoNum,
        quantidade_volumes_recebido: volumesRecebidoNum
      }).eq('id', romaneioId);

      // Registro de auditoria completo
      await supabase.from('audit_logs').insert({
        action: 'romaneio.recebimento',
        entity_type: 'romaneio',
        entity_id: romaneioId,
        organization_id: organizationId,
        user_id: user.id,
        user_email: user.email || '',
        details: {
          id_romaneio: romaneioId,
          loja_nome: romaneio.loja_nome,
          peso_enviado: romaneio.peso_total_envio_g,
          peso_recebido: pesoRecebidoNum,
          divergencia_calculada: divergenciaCalculada,
          status_divergencia: status.tipo,
          percentual_divergencia: percentual.toFixed(2),
          volumes_enviados: romaneio.quantidade_volumes_envio,
          volumes_recebidos: volumesRecebidoNum,
          usuario_que_recebeu: userProfile?.nome,
          data_hora: new Date().toISOString(),
          justificativa_se_existente: observacaoRecebimento[romaneioId] || null,
          divergencia_critica: divergenciaCritica
        }
      });

      // Alertar sobre divergência (mas não bloquear)
      if (div.temDivergencia) {
        if (status.tipo === 'falta') {
          toast.warning(`Recebimento registrado com divergência: ${formatarPesoDivergencia(divergenciaCalculada)} (Recebido a menos)`);
        } else if (status.tipo === 'excedente') {
          toast.info(`Recebimento registrado com divergência: ${formatarPesoDivergencia(divergenciaCalculada)} (Recebido a mais)`);
        }
      } else {
        toast.success('Recebimento confirmado! Conferência perfeita.');
      }
      
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
            <Tabs defaultValue={canManageProduction ? 'enviar' : 'receber'} className="space-y-4">
              <TabsList className={`grid w-full ${canManageProduction ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {canManageProduction && <TabsTrigger value="enviar">Enviar</TabsTrigger>}
                <TabsTrigger value="receber">Receber</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
                <TabsTrigger value="avulso">
                  <ArrowRightLeft className="w-4 h-4 mr-1" />
                  Avulso
                </TabsTrigger>
              </TabsList>

              {/* TAB: ENVIAR - SEÇÕES INDEPENDENTES POR LOJA */}
              {canManageProduction && (
                <TabsContent value="enviar" className="space-y-4">
                  {/* Botões de ação */}
                  <div className="flex justify-between items-center">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={handleBuscarPendentes}
                      disabled={loadingBuscarPendentes}
                      className="gap-2"
                    >
                      {loadingBuscarPendentes ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Buscar Pendentes
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        fetchDemandasTodasLojas();
                        fetchRomaneiosAguardando();
                      }}
                      disabled={loadingDemandas}
                      className="gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingDemandas ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>

                  {/* SEÇÃO: ROMANEIOS AGUARDANDO CONFERÊNCIA */}
                  {romaneiosAguardando.length > 0 && (
                    <Card className="border-2 border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20">
                      <CardHeader className="py-3">
                        <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
                          <Clock className="w-5 h-5" />
                          Romaneios Aguardando Conferência ({romaneiosAguardando.length})
                        </CardTitle>
                        <CardDescription>
                          Informe peso e volumes para cada item antes de enviar
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {romaneiosAguardando.map(romaneio => {
                          const todosItensSalvos = romaneio.itens.every(i => i.salvo);
                          const itensNaoSalvos = romaneio.itens.filter(i => !i.salvo).length;
                          
                          return (
                            <Card key={romaneio.id} className="border-l-4 border-l-amber-500">
                              <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="flex items-center gap-2 text-base">
                                    <Store className="w-4 h-4 text-amber-600" />
                                    {romaneio.loja_nome}
                                  </CardTitle>
                                  <div className="flex items-center gap-2">
                                    {itensNaoSalvos > 0 && (
                                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                                        {itensNaoSalvos} item(ns) pendente(s)
                                      </Badge>
                                    )}
                                    <Button
                                      size="sm"
                                      onClick={() => handleEnviarRomaneioAguardando(romaneio.id)}
                                      disabled={!todosItensSalvos}
                                      className="gap-1"
                                    >
                                      <Send className="w-4 h-4" />
                                      Enviar
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                {/* Tarja de Demanda */}
                                {romaneio.data_referencia && (
                                  <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-700 rounded-lg">
                                    <CalendarDays className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                                      DEMANDA: Referente à demanda de {getDescricaoDia(romaneio.data_referencia)}, {format(new Date(romaneio.data_referencia + 'T12:00:00'), "dd/MM/yyyy")} - {romaneio.loja_nome}
                                    </span>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  {romaneio.itens.map(item => {
                                    const camposPreenchidos = item.peso_g && item.peso_g !== '0' && item.volumes && item.volumes !== '0';
                                    const precisaSalvar = !item.salvo && camposPreenchidos;
                                    
                                    return (
                                      <div key={item.id} className={`flex items-center gap-3 p-3 border rounded ${item.salvo ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'bg-background'}`}>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <p className="font-medium">{item.item_nome}</p>
                                            {item.salvo && (
                                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                            )}
                                          </div>
                                          <p className="text-sm text-muted-foreground">{item.quantidade} un</p>
                                        </div>
                                        
                                        <PesoInputInlineCompacto
                                          value={item.peso_g}
                                          onChange={(v) => handleUpdatePesoAguardando(romaneio.id, item.id, v)}
                                        />
                                        
                                        <Input
                                          type="number"
                                          value={item.volumes || ''}
                                          onChange={(e) => handleUpdateVolumesAguardando(romaneio.id, item.id, e.target.value)}
                                          placeholder="Vol"
                                          className="w-20 h-10 text-center text-base font-medium"
                                          min={1}
                                        />
                                        <span className="text-sm text-muted-foreground">vol</span>
                                        
                                        <Button
                                          size="sm"
                                          variant={item.salvo ? "ghost" : "default"}
                                          className={`h-9 px-3 ${
                                            item.salvo 
                                              ? "text-green-600 hover:text-green-700 hover:bg-green-50" 
                                              : precisaSalvar 
                                                ? "bg-primary hover:bg-primary/90 text-primary-foreground animate-pulse"
                                                : "bg-muted text-muted-foreground"
                                          }`}
                                          onClick={() => handleSalvarItemAguardando(romaneio.id, item.id)}
                                          disabled={item.salvo || !camposPreenchidos}
                                        >
                                          {item.salvo ? (
                                            <Check className="w-4 h-4" />
                                          ) : (
                                            <>
                                              <Save className="w-4 h-4" />
                                              <span className="ml-1">Salvar</span>
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}
                  
                  <Separator />
                  
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
                          onUpdatePesoItem={handleUpdatePesoItemLoja}
                          onUpdateVolumesItem={handleUpdateVolumesItemLoja}
                          onRemoveItem={handleRemoveItemLoja}
                          onAddItem={handleAddItemLoja}
                          onSalvarItem={handleSalvarItemLoja}
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
                                {getStatusBadge(romaneio.status)}
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {/* Tarjas de Data - Envio e Demanda */}
                              <DateTags 
                                dataEnvio={romaneio.data_envio}
                                dataReferencia={romaneio.data_referencia}
                                lojaNome={romaneio.loja_nome}
                              />
                              
                              {/* Informações do Envio */}
                              {(romaneio.peso_total_envio_g || romaneio.quantidade_volumes_envio) && (
                                <div className="flex gap-4 p-3 bg-muted/50 rounded-lg">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Peso Enviado</p>
                                    <p className="font-medium text-sm">
                                      {romaneio.peso_total_envio_g 
                                        ? romaneio.peso_total_envio_g >= 1000 
                                          ? `${(romaneio.peso_total_envio_g / 1000).toFixed(2).replace('.', ',')} kg`
                                          : `${romaneio.peso_total_envio_g} g`
                                        : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Volumes Enviados</p>
                                    <p className="font-medium text-sm">
                                      {romaneio.quantidade_volumes_envio || '-'} vol
                                    </p>
                                  </div>
                                </div>
                              )}
                              
                              {romaneio.romaneio_itens.map((item, idx) => {
                                const itemId = item.id || `${romaneio.id}-${idx}`;
                                const recItem = recebimentosPorItem[itemId] || { 
                                  quantidade_recebida: item.quantidade, 
                                  peso_g: '', 
                                  volumes: '', 
                                  salvo: false 
                                };
                                const camposPreenchidos = recItem.peso_g && recItem.peso_g !== '0' && recItem.volumes && recItem.volumes !== '0';
                                const precisaSalvar = !recItem.salvo && camposPreenchidos;
                                
                                // Inicializar item se não existir
                                if (!recebimentosPorItem[itemId]) {
                                  setRecebimentosPorItem(prev => ({
                                    ...prev,
                                    [itemId]: { 
                                      quantidade_recebida: item.quantidade, 
                                      peso_g: '', 
                                      volumes: '', 
                                      salvo: false 
                                    }
                                  }));
                                }
                                
                                return (
                                  <div key={itemId} className={`flex flex-col gap-2 p-3 border rounded ${recItem.salvo ? 'border-green-500/50 bg-green-50/50' : ''}`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium text-sm truncate">{item.item_nome}</p>
                                          {recItem.salvo && (
                                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">Enviado: {item.quantidade} un</p>
                                        {item.codigo_lote && (
                                          <span className="text-xs font-mono text-muted-foreground">
                                            📦 {formatarCodigoLoteComData(item.codigo_lote)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 flex-wrap">
                                      {/* Quantidade Recebida */}
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          value={recItem.quantidade_recebida || ''}
                                          onChange={(e) => handleUpdateQuantidadeRecebimento(itemId, parseInt(e.target.value) || 0)}
                                          className="w-24 h-10 text-center text-base font-medium"
                                          min={0}
                                        />
                                        <span className="text-sm text-muted-foreground">un</span>
                                      </div>
                                      
                                      {/* Peso */}
                                      <PesoInputInlineCompacto
                                        value={recItem.peso_g}
                                        onChange={(v) => handleUpdatePesoRecebimento(itemId, v)}
                                      />
                                      
                                      {/* Volumes */}
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          value={recItem.volumes || ''}
                                          onChange={(e) => handleUpdateVolumesRecebimento(itemId, e.target.value)}
                                          placeholder="Vol"
                                          className="w-20 h-10 text-center text-base font-medium"
                                          min={1}
                                        />
                                        <span className="text-sm text-muted-foreground">vol</span>
                                      </div>
                                      
                                      {/* Botão Salvar */}
                                      <Button
                                        size="sm"
                                        variant={recItem.salvo ? "ghost" : "default"}
                                        className={`h-8 px-3 ${
                                          recItem.salvo 
                                            ? "text-green-600 hover:text-green-700 hover:bg-green-50" 
                                            : precisaSalvar 
                                              ? "bg-primary hover:bg-primary/90 text-primary-foreground animate-pulse"
                                              : "bg-muted text-muted-foreground"
                                        }`}
                                        onClick={() => handleSalvarItemRecebimento(itemId, item.item_nome)}
                                        disabled={recItem.salvo || !camposPreenchidos}
                                      >
                                        {recItem.salvo ? (
                                          <Check className="w-4 h-4" />
                                        ) : (
                                          <>
                                            <Save className="w-4 h-4" />
                                            <span className="ml-1">Salvar</span>
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* Totais Calculados Automaticamente */}
                              {(() => {
                                const totais = calcularTotaisRecebimento(romaneio);
                                const { todosItensSalvos, itensNaoSalvosCount } = verificarTodosItensSalvos(romaneio);
                                
                                return (
                                  <>
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                                      <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground">Peso Total Recebido</p>
                                        <p className="text-lg font-semibold">
                                          {totais.pesoTotalG > 0 
                                            ? totais.pesoTotalG >= 1000 
                                              ? `${(totais.pesoTotalG / 1000).toFixed(2).replace('.', ',')} kg`
                                              : `${totais.pesoTotalG} g`
                                            : '—'}
                                        </p>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground">Total Volumes</p>
                                        <p className="text-lg font-semibold">
                                          {totais.volumesTotal > 0 ? totais.volumesTotal : '—'}
                                        </p>
                                      </div>
                                    </div>
                              
                                    {/* Indicador de Divergência em Tempo Real */}
                                    {(() => {
                                      const div = calcularDivergencia(romaneio.id, romaneio);
                                      if (totais.pesoTotalG === 0 && totais.volumesTotal === 0) return null;
                                      
                                      // Se dados de envio estão incompletos (romaneio antigo), não calcular divergência
                                      if (div.dadosEnvioIncompletos) {
                                        return (
                                          <div className="flex items-center gap-2 p-3 bg-muted/50 border border-dashed rounded-lg text-muted-foreground text-sm">
                                            <span className="text-lg">ℹ️</span>
                                            <span>Romaneio criado antes do registro de peso/volumes - divergência não disponível</span>
                                          </div>
                                        );
                                      }
                                      
                                      const status = getStatusDivergencia(div.diferencaPeso, div.diferencaVolumes);
                                      const percentual = calcularPercentualDivergencia(div.pesoEnviado, div.pesoInformado);
                                      const divergenciaCritica = percentual > 2;
                                      
                                      if (status.tipo === 'ok') {
                                        return (
                                          <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-700 dark:text-blue-400 text-sm">
                                            <span className="text-lg">{status.icone}</span>
                                            <span className="font-medium">Sem divergência (Conferência perfeita)</span>
                                          </div>
                                        );
                                      }
                                      
                                      const bgClass = status.tipo === 'excedente' 
                                        ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' 
                                        : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400';
                                      
                                      return (
                                        <div className={`p-3 border rounded-lg text-sm space-y-1 ${bgClass}`}>
                                          <div className="flex items-center gap-2">
                                            <span className="text-lg">{status.icone}</span>
                                            <div>
                                              <span className="font-medium">Divergência: </span>
                                              {div.temDivergenciaPeso && <span>{formatarPesoDivergencia(div.diferencaPeso)}</span>}
                                              {div.temDivergenciaPeso && div.temDivergenciaVolumes && <span> | </span>}
                                              {div.temDivergenciaVolumes && <span>Volumes: {div.diferencaVolumes > 0 ? '+' : ''}{div.diferencaVolumes}</span>}
                                              <span className="ml-2 font-medium">({status.descricao})</span>
                                            </div>
                                          </div>
                                          {divergenciaCritica && (
                                            <p className="text-xs font-medium flex items-center gap-1">
                                              <AlertCircle className="w-3 h-3" />
                                              Divergência &gt;2% - Justificativa obrigatória
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    
                                    <Textarea
                                      placeholder="Observação (opcional)"
                                      value={observacaoRecebimento[romaneio.id] || ''}
                                      onChange={(e) => setObservacaoRecebimento(prev => ({ ...prev, [romaneio.id]: e.target.value }))}
                                      className="h-16"
                                    />
                                    
                                    <div className="flex items-center gap-2">
                                      {itensNaoSalvosCount > 0 && (
                                        <Badge variant="destructive" className="text-xs">
                                          {itensNaoSalvosCount} não salvo(s)
                                        </Badge>
                                      )}
                                      <Button 
                                        onClick={() => handleConfirmarRecebimento(romaneio.id)} 
                                        disabled={loadingRecebimento || !todosItensSalvos}
                                        className="flex-1"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Confirmar Recebimento
                                      </Button>
                                    </div>
                                  </>
                                );
                              })()}
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
                                      className="w-24 h-10 text-center text-base font-medium"
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

              {/* TAB: HISTÓRICO - Filtro padrão "recebido" para evitar confusão com romaneios pendentes */}
              <TabsContent value="historico" className="space-y-4">
                <div className="flex gap-2">
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recebido">✅ Finalizados</SelectItem>
                      <SelectItem value="enviado">📦 Aguardando Receb.</SelectItem>
                      <SelectItem value="todos">📋 Todos</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground self-center ml-2">
                    {filtroStatus === 'recebido' && 'Romaneios já confirmados pela loja'}
                    {filtroStatus === 'enviado' && 'Romaneios enviados aguardando confirmação'}
                    {filtroStatus === 'todos' && 'Todos os romaneios'}
                  </p>
                </div>

                {romaneiosHistorico.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Nenhum romaneio encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {romaneiosHistorico.map(romaneio => {
                      const divergenciaPeso = (romaneio.peso_total_recebido_g || 0) - (romaneio.peso_total_envio_g || 0);
                      const divergenciaVolumes = (romaneio.quantidade_volumes_recebido || 0) - (romaneio.quantidade_volumes_envio || 0);
                      const temDivergencia = romaneio.status === 'recebido' && (divergenciaPeso !== 0 || divergenciaVolumes !== 0);
                      const statusDiv = getStatusDivergencia(divergenciaPeso, divergenciaVolumes);
                      
                      // Determinar cor da borda baseado no tipo de divergência
                      const borderClass = romaneio.status === 'recebido' && temDivergencia
                        ? statusDiv.tipo === 'falta' 
                          ? 'border-red-500/50 bg-red-500/5' 
                          : 'border-green-500/50 bg-green-500/5'
                        : '';
                      
                      return (
                        <div key={romaneio.id} className={`border rounded-lg p-3 ${borderClass}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium">{romaneio.loja_nome}</p>
                              <p className="text-xs text-muted-foreground">
                                Criado por: {romaneio.usuario_nome}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {temDivergencia && (
                                <Badge 
                                  variant={statusDiv.tipo === 'falta' ? 'destructive' : 'default'} 
                                  className={`text-xs ${statusDiv.tipo === 'excedente' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                >
                                  {statusDiv.icone} {formatarPesoDivergencia(divergenciaPeso)} ({statusDiv.descricao})
                                </Badge>
                              )}
                              {getStatusBadge(romaneio.status)}
                            </div>
                          </div>
                          
                          {/* Tarjas de Data - Envio e Demanda */}
                          <DateTags 
                            dataEnvio={romaneio.data_envio}
                            dataReferencia={romaneio.data_referencia}
                            lojaNome={romaneio.loja_nome}
                          />
                          
                          <div className="text-xs text-muted-foreground">
                            {romaneio.romaneio_itens.map((item, i) => (
                              <span key={i}>{item.item_nome}: {item.quantidade}un{i < romaneio.romaneio_itens.length - 1 ? ' • ' : ''}</span>
                            ))}
                          </div>
                          
                          {/* Detalhes de Peso/Volumes - exibir para TODOS os romaneios com dados */}
                          {(romaneio.peso_total_envio_g || romaneio.quantidade_volumes_envio) && (
                            <div className="mt-2 pt-2 border-t text-xs space-y-1">
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <span className="text-muted-foreground">
                                  📦 Enviado: {romaneio.peso_total_envio_g ? `${romaneio.peso_total_envio_g >= 1000 ? `${(romaneio.peso_total_envio_g / 1000).toFixed(2).replace('.', ',')} kg` : `${romaneio.peso_total_envio_g} g`}` : '-'} / {romaneio.quantidade_volumes_envio || '-'} vol
                                </span>
                                {romaneio.status === 'recebido' && (
                                  <span className="text-muted-foreground">
                                    📥 Recebido: {romaneio.peso_total_recebido_g ? `${romaneio.peso_total_recebido_g >= 1000 ? `${(romaneio.peso_total_recebido_g / 1000).toFixed(2).replace('.', ',')} kg` : `${romaneio.peso_total_recebido_g} g`}` : '-'} / {romaneio.quantidade_volumes_recebido || '-'} vol
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
