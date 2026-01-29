import { useState, useEffect } from "react";
import { KanbanCard } from "./KanbanCard";
import { StackProgress } from "./StackProgress";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye } from "lucide-react";

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
}

type StatusColumn = 'a_produzir' | 'em_preparo' | 'em_porcionamento' | 'finalizado';

interface CardStackProps {
  registros: ProducaoRegistro[];
  columnId: StatusColumn;
  onAction: (registro: ProducaoRegistro) => void;
  onTimerFinished?: (registroId: string) => void;
  onCancelarPreparo?: (registro: ProducaoRegistro) => void;
  onRegistrarPerda?: (registro: ProducaoRegistro) => void;
}

export function CardStack({
  registros,
  columnId,
  onAction,
  onTimerFinished,
  onCancelarPreparo,
  onRegistrarPerda,
}: CardStackProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loteVisualizando, setLoteVisualizando] = useState<ProducaoRegistro | null>(null);

  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  const handleCardAction = (registro: ProducaoRegistro) => {
    setIsTransitioning(true);
    onAction(registro);
  };

  if (registros.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Nenhum item nesta coluna
      </div>
    );
  }

  // Primeiro registro é o ativo, os demais aguardam
  const registroAtivo = registros[0];
  const registrosAguardando = registros.slice(1);
  const maxIndicadoresVisiveis = 4;
  const indicadoresVisiveis = registrosAguardando.slice(0, maxIndicadoresVisiveis);
  const lotesRestantes = registrosAguardando.length - maxIndicadoresVisiveis;

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Indicador de progresso da pilha */}
        <StackProgress 
          total={registros.length} 
          atual={0} 
        />
        
        {/* Container horizontal: Card ativo + Indicadores */}
        <div className="flex items-stretch gap-3">
          {/* Card ativo (Lote atual) - ocupa a maior parte */}
          <div 
            className={cn(
              "flex-1 min-w-0 transition-all duration-300 ease-in-out",
              isTransitioning && "animate-fade-in"
            )}
          >
            <KanbanCard
              registro={registroAtivo}
              columnId={columnId}
              onAction={() => handleCardAction(registroAtivo)}
              onTimerFinished={onTimerFinished}
              onCancelarPreparo={() => onCancelarPreparo?.(registroAtivo)}
              onRegistrarPerda={() => onRegistrarPerda?.(registroAtivo)}
            />
          </div>
          
          {/* Indicadores dos próximos lotes (pontinha visual) - agora clicáveis */}
          {registrosAguardando.length > 0 && (
            <div className="flex flex-col gap-1.5 justify-center py-2">
              {/* Badge com total de lotes aguardando */}
              <div className="text-[10px] text-muted-foreground text-center font-medium mb-1">
                Aguardando
              </div>
              
              {indicadoresVisiveis.map((reg, idx) => (
                <button 
                  key={reg.id}
                  onClick={() => setLoteVisualizando(reg)}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    "text-sm font-semibold transition-all duration-200",
                    "border-2 border-dashed cursor-pointer",
                    "hover:border-primary/50 hover:bg-primary/10 hover:scale-105",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30",
                    idx === 0 
                      ? "bg-muted/80 border-muted-foreground/30 text-muted-foreground" 
                      : "bg-muted/40 border-muted-foreground/15 text-muted-foreground/60"
                  )}
                  style={{ 
                    opacity: 1 - (idx * 0.15),
                    transform: `scale(${1 - (idx * 0.03)})`
                  }}
                  title={`Clique para visualizar Lote ${reg.sequencia_traco}`}
                >
                  {reg.sequencia_traco}
                </button>
              ))}
              
              {/* Indicador de lotes extras */}
              {lotesRestantes > 0 && (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted/20 border-2 border-dashed border-muted-foreground/10 text-xs text-muted-foreground/50"
                  title={`Mais ${lotesRestantes} lote(s) aguardando`}
                >
                  +{lotesRestantes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sheet para visualização do lote */}
      <Sheet open={!!loteVisualizando} onOpenChange={() => setLoteVisualizando(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
              Visualização - Lote {loteVisualizando?.sequencia_traco}/{loteVisualizando?.total_tracos_lote}
            </SheetTitle>
            <Badge variant="secondary" className="w-fit">
              <Clock className="h-3 w-3 mr-1" />
              Aguardando lote anterior
            </Badge>
          </SheetHeader>
          
          {loteVisualizando && (
            <div className="mt-4">
              <KanbanCard 
                registro={loteVisualizando}
                columnId={columnId}
                onAction={() => {}}
                isPreview
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}