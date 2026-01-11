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

  const getCardStyle = (index: number): string => {
    if (index === 0) {
      return "z-30 scale-100 translate-y-0 opacity-100";
    }
    
    if (index === 1) {
      return "z-20 scale-[0.95] translate-y-3 opacity-70 pointer-events-none";
    }
    
    if (index === 2) {
      return "z-10 scale-[0.90] translate-y-6 opacity-40 pointer-events-none";
    }
    
    return "hidden";
  };

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

  return (
    <div className="flex flex-col">
      {/* Indicador de progresso */}
      <StackProgress 
        total={registros.length} 
        atual={0} 
      />
      
      {/* Container da pilha */}
      <div 
        className="relative"
        style={{ 
          height: `${Math.min(450, 350 + (Math.min(registros.length - 1, 2) * 12))}px`,
          perspective: '1000px'
        }}
      >
        {registros.slice(0, 3).map((registro, index) => {
          const cardStyle = getCardStyle(index);
          
          return (
            <div
              key={registro.id}
              className={cn(
                "absolute top-0 left-0 right-0 transition-all duration-300 ease-in-out",
                cardStyle
              )}
            >
              <KanbanCard
                registro={registro}
                columnId={columnId}
                onAction={() => handleCardAction(registro)}
                onTimerFinished={onTimerFinished}
                onCancelarPreparo={() => onCancelarPreparo?.(registro)}
                onRegistrarPerda={() => onRegistrarPerda?.(registro)}
              />
            </div>
          );
        })}
      </div>
      
      {/* Indicador de cards restantes */}
      {registros.length > 1 && (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          {registros.length - 1} {registros.length - 1 === 1 ? 'lote aguardando' : 'lotes aguardando'}
        </div>
      )}
    </div>
  );
}
