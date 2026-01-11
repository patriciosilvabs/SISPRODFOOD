import { useState, useEffect } from "react";
import { KanbanCard } from "./KanbanCard";
import { StackProgress } from "./StackProgress";
import { cn } from "@/lib/utils";

interface InsumoExtraComEstoque {
  nome: string;
  quantidade_necessaria: number;
  unidade: string;
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
        
        {/* Indicadores dos próximos lotes (pontinha visual) */}
        {registrosAguardando.length > 0 && (
          <div className="flex flex-col gap-1.5 justify-center py-2">
            {/* Badge com total de lotes aguardando */}
            <div className="text-[10px] text-muted-foreground text-center font-medium mb-1">
              Aguardando
            </div>
            
            {indicadoresVisiveis.map((reg, idx) => (
              <div 
                key={reg.id}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  "text-sm font-semibold transition-all duration-200",
                  "border-2 border-dashed",
                  idx === 0 
                    ? "bg-muted/80 border-muted-foreground/30 text-muted-foreground" 
                    : "bg-muted/40 border-muted-foreground/15 text-muted-foreground/60"
                )}
                style={{ 
                  opacity: 1 - (idx * 0.15),
                  transform: `scale(${1 - (idx * 0.03)})`
                }}
                title={`Lote ${reg.sequencia_traco}/${reg.total_tracos_lote || registros.length} - Aguardando lote anterior`}
              >
                {reg.sequencia_traco}
              </div>
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
  );
}
