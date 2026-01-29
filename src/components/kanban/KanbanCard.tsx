import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { 
  Package, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Lock, 
  XCircle, 
  Trash2, 
  Plus,
  ChevronDown,
  Factory,
  LayoutList,
  Package2,
  Building2,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimerDisplay } from './TimerDisplay';

import { useProductionTimer } from '@/hooks/useProductionTimer';
import { formatarPesoExibicao } from '@/lib/weightUtils';

interface InsumoExtraComEstoque {
  nome: string;
  quantidade_necessaria: number;
  unidade: string;
  unidade_estoque: string;
  estoque_disponivel: number;
  estoque_suficiente: boolean;
}

interface DetalheLojaProducao {
  loja_id: string;
  loja_nome: string;
  quantidade: number;
}

interface ProducaoRegistro {
  id: string;
  item_id: string;
  item_nome: string;
  status: string;
  unidades_programadas: number | null;
  unidades_reais: number | null;
  peso_programado_kg: number | null;
  peso_final_kg: number | null;
  peso_preparo_kg?: number | null;
  sobra_preparo_kg?: number | null;
  data_inicio: string | null;
  data_inicio_preparo?: string | null;
  data_inicio_porcionamento?: string | null;
  data_fim: string | null;
  usuario_nome: string;
  detalhes_lojas?: DetalheLojaProducao[];
  unidade_medida?: string;
  equivalencia_traco?: number | null;
  insumo_principal_nome?: string;
  insumo_principal_estoque_kg?: number;
  insumosExtras?: InsumoExtraComEstoque[];
  demanda_lojas?: number | null;
  reserva_configurada?: number | null;
  sobra_reserva?: number | null;
  timer_ativo?: boolean;
  tempo_timer_minutos?: number | null;
  sequencia_traco?: number;
  lote_producao_id?: string;
  bloqueado_por_traco_anterior?: boolean;
  timer_status?: string;
  total_tracos_lote?: number;
  usa_embalagem_por_porcao?: boolean;
  insumo_embalagem_nome?: string;
  quantidade_embalagem?: number;
  unidade_embalagem?: string;
  lotes_masseira?: number;
  farinha_consumida_kg?: number;
  massa_total_gerada_kg?: number;
  peso_medio_operacional_bolinha_g?: number;
  peso_minimo_bolinha_g?: number;
  peso_maximo_bolinha_g?: number;
  peso_alvo_bolinha_g?: number;
  unidades_estimadas_masseira?: number;
  peso_medio_real_bolinha_g?: number;
  status_calibracao?: string;
  codigo_lote?: string;
  margem_lote_percentual?: number | null;
  data_referencia?: string;
  // Campo para identificar registro pendente (produção parcial)
  is_incremental?: boolean;
}

type StatusColumn = 'a_produzir' | 'em_preparo' | 'em_porcionamento' | 'finalizado';

const formatarCodigoLoteComData = (codigoLote: string): string => {
  const match = codigoLote.match(/LOTE-(\d{4})(\d{2})(\d{2})-/);
  if (match) {
    const [, , mes, dia] = match;
    return `${dia}/${mes} ${codigoLote}`;
  }
  return codigoLote;
};

// Componente de seção colapsável
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
  variant?: 'default' | 'purple' | 'blue' | 'slate';
}

const CollapsibleSection = ({ 
  title, 
  icon, 
  isOpen, 
  onToggle, 
  children, 
  badge,
  variant = 'default' 
}: CollapsibleSectionProps) => {
  const bgClasses = {
    default: 'bg-card',
    purple: 'bg-purple-50/50 dark:bg-purple-950/30',
    blue: 'bg-blue-50/50 dark:bg-blue-950/30',
    slate: 'bg-slate-50/50 dark:bg-slate-900/50'
  };

  const borderClasses = {
    default: 'border-border',
    purple: 'border-purple-200 dark:border-purple-800',
    blue: 'border-blue-200 dark:border-blue-800',
    slate: 'border-slate-200 dark:border-slate-700'
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className={`${bgClasses[variant]} border ${borderClasses[variant]} rounded-lg overflow-hidden`}>
        <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2 text-sm font-medium">
            {icon}
            <span>{title}</span>
            {badge}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t border-inherit">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

interface KanbanCardProps {
  registro: ProducaoRegistro;
  columnId: StatusColumn;
  onAction: () => void;
  onTimerFinished?: (registroId: string) => void;
  onCancelarPreparo?: () => void;
  onRegistrarPerda?: () => void;
  isPreview?: boolean;
  producaoHabilitada?: boolean;
}

export function KanbanCard({ registro, columnId, onAction, onTimerFinished, onCancelarPreparo, onRegistrarPerda, isPreview = false, producaoHabilitada = true }: KanbanCardProps) {
  // Estados para seções colapsáveis
  const [producaoOpen, setProducaoOpen] = useState(true);
  const [composicaoOpen, setComposicaoOpen] = useState(false);
  const [insumosOpen, setInsumosOpen] = useState(false);
  const [insumosConferenciaOpen, setInsumosConferenciaOpen] = useState(false);

  const timerState = useProductionTimer(
    registro.id,
    registro.tempo_timer_minutos || 10,
    registro.timer_ativo || false,
    registro.data_inicio_preparo || null
  );

  useEffect(() => {
    if (
      columnId === 'em_preparo' && 
      timerState.isFinished && 
      onTimerFinished && 
      registro.timer_status !== 'concluido'
    ) {
      onTimerFinished(registro.id);
    }
  }, [timerState.isFinished, columnId, registro.id, registro.timer_status, onTimerFinished]);

  const getButtonConfig = () => {
    switch (columnId) {
      case 'a_produzir':
        return { 
          label: 'Ir para Preparo', 
          icon: ArrowRight, 
          variant: 'default' as const 
        };
      case 'em_preparo':
        return { 
          label: 'Ir para Porcionamento', 
          icon: ArrowRight, 
          variant: 'default' as const 
        };
      case 'em_porcionamento':
        return { 
          label: 'Finalizar Porcionamento', 
          icon: CheckCircle2, 
          variant: 'default' as const 
        };
      default:
        return null;
    }
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig?.icon;

  const estoqueInsuficiente = columnId === 'a_produzir' && 
    registro.insumo_principal_estoque_kg !== undefined && 
    registro.peso_programado_kg !== null &&
    registro.peso_programado_kg > registro.insumo_principal_estoque_kg;

  const temInsumosExtrasInsuficientes = columnId === 'a_produzir' &&
    registro.insumosExtras?.some(extra => !extra.estoque_suficiente);

  const estaBloqueadoPorTraco = registro.bloqueado_por_traco_anterior === true;
  
  const timerAindaRodando = columnId === 'em_preparo' && 
    registro.timer_ativo && 
    timerState.isActive && 
    !timerState.isFinished;

  // Na coluna A_PRODUZIR, bloquear se não tiver iniciado a produção da loja
  const aguardandoIniciar = columnId === 'a_produzir' && !producaoHabilitada;

  const estaBloqueado = estaBloqueadoPorTraco || timerAindaRodando || aguardandoIniciar;
  
  const temSequenciaTraco = registro.sequencia_traco !== undefined && registro.sequencia_traco !== null;
  const temLote = registro.lote_producao_id !== undefined && registro.lote_producao_id !== null;

  // Cores da borda lateral por status
  const borderColorByColumn = {
    a_produzir: 'border-l-blue-500',
    em_preparo: 'border-l-amber-500',
    em_porcionamento: 'border-l-purple-500',
    finalizado: 'border-l-emerald-500'
  };

  return (
    <Card className={`
      transition-all duration-300 ease-out animate-fade-in 
      hover:shadow-lg hover:-translate-y-0.5
      border-l-4 ${borderColorByColumn[columnId]}
      ${columnId === 'em_preparo' && timerState.isFinished ? 'ring-2 ring-destructive ring-offset-2 animate-pulse' : ''} 
      ${estaBloqueado ? 'opacity-60' : ''}
    `}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-2 pb-2 border-b">
            <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-sm leading-tight tracking-tight">
                  {registro.item_nome}
                </h4>
                {/* Badge da LOJA - Destaque principal */}
                {registro.detalhes_lojas && registro.detalhes_lojas.length === 1 && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30"
                  >
                    <Building2 className="h-2.5 w-2.5 mr-1" />
                    {registro.detalhes_lojas[0].loja_nome}
                  </Badge>
                )}
                {/* Badge de Data de Referência */}
                {registro.data_referencia && (() => {
                  const dataRef = new Date(registro.data_referencia + 'T00:00:00');
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  const isAntiga = dataRef < hoje;
                  
                  return (
                    <Badge 
                      variant="outline"
                      className={`text-[10px] font-medium ${
                        isAntiga 
                          ? "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700 animate-pulse" 
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {isAntiga ? '⚠️' : '📅'} {format(dataRef, 'dd/MM', { locale: ptBR })}
                    </Badge>
                  );
                })()}
                {/* Badge PENDENTE para registros de produção parcial */}
                {registro.is_incremental && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700"
                  >
                    PENDENTE
                  </Badge>
                )}
                {/* Badge do Lote em VERMELHO - destaque */}
                {registro.sequencia_traco !== undefined && registro.total_tracos_lote && registro.total_tracos_lote > 1 && (
                  <Badge 
                    variant="destructive" 
                    className="font-bold text-xs px-2 py-0.5 bg-red-600 hover:bg-red-600 text-white"
                  >
                    LOTE {registro.sequencia_traco}/{registro.total_tracos_lote}
                  </Badge>
                )}
              </div>
              {registro.codigo_lote && (
                <span className="text-xs font-mono text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-md inline-block mt-1.5">
                  📦 {formatarCodigoLoteComData(registro.codigo_lote)}
                </span>
              )}
            </div>
          </div>

          {/* Indicador de bloqueio */}
          {estaBloqueado && columnId === 'a_produzir' && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs text-amber-700 dark:text-amber-300">
                {aguardandoIniciar 
                  ? 'Clique em "Iniciar" na loja para liberar'
                  : `Aguardando lote ${(registro.sequencia_traco || 1) - 1} finalizar`}
              </span>
            </div>
          )}

          {/* Informações por coluna */}
          <div className="space-y-2">
            {/* A PRODUZIR */}
            {columnId === 'a_produzir' && (
              <>
                {/* Seção: Produção Industrial (LOTE_MASSEIRA) - Cada card = 1 lote individual */}
                {registro.unidade_medida === 'lote_masseira' ? (
                  <CollapsibleSection
                    title="Este Lote Consome"
                    icon={<Factory className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                    isOpen={producaoOpen}
                    onToggle={() => setProducaoOpen(!producaoOpen)}
                    variant="purple"
                  >
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Farinha (este lote)</span>
                        <p className="text-xl font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                          {registro.farinha_consumida_kg?.toFixed(1) || '15'}
                          <span className="text-xs font-normal text-muted-foreground ml-1">kg</span>
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Massa Gerada</span>
                        <p className="text-xl font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                          {registro.massa_total_gerada_kg?.toFixed(1) || '25'}
                          <span className="text-xs font-normal text-muted-foreground ml-1">kg</span>
                        </p>
                      </div>
                      <div className="space-y-0.5 col-span-2">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Unidades (este lote)</span>
                        <p className="text-xl font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                          ~{registro.unidades_programadas || registro.unidades_estimadas_masseira}
                          <span className="text-xs font-normal text-muted-foreground ml-1">un</span>
                        </p>
                      </div>
                    </div>
                    
                    {/* Resumo total da produção (só exibe se há múltiplos lotes) */}
                    {registro.total_tracos_lote && registro.total_tracos_lote > 1 && (
                      <div className="mt-3 pt-2 border-t border-purple-200 dark:border-purple-700 text-xs text-purple-600 dark:text-purple-400">
                        📊 Total: {registro.total_tracos_lote} lotes × {registro.farinha_consumida_kg || 15}kg = {' '}
                        <span className="font-bold">
                          {(registro.total_tracos_lote * (registro.farinha_consumida_kg || 15)).toFixed(0)}kg farinha
                        </span>
                      </div>
                    )}
                    
                    {registro.peso_minimo_bolinha_g && registro.peso_maximo_bolinha_g && (
                      <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-700 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        ⚖️ Faixa: {registro.peso_minimo_bolinha_g}g - {registro.peso_maximo_bolinha_g}g
                        {registro.peso_alvo_bolinha_g && (
                          <span className="text-muted-foreground">(Alvo: {registro.peso_alvo_bolinha_g}g)</span>
                        )}
                      </div>
                    )}
                  </CollapsibleSection>
                ) : registro.unidades_programadas && (
                  <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground">📦 Total:</span>
                    <Badge variant="secondary" className="font-semibold">
                      {(registro.unidade_medida === 'traco' || registro.unidade_medida === 'lote') && registro.equivalencia_traco ? (
                        <>
                          {Math.ceil(registro.unidades_programadas / registro.equivalencia_traco)} lotes ({Math.ceil(registro.unidades_programadas / registro.equivalencia_traco) * registro.equivalencia_traco} un)
                        </>
                      ) : (
                        `${registro.unidades_programadas} un`
                      )}
                    </Badge>
                  </div>
                )}

                {/* Seção: Composição da Demanda */}
                {(registro.demanda_lojas || registro.detalhes_lojas?.length) && (
                  <CollapsibleSection
                    title="Composição"
                    icon={<LayoutList className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                    isOpen={composicaoOpen}
                    onToggle={() => setComposicaoOpen(!composicaoOpen)}
                    variant="blue"
                    badge={
                      registro.detalhes_lojas && registro.detalhes_lojas.length > 0 ? (
                        <Badge variant="secondary" className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {registro.detalhes_lojas.length} {registro.detalhes_lojas.length === 1 ? 'loja' : 'lojas'}
                        </Badge>
                      ) : null
                    }
                  >
                    <div className="mt-2">
                      {registro.detalhes_lojas && registro.detalhes_lojas.length > 0 ? (
                          <div className="space-y-1.5">
                            {registro.detalhes_lojas.map((detalhe, idx) => (
                              <div 
                                key={idx} 
                                className="flex items-center justify-between py-1.5 px-2 rounded-md bg-blue-100/50 dark:bg-blue-900/30"
                              >
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                  <span className="text-xs font-medium truncate max-w-[120px]">{detalhe.loja_nome}</span>
                                </div>
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                                  {detalhe.quantidade}
                                  <span className="font-normal text-muted-foreground ml-1">un</span>
                                </span>
                              </div>
                            ))}
                            {registro.demanda_lojas !== null && registro.demanda_lojas !== undefined && (
                              <div className="flex justify-end pt-2 mt-1 border-t border-blue-200 dark:border-blue-700">
                                <span className="text-xs text-muted-foreground">
                                  Total: <span className="font-bold text-blue-700 dark:text-blue-300">{registro.demanda_lojas} un</span>
                                </span>
                              </div>
                            )}
                          </div>
                        ) : registro.demanda_lojas !== null && registro.demanda_lojas !== undefined ? (
                          <div className="flex justify-between text-xs py-1.5">
                            <span className="text-muted-foreground">Demanda Lojas:</span>
                            <span className="font-bold text-blue-700 dark:text-blue-300">{registro.demanda_lojas} un</span>
                          </div>
                        ) : null}
                      
                      {registro.reserva_configurada !== null && registro.reserva_configurada !== undefined && registro.reserva_configurada > 0 && (
                        <div className="flex justify-between text-xs py-1.5 mt-1">
                          <span className="text-muted-foreground">Reserva do Dia:</span>
                          <span className="font-medium text-blue-600 dark:text-blue-400">{registro.reserva_configurada} un</span>
                        </div>
                      )}
                      {registro.sobra_reserva !== null && registro.sobra_reserva !== undefined && registro.sobra_reserva > 0 && (
                        <div className="flex justify-between text-xs py-1.5">
                          <span className="text-muted-foreground">Arredondamento:</span>
                          <span className="font-medium text-blue-600 dark:text-blue-400">+{registro.sobra_reserva} un</span>
                        </div>
                      )}
                      
                      {/* Nota sobre margem de flexibilização - só mostrar no ÚLTIMO LOTE quando realmente aplicada */}
                      {registro.unidade_medida === 'lote_masseira' && 
                       registro.unidades_estimadas_masseira && 
                       registro.demanda_lojas && 
                       registro.lotes_masseira &&
                       registro.sequencia_traco === registro.total_tracos_lote && // Só no último lote
                       (() => {
                         // Calcular se a margem foi realmente aplicada no último lote
                         const unidadesPorLote = registro.unidades_estimadas_masseira / registro.lotes_masseira;
                         const margem = registro.margem_lote_percentual || 0;
                         
                         if (margem === 0) return false;
                         
                         // Capacidade total dos lotes anteriores (sem o último)
                         const lotesAnteriores = registro.lotes_masseira - 1;
                         const capacidadeLotesAnteriores = lotesAnteriores * unidadesPorLote;
                         
                         // Demanda que sobrou para o último lote
                         const demandaUltimoLote = registro.demanda_lojas - capacidadeLotesAnteriores;
                         
                         // Capacidade base do último lote (sem margem)
                         const capacidadeBaseLote = unidadesPorLote;
                         
                         // Margem só foi aplicada se demanda do último lote > capacidade base
                         // (ou seja, sem a margem, precisaria de mais um lote)
                         return demandaUltimoLote > capacidadeBaseLote;
                       })() && (
                        <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                          <span className="text-amber-600 text-xs">ℹ️</span>
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            Último lote absorveu {(() => {
                              const unidadesPorLote = (registro.unidades_estimadas_masseira || 0) / (registro.lotes_masseira || 1);
                              const lotesAnteriores = (registro.lotes_masseira || 1) - 1;
                              const capacidadeLotesAnteriores = lotesAnteriores * unidadesPorLote;
                              const demandaUltimoLote = (registro.demanda_lojas || 0) - capacidadeLotesAnteriores;
                              const unidadesExtras = Math.round(demandaUltimoLote - unidadesPorLote);
                              return unidadesExtras;
                            })()} un extras (margem {registro.margem_lote_percentual}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Seção: Insumos Necessários */}
                {(registro.insumo_principal_nome || (registro.insumosExtras && registro.insumosExtras.length > 0)) && (
                  <CollapsibleSection
                    title="Insumos Necessários"
                    icon={<Package2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
                    isOpen={insumosOpen}
                    onToggle={() => setInsumosOpen(!insumosOpen)}
                    variant="slate"
                    badge={
                      (estoqueInsuficiente || temInsumosExtrasInsuficientes) ? (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Atenção
                        </Badge>
                      ) : null
                    }
                  >
                    <div className="space-y-1.5 mt-2">
                      {/* Insumo Principal */}
                      {registro.insumo_principal_nome && registro.peso_programado_kg && (
                        <div className={`
                          flex flex-col py-2 px-2 rounded-md
                          ${estoqueInsuficiente ? 'bg-destructive/10 border border-destructive/30' : 'bg-slate-100/80 dark:bg-slate-800/50'}
                        `}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{registro.insumo_principal_nome}</span>
                              {estoqueInsuficiente && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                            </div>
                            <span className={`text-xs font-bold tabular-nums ${estoqueInsuficiente ? 'text-destructive' : ''}`}>
                              {registro.peso_programado_kg} kg
                            </span>
                          </div>
                          {registro.insumo_principal_estoque_kg !== undefined && (
                            <div className="flex justify-end mt-1">
                              <span className={`text-[10px] tabular-nums ${estoqueInsuficiente ? 'text-destructive' : 'text-muted-foreground'}`}>
                                Estoque: {formatarPesoExibicao(registro.insumo_principal_estoque_kg * 1000)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Insumos Extras */}
                      {registro.insumosExtras?.map((extra, idx) => (
                        <div 
                          key={idx} 
                          className={`
                            flex flex-col py-2 px-2 rounded-md
                            ${!extra.estoque_suficiente ? 'bg-destructive/10 border border-destructive/30' : 'bg-slate-100/80 dark:bg-slate-800/50'}
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{extra.nome}</span>
                              {!extra.estoque_suficiente && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                            </div>
                            <span className={`text-xs font-bold tabular-nums ${!extra.estoque_suficiente ? 'text-destructive' : ''}`}>
                              {extra.unidade === 'g' 
                                ? formatarPesoExibicao(extra.quantidade_necessaria)
                                : extra.unidade === 'unidade'
                                  ? `${extra.quantidade_necessaria % 1 === 0 
                                      ? extra.quantidade_necessaria.toFixed(0) 
                                      : extra.quantidade_necessaria.toFixed(2)} unidades`
                                  : `${extra.quantidade_necessaria.toFixed(2)} ${extra.unidade}`
                              }
                            </span>
                          </div>
                          <div className="flex justify-end mt-1">
                            <span className={`text-[10px] tabular-nums ${!extra.estoque_suficiente ? 'text-destructive' : 'text-muted-foreground'}`}>
                              Estoque: {extra.unidade_estoque === 'kg' 
                                ? `${extra.estoque_disponivel.toFixed(2)} kg`
                                : extra.unidade_estoque === 'g'
                                  ? formatarPesoExibicao(extra.estoque_disponivel)
                                  : extra.unidade_estoque === 'unidade'
                                    ? `${extra.estoque_disponivel % 1 === 0 
                                        ? extra.estoque_disponivel.toFixed(0) 
                                        : extra.estoque_disponivel.toFixed(2)} un`
                                    : `${extra.estoque_disponivel.toFixed(2)} ${extra.unidade_estoque}`
                              }
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Embalagem */}
                      {registro.usa_embalagem_por_porcao && registro.quantidade_embalagem && registro.insumo_embalagem_nome && (
                        <div className="flex items-center justify-between py-2 px-2 rounded-md bg-purple-100/50 dark:bg-purple-900/30 mt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-medium flex items-center gap-1">
                            🎁 {registro.insumo_embalagem_nome}
                          </span>
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                            {registro.quantidade_embalagem % 1 === 0 
                              ? registro.quantidade_embalagem.toFixed(0) 
                              : registro.quantidade_embalagem.toFixed(1)} {registro.unidade_embalagem || 'un'}
                          </span>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Alerta de Estoque - fora do collapsible para visibilidade */}
                {(estoqueInsuficiente || temInsumosExtrasInsuficientes) && !insumosOpen && (
                  <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-2.5 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Estoque insuficiente - verifique insumos</span>
                  </div>
                )}
              </>
            )}

            {/* EM PREPARO */}
            {columnId === 'em_preparo' && (
              <div className="space-y-3">
                {/* Timer Display */}
                {registro.timer_ativo && registro.tempo_timer_minutos && timerState.isActive && (
                  <div className={`p-3 rounded-lg border-2 ${
                    timerState.isFinished 
                      ? 'bg-destructive/10 border-destructive' 
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Timer de Preparo
                      </span>
                      {timerState.isFinished && (
                        <Badge variant="destructive" className="text-xs animate-pulse">
                          Finalizado!
                        </Badge>
                      )}
                    </div>
                    <TimerDisplay
                      secondsRemaining={timerState.secondsRemaining}
                      isFinished={timerState.isFinished}
                    />
                  </div>
                )}
                
                {registro.unidades_programadas && (
                  <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground">📦 Programadas:</span>
                    <span className="text-sm font-bold">{registro.unidades_programadas} un</span>
                  </div>
                )}
                {registro.data_inicio_preparo && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">
                      Em preparo desde {format(new Date(registro.data_inicio_preparo), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}

                {/* Seção de Conferência de Insumos - Somente Leitura */}
                {(registro.insumosExtras?.length || registro.insumo_principal_nome) && (
                  <CollapsibleSection
                    title="Insumos Utilizados"
                    icon={<ClipboardList className="h-4 w-4 text-slate-500" />}
                    isOpen={insumosConferenciaOpen}
                    onToggle={() => setInsumosConferenciaOpen(!insumosConferenciaOpen)}
                    variant="slate"
                  >
                    <div className="space-y-1.5 mt-2">
                      {/* Insumo Principal */}
                      {registro.insumo_principal_nome && registro.peso_programado_kg && (
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-100/80 dark:bg-slate-800/50">
                          <span className="text-xs font-medium">{registro.insumo_principal_nome}</span>
                          <span className="text-xs font-bold tabular-nums">{registro.peso_programado_kg} kg</span>
                        </div>
                      )}
                      
                      {/* Insumos Extras */}
                      {registro.insumosExtras?.map((extra, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-100/80 dark:bg-slate-800/50">
                          <span className="text-xs font-medium">{extra.nome}</span>
                          <span className="text-xs font-bold tabular-nums">
                            {extra.unidade === 'g' 
                              ? formatarPesoExibicao(extra.quantidade_necessaria)
                              : extra.unidade === 'unidade'
                                ? `${extra.quantidade_necessaria % 1 === 0 ? extra.quantidade_necessaria.toFixed(0) : extra.quantidade_necessaria.toFixed(2)} un`
                                : `${extra.quantidade_necessaria.toFixed(2)} ${extra.unidade}`
                            }
                          </span>
                        </div>
                      ))}

                      {/* Embalagem */}
                      {registro.usa_embalagem_por_porcao && registro.quantidade_embalagem && registro.insumo_embalagem_nome && (
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-100/80 dark:bg-slate-800/50 mt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-medium">🎁 {registro.insumo_embalagem_nome}</span>
                          <span className="text-xs font-bold tabular-nums">
                            {registro.quantidade_embalagem % 1 === 0 ? registro.quantidade_embalagem.toFixed(0) : registro.quantidade_embalagem.toFixed(1)} {registro.unidade_embalagem || 'un'}
                          </span>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            )}

            {/* EM PORCIONAMENTO */}
            {columnId === 'em_porcionamento' && (
              <div className="space-y-2 bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Programadas</span>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                      {registro.unidades_programadas}
                      <span className="text-xs font-normal text-muted-foreground ml-1">un</span>
                    </p>
                  </div>
                  {registro.peso_preparo_kg && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Peso Preparo</span>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                        {registro.peso_preparo_kg}
                        <span className="text-xs font-normal text-muted-foreground ml-1">kg</span>
                      </p>
                    </div>
                  )}
                </div>
                {registro.sobra_preparo_kg !== null && registro.sobra_preparo_kg !== undefined && (
                  <div className="text-xs text-muted-foreground pt-1 border-t border-purple-200 dark:border-purple-700">
                    Sobra preparo: {registro.sobra_preparo_kg} kg
                  </div>
                )}
                {registro.data_inicio_porcionamento && (
                  <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 pt-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      Desde {format(new Date(registro.data_inicio_porcionamento), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}

                {/* Seção de Conferência de Insumos - Somente Leitura */}
                {(registro.insumosExtras?.length || registro.insumo_principal_nome) && (
                  <CollapsibleSection
                    title="Insumos Utilizados"
                    icon={<ClipboardList className="h-4 w-4 text-slate-500" />}
                    isOpen={insumosConferenciaOpen}
                    onToggle={() => setInsumosConferenciaOpen(!insumosConferenciaOpen)}
                    variant="slate"
                  >
                    <div className="space-y-1.5 mt-2">
                      {registro.insumo_principal_nome && registro.peso_programado_kg && (
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-100/80 dark:bg-slate-800/50">
                          <span className="text-xs font-medium">{registro.insumo_principal_nome}</span>
                          <span className="text-xs font-bold tabular-nums">{registro.peso_programado_kg} kg</span>
                        </div>
                      )}
                      {registro.insumosExtras?.map((extra, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-100/80 dark:bg-slate-800/50">
                          <span className="text-xs font-medium">{extra.nome}</span>
                          <span className="text-xs font-bold tabular-nums">
                            {extra.unidade === 'g' 
                              ? formatarPesoExibicao(extra.quantidade_necessaria)
                              : extra.unidade === 'unidade'
                                ? `${extra.quantidade_necessaria % 1 === 0 ? extra.quantidade_necessaria.toFixed(0) : extra.quantidade_necessaria.toFixed(2)} un`
                                : `${extra.quantidade_necessaria.toFixed(2)} ${extra.unidade}`
                            }
                          </span>
                        </div>
                      ))}
                      {registro.usa_embalagem_por_porcao && registro.quantidade_embalagem && registro.insumo_embalagem_nome && (
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-100/80 dark:bg-slate-800/50 mt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-medium">🎁 {registro.insumo_embalagem_nome}</span>
                          <span className="text-xs font-bold tabular-nums">
                            {registro.quantidade_embalagem % 1 === 0 ? registro.quantidade_embalagem.toFixed(0) : registro.quantidade_embalagem.toFixed(1)} {registro.unidade_embalagem || 'un'}
                          </span>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            )}

            {/* FINALIZADO */}
            {columnId === 'finalizado' && (
              <div className="space-y-2 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="grid grid-cols-2 gap-3">
                  {registro.unidades_reais && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Unid. Reais</span>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {registro.unidades_reais}
                        <span className="text-xs font-normal text-muted-foreground ml-1">un</span>
                      </p>
                    </div>
                  )}
                  {registro.peso_final_kg && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Peso Final</span>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {registro.peso_final_kg}
                        <span className="text-xs font-normal text-muted-foreground ml-1">kg</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Calibragem LOTE_MASSEIRA */}
                {registro.unidade_medida === 'lote_masseira' && registro.peso_medio_real_bolinha_g && (
                  <div className={`mt-2 pt-2 border-t ${
                    registro.status_calibracao === 'dentro_do_padrao' 
                      ? 'border-emerald-200 dark:border-emerald-700' 
                      : 'border-red-200 dark:border-red-700'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Calibragem:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{registro.peso_medio_real_bolinha_g.toFixed(1)}g</span>
                        <Badge 
                          variant={registro.status_calibracao === 'dentro_do_padrao' ? 'default' : 'destructive'} 
                          className="text-[10px]"
                        >
                          {registro.status_calibracao === 'dentro_do_padrao' ? '✅ OK' : '⚠️ Fora'}
                        </Badge>
                      </div>
                    </div>
                    {registro.peso_minimo_bolinha_g && registro.peso_maximo_bolinha_g && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Faixa: {registro.peso_minimo_bolinha_g}g - {registro.peso_maximo_bolinha_g}g
                      </p>
                    )}
                  </div>
                )}
                
                {registro.data_fim && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 pt-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>
                      Finalizado às {format(new Date(registro.data_fim), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}

                {/* Seção de Conferência de Insumos - Somente Leitura */}
                {(registro.insumosExtras?.length || registro.insumo_principal_nome) && (
                  <CollapsibleSection
                    title="Insumos Utilizados"
                    icon={<ClipboardList className="h-4 w-4 text-slate-500" />}
                    isOpen={insumosConferenciaOpen}
                    onToggle={() => setInsumosConferenciaOpen(!insumosConferenciaOpen)}
                    variant="slate"
                  >
                    <div className="space-y-1.5 mt-2">
                      {registro.insumo_principal_nome && registro.peso_programado_kg && (
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-100/80 dark:bg-slate-800/50">
                          <span className="text-xs font-medium">{registro.insumo_principal_nome}</span>
                          <span className="text-xs font-bold tabular-nums">{registro.peso_programado_kg} kg</span>
                        </div>
                      )}
                      {registro.insumosExtras?.map((extra, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-100/80 dark:bg-slate-800/50">
                          <span className="text-xs font-medium">{extra.nome}</span>
                          <span className="text-xs font-bold tabular-nums">
                            {extra.unidade === 'g' 
                              ? formatarPesoExibicao(extra.quantidade_necessaria)
                              : extra.unidade === 'unidade'
                                ? `${extra.quantidade_necessaria % 1 === 0 ? extra.quantidade_necessaria.toFixed(0) : extra.quantidade_necessaria.toFixed(2)} un`
                                : `${extra.quantidade_necessaria.toFixed(2)} ${extra.unidade}`
                            }
                          </span>
                        </div>
                      ))}
                      {registro.usa_embalagem_por_porcao && registro.quantidade_embalagem && registro.insumo_embalagem_nome && (
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-100/80 dark:bg-slate-800/50 mt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-medium">🎁 {registro.insumo_embalagem_nome}</span>
                          <span className="text-xs font-bold tabular-nums">
                            {registro.quantidade_embalagem % 1 === 0 ? registro.quantidade_embalagem.toFixed(0) : registro.quantidade_embalagem.toFixed(1)} {registro.unidade_embalagem || 'un'}
                          </span>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            )}

            {/* Detalhamento por Loja - para colunas que não mostram composição */}
            {columnId !== 'a_produzir' && registro.detalhes_lojas && registro.detalhes_lojas.length > 0 && (
              <div className="space-y-1 bg-muted/50 rounded-lg p-2.5 border-l-4 border-primary">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">🏪 Por loja:</p>
                {registro.detalhes_lojas.map((loja) => (
                  <div key={loja.loja_id} className="flex justify-between text-xs py-0.5">
                    <span>{loja.loja_nome}:</span>
                    <span className="font-bold">{loja.quantidade} un</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer: Usuário e Data */}
          <div className="pt-2.5 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium truncate max-w-[150px]">👤 {registro.usuario_nome}</span>
            {registro.data_inicio && columnId === 'a_produzir' && (
              <span>🕐 {format(new Date(registro.data_inicio), 'dd/MM HH:mm', { locale: ptBR })}</span>
            )}
          </div>

          {/* Botões de Ação - esconder quando em modo preview */}
          {columnId !== 'finalizado' && !isPreview && (
            <div className="space-y-2 mt-1">
              {buttonConfig && (
                <Button 
                  onClick={onAction}
                  className="w-full font-medium"
                  variant={estaBloqueado ? 'secondary' : buttonConfig.variant}
                  size="default"
                  disabled={estaBloqueado}
                >
                  {timerAindaRodando ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-pulse" />
                      Aguardando timer
                    </>
                  ) : aguardandoIniciar ? (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Aguardando Iniciar
                    </>
                  ) : estaBloqueadoPorTraco ? (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Bloqueado
                    </>
                  ) : (
                    <>
                      {ButtonIcon && <ButtonIcon className="h-4 w-4 mr-2" />}
                      {buttonConfig.label}
                    </>
                  )}
                </Button>
              )}

              {(columnId === 'em_preparo' || columnId === 'em_porcionamento') && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancelarPreparo}
                    className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRegistrarPerda}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Perda
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
