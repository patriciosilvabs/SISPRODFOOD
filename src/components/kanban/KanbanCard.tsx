import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowRight, CheckCircle2, Clock, AlertTriangle, Lock, XCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimerDisplay } from './TimerDisplay';
import { useProductionTimer } from '@/hooks/useProductionTimer';
import { useEffect } from 'react';

interface InsumoExtraComEstoque {
  nome: string;
  quantidade_necessaria: number;
  unidade: string;
  estoque_disponivel: number;
  estoque_suficiente: boolean;
  protecao_ativa?: boolean;
  mensagem_erro?: string;
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
  // Campos da fila de traços
  sequencia_traco?: number;
  lote_producao_id?: string;
  bloqueado_por_traco_anterior?: boolean;
  timer_status?: string;
  total_tracos_lote?: number;
}

type StatusColumn = 'a_produzir' | 'em_preparo' | 'em_porcionamento' | 'finalizado';

interface KanbanCardProps {
  registro: ProducaoRegistro;
  columnId: StatusColumn;
  onAction: () => void;
  onTimerFinished?: (registroId: string) => void;
  onCancelarPreparo?: () => void;
  onRegistrarPerda?: () => void;
}

export function KanbanCard({ registro, columnId, onAction, onTimerFinished, onCancelarPreparo, onRegistrarPerda }: KanbanCardProps) {
  // Hook para gerenciar timer (apenas para EM PREPARO)
  const timerState = useProductionTimer(
    registro.id,
    registro.tempo_timer_minutos || 10,
    registro.timer_ativo || false,
    registro.data_inicio_preparo || null
  );

  // Notificar quando timer acabar - apenas se ainda não foi processado
  useEffect(() => {
    // Só disparar se:
    // 1. Está na coluna em_preparo
    // 2. Timer está finished
    // 3. Callback existe
    // 4. timer_status ainda não é 'concluido' (não foi processado)
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

  // Verificar estoque insuficiente (apenas para coluna "a_produzir")
  const estoqueInsuficiente = columnId === 'a_produzir' && 
    registro.insumo_principal_estoque_kg !== undefined && 
    registro.peso_programado_kg !== null &&
    registro.peso_programado_kg > registro.insumo_principal_estoque_kg;

  // PROTEÇÃO: Ignorar alertas de estoque se proteção ativa
  const temProtecaoAtiva = columnId === 'a_produzir' &&
    registro.insumosExtras?.some(extra => extra.protecao_ativa);

  const temInsumosExtrasInsuficientes = columnId === 'a_produzir' &&
    !temProtecaoAtiva &&
    registro.insumosExtras?.some(extra => !extra.estoque_suficiente && !extra.protecao_ativa);

  // Verificar se está bloqueado (fila de traços)
  const estaBloqueadoPorTraco = registro.bloqueado_por_traco_anterior === true;
  
  // Verificar se timer ainda está rodando (bloqueia "Ir para Porcionamento")
  const timerAindaRodando = columnId === 'em_preparo' && 
    registro.timer_ativo && 
    timerState.isActive && 
    !timerState.isFinished;

  // Combinação de todas as condições de bloqueio
  const estaBloqueado = estaBloqueadoPorTraco || timerAindaRodando;
  
  const temSequenciaTraco = registro.sequencia_traco !== undefined && registro.sequencia_traco !== null;
  const temLote = registro.lote_producao_id !== undefined && registro.lote_producao_id !== null;

  return (
    <Card className={`hover:shadow-md transition-all duration-300 ease-out animate-fade-in ${
      columnId === 'em_preparo' && timerState.isFinished ? 'ring-4 ring-red-500 animate-pulse' : ''
    } ${estaBloqueado ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-2">
            <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <h4 className="font-semibold text-sm leading-tight flex-1">
              {registro.item_nome}
            </h4>
            {/* Badge de sequência do traço */}
            {temSequenciaTraco && temLote && (
              <Badge variant="outline" className="text-xs shrink-0">
                Traço {registro.sequencia_traco}
                {registro.total_tracos_lote && `/${registro.total_tracos_lote}`}
              </Badge>
            )}
          </div>

          {/* Indicador de bloqueio */}
          {estaBloqueado && columnId === 'a_produzir' && (
            <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Lock className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Aguardando traço {(registro.sequencia_traco || 1) - 1} finalizar
              </span>
            </div>
          )}

          {/* Informações por coluna */}
          <div className="space-y-1.5 text-xs">
            {/* A PRODUZIR */}
            {columnId === 'a_produzir' && (
              <>
                {registro.unidades_programadas && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">📦 Total:</span>
                    <Badge variant="secondary" className="font-semibold">
                      {registro.unidade_medida === 'traco' && registro.equivalencia_traco ? (
                        <>
                          {Math.ceil(registro.unidades_programadas / registro.equivalencia_traco)} traços ({Math.ceil(registro.unidades_programadas / registro.equivalencia_traco) * registro.equivalencia_traco} un)
                        </>
                      ) : (
                        `${registro.unidades_programadas} un`
                      )}
                    </Badge>
                  </div>
                )}

                {/* Composição da Produção */}
                {(registro.demanda_lojas || registro.reserva_configurada || registro.sobra_reserva) && (
                  <div className="mt-2 space-y-1 bg-blue-50 dark:bg-blue-950 rounded p-2">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">📊 Composição:</p>
                    {registro.demanda_lojas !== null && registro.demanda_lojas !== undefined && (
                      <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                        <span>• Demanda Lojas:</span>
                        <span className="font-medium">{registro.demanda_lojas} un</span>
                      </div>
                    )}
                    {registro.reserva_configurada !== null && registro.reserva_configurada !== undefined && registro.reserva_configurada > 0 && (
                      <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                        <span>• Reserva do Dia:</span>
                        <span className="font-medium">{registro.reserva_configurada} un</span>
                      </div>
                    )}
                    {registro.sobra_reserva !== null && registro.sobra_reserva !== undefined && registro.sobra_reserva > 0 && (
                      <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                        <span>• Arredondamento:</span>
                        <span className="font-medium">+{registro.sobra_reserva} un</span>
                      </div>
                    )}
                  </div>
                )}

                {/* BANNER DE ERRO CRÍTICO - Proteção Anti-Explosão */}
                {temProtecaoAtiva && (
                  <div className="flex items-center gap-2 text-white bg-red-700 dark:bg-red-800 rounded p-2 mt-2 border-2 border-red-900">
                    <XCircle className="h-5 w-5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold">⛔ ERRO LÓGICO CRÍTICO</p>
                      <p className="text-[10px] mt-0.5 opacity-90">
                        Consumo acima do limite físico possível. Verifique cadastro por lote/traço.
                      </p>
                    </div>
                  </div>
                )}

                {/* Insumos Necessários */}
                {(registro.insumo_principal_nome || (registro.insumosExtras && registro.insumosExtras.length > 0)) && (
                  <div className="mt-2 space-y-1 bg-slate-50 dark:bg-slate-900 rounded p-2">
                    <p className="text-xs font-medium text-muted-foreground">📋 Insumos Necessários:</p>
                    
                    {/* Insumo Principal */}
                    {registro.insumo_principal_nome && registro.peso_programado_kg && (
                      <div className={`flex justify-between text-xs ${estoqueInsuficiente ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                        <span>{registro.insumo_principal_nome}:</span>
                        <span className="font-medium flex items-center gap-1">
                          {registro.peso_programado_kg} kg
                          {estoqueInsuficiente && <AlertTriangle className="h-3 w-3" />}
                        </span>
                      </div>
                    )}
                    
                    {/* Insumos Extras - Bloquear exibição se proteção ativa */}
                    {registro.insumosExtras?.map((extra, idx) => (
                      extra.protecao_ativa ? (
                        <div key={idx} className="flex justify-between text-xs text-red-600 dark:text-red-400">
                          <span>{extra.nome}:</span>
                          <span className="font-medium flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            BLOQUEADO
                          </span>
                        </div>
                      ) : (
                        <div key={idx} className={`flex justify-between text-xs ${!extra.estoque_suficiente ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                          <span>{extra.nome}:</span>
                          <span className="font-medium flex items-center gap-1">
                            {extra.quantidade_necessaria.toFixed(2)} {extra.unidade}
                            {!extra.estoque_suficiente && <AlertTriangle className="h-3 w-3" />}
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                )}

                {/* Alerta de Estoque Insuficiente */}
                {(estoqueInsuficiente || temInsumosExtrasInsuficientes) && (
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded p-2 mt-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold">Estoque insuficiente!</p>
                      {estoqueInsuficiente && registro.insumo_principal_nome && (
                        <p className="text-[10px] mt-0.5">
                          {registro.insumo_principal_nome}: {registro.insumo_principal_estoque_kg} kg disponível
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* EM PREPARO */}
            {columnId === 'em_preparo' && (
              <>
                {/* Timer Display */}
                {registro.timer_ativo && registro.tempo_timer_minutos && timerState.isActive && (
                  <div className="mb-3">
                    <TimerDisplay
                      secondsRemaining={timerState.secondsRemaining}
                      isFinished={timerState.isFinished}
                    />
                  </div>
                )}
                
                {registro.unidades_programadas && (
                  <p className="text-muted-foreground">
                    📦 Programadas: <span className="font-medium">{registro.unidades_programadas} un</span>
                  </p>
                )}
                {registro.data_inicio_preparo && (
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">
                      Em preparo desde {format(new Date(registro.data_inicio_preparo), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* EM PORCIONAMENTO */}
            {columnId === 'em_porcionamento' && (
              <>
                {registro.unidades_programadas && (
                  <p className="text-muted-foreground">
                    📦 Programadas: <span className="font-medium">{registro.unidades_programadas} un</span>
                  </p>
                )}
                {registro.peso_preparo_kg && (
                  <p className="text-muted-foreground">
                    ⚖️ Peso preparo: <span className="font-medium text-foreground">{registro.peso_preparo_kg} kg</span>
                  </p>
                )}
                {registro.sobra_preparo_kg !== null && registro.sobra_preparo_kg !== undefined && (
                  <p className="text-muted-foreground">
                    🗑️ Sobra preparo: <span className="font-medium text-foreground">{registro.sobra_preparo_kg} kg</span>
                  </p>
                )}
                {registro.data_inicio_porcionamento && (
                  <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">
                      Porcionando desde {format(new Date(registro.data_inicio_porcionamento), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* FINALIZADO */}
          {columnId === 'finalizado' && (
            <>
              {registro.unidades_reais && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">✅ Reais:</span>
                  <Badge variant="default" className="font-semibold bg-green-600">
                    {registro.unidades_reais} un
                  </Badge>
                </div>
              )}
              {registro.peso_final_kg && (
                <p className="text-muted-foreground">
                  ⚖️ Peso final: <span className="font-medium text-foreground">{registro.peso_final_kg} kg</span>
                </p>
              )}
              
              
              {registro.data_fim && (
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="font-medium">
                    Finalizado às {format(new Date(registro.data_fim), 'HH:mm', { locale: ptBR })}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Detalhamento por Loja - SEMPRE VISÍVEL */}
          {registro.detalhes_lojas && registro.detalhes_lojas.length > 0 && (
            <div className="space-y-1 bg-muted/50 rounded p-2 border-l-4 border-primary">
              <p className="text-xs font-medium text-muted-foreground">🏪 Por loja:</p>
              {registro.detalhes_lojas.map((loja) => (
                <div key={loja.loja_id} className="flex justify-between text-xs">
                  <span className="text-foreground">{loja.loja_nome}:</span>
                  <span className="font-medium text-foreground">{loja.quantidade} un</span>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* Usuário e Data */}
          <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
            <p className="font-medium">👤 {registro.usuario_nome}</p>
            {registro.data_inicio && columnId === 'a_produzir' && (
              <p>
                🕐 {format(new Date(registro.data_inicio), 'dd/MM HH:mm', { locale: ptBR })}
              </p>
            )}
          </div>

          {/* Botões de Ação */}
          {columnId !== 'finalizado' && (
            <div className="space-y-2 mt-2">
              {/* Botão Principal */}
              {buttonConfig && (
                <Button 
                  onClick={onAction}
                  className="w-full"
                  variant={estaBloqueado ? 'secondary' : buttonConfig.variant}
                  size="sm"
                  disabled={estaBloqueado}
                >
                  {timerAindaRodando ? (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Aguardando timer
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

              {/* Botões de Cancelamento e Perda - apenas para EM PREPARO e EM PORCIONAMENTO */}
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
                    className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
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
