import { Button } from '@/components/ui/button';
import { WeightInputInline } from '@/components/ui/weight-input';
import { 
  Plus, Minus, CheckCircle, AlertTriangle, TrendingUp, Layers, Smartphone 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLongPress } from '@/hooks/useLongPress';
interface ContagemItemCardProps {
  item: {
    id: string;
    nome: string;
    peso_unitario_g: number;
  };
  lojaNome?: string;
  finalSobra: number;
  pesoTotal: string | number;
  idealFromConfig: number;
  aProduzir: number;
  campoTocado: boolean;
  isDirty: boolean;
  isItemNaoPreenchido: boolean;
  sessaoAtiva: boolean;
  isAdmin: boolean;
  showAdminCols: boolean;
  lastUpdate?: string;
  onIncrementSobra: () => void;
  onDecrementSobra: () => void;
  onSobraChange: (value: number) => void;
  onPesoChange: (value: string) => void;
  currentDayLabel: string;
  // Novas props para produção extra
  showProducaoExtra?: boolean;
  onSolicitarProducaoExtra?: () => void;
  // Props para itens lote_masseira
  isLoteMasseira?: boolean;
  lotesNecessarios?: number;
  // Props para rastreamento Cardápio Web
  cardapioWebBaixaTotal?: number;
  cardapioWebUltimaBaixaAt?: string;
  cardapioWebUltimaBaixaQtd?: number;
}

export const ContagemItemCard = ({
  item,
  lojaNome,
  finalSobra,
  pesoTotal,
  idealFromConfig,
  aProduzir,
  campoTocado,
  isDirty,
  isItemNaoPreenchido,
  sessaoAtiva,
  isAdmin,
  showAdminCols,
  lastUpdate,
  onIncrementSobra,
  onDecrementSobra,
  onSobraChange,
  onPesoChange,
  currentDayLabel,
  showProducaoExtra = false,
  onSolicitarProducaoExtra,
  isLoteMasseira = false,
  lotesNecessarios = 0,
  cardapioWebBaixaTotal,
  cardapioWebUltimaBaixaAt,
  cardapioWebUltimaBaixaQtd,
}: ContagemItemCardProps) => {
  // Hooks para segurar e acelerar os botões
  const decrementHandlers = useLongPress({
    onPress: onDecrementSobra,
    initialDelay: 400,
    accelerationSteps: [
      { delay: 0, interval: 150 },
      { delay: 800, interval: 80 },
      { delay: 1500, interval: 40 },
    ],
  });

  const incrementHandlers = useLongPress({
    onPress: onIncrementSobra,
    initialDelay: 400,
    accelerationSteps: [
      { delay: 0, interval: 150 },
      { delay: 800, interval: 80 },
      { delay: 1500, interval: 40 },
    ],
  });

  const getCardClasses = () => {
    if (isItemNaoPreenchido) {
      return 'bg-gray-50 dark:bg-gray-800/50 border-l-amber-400 ring-2 ring-amber-200 dark:ring-amber-800 ring-inset';
    }
    if (isDirty) {
      return 'bg-gray-50 dark:bg-gray-800/50 border-l-amber-400';
    }
    if (campoTocado) {
      return 'bg-gray-50 dark:bg-gray-800/50 border-l-emerald-400';
    }
    return 'bg-white dark:bg-gray-900 border-l-blue-500 hover:shadow-md';
  };

  return (
    <div 
      className={`flex flex-col md:flex-row md:items-center gap-3 p-4 
                  border-2 rounded-xl shadow-sm
                  border-l-4 transition-all
                  ${getCardClasses()}`}
    >
      {/* Nome e Status */}
      <div className="flex-1 min-w-0">
        {lojaNome && (
          <p className="text-xs text-primary font-medium mb-0.5">{lojaNome}</p>
        )}
        <div className="flex items-center gap-2">
          {campoTocado && (
            <CheckCircle className="h-4 w-4 text-success shrink-0" />
          )}
          <span className="font-semibold text-sm uppercase tracking-wide text-gray-900 dark:text-gray-100 truncate">
            {item.nome}
          </span>
        </div>
        {lastUpdate && (
          <p className="text-xs text-muted-foreground mt-1">
            Atualizado: {format(new Date(lastUpdate), "dd/MM HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>

      {/* Controles de Sobra e Peso */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Controle de Quantidade */}
        <div className="flex items-center">
          <Button 
            type="button"
            variant="default" 
            size="icon" 
            className="h-12 w-12 rounded-l-xl rounded-r-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm select-none"
            {...decrementHandlers}
          >
            <Minus className="h-5 w-5" />
          </Button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={finalSobra}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              onSobraChange(val === '' ? 0 : parseInt(val, 10));
            }}
            className={`h-12 w-16 text-center text-xl font-bold border-y-2 focus:outline-none focus:ring-2 focus:ring-primary ${
              isItemNaoPreenchido 
                ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-400' 
                : 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-blue-500'
            }`}
          />
          <Button 
            type="button"
            variant="default" 
            size="icon" 
            className="h-12 w-12 rounded-r-xl rounded-l-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm select-none"
            {...incrementHandlers}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Campo de Peso */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 bg-background min-w-[120px]">
          <span className="text-xs text-muted-foreground font-medium">Peso</span>
          <WeightInputInline
            value={String(pesoTotal ?? '')}
            onChange={onPesoChange}
            placeholder="0"
          />
          <span className="text-xs text-muted-foreground">g</span>
        </div>

        {/* Coluna Ideal - apenas para admin com detalhes */}
        {showAdminCols && (
          <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl border-2 min-w-[80px] ${
            idealFromConfig === 0 
              ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400' 
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Ideal ({currentDayLabel})
            </span>
            {idealFromConfig === 0 ? (
              <span className="text-xs flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" />
                N/C
              </span>
            ) : (
              <span className="text-base font-bold text-gray-900 dark:text-gray-100">{idealFromConfig}</span>
            )}
          </div>
        )}

        {/* Coluna Cardápio Web - mostra baixas automáticas */}
        {cardapioWebBaixaTotal && cardapioWebBaixaTotal > 0 && (
          <div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl min-w-[100px] 
                          bg-violet-100 dark:bg-violet-900/50 border border-violet-300 dark:border-violet-700">
            <span className="text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-400 flex items-center gap-1">
              <Smartphone className="h-3 w-3" />
              Cardápio Web
            </span>
            {cardapioWebUltimaBaixaAt && cardapioWebUltimaBaixaQtd && (
              <span className="text-sm font-bold text-violet-700 dark:text-violet-300">
                -{cardapioWebUltimaBaixaQtd} às {format(new Date(cardapioWebUltimaBaixaAt), 'HH:mm')}
              </span>
            )}
            <span className="text-[10px] text-violet-500 dark:text-violet-400">
              Total: -{cardapioWebBaixaTotal} un hoje
            </span>
          </div>
        )}

        {/* A Produzir - SEMPRE VISÍVEL para todos */}
        <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl min-w-[80px] ${
          aProduzir > 0 
            ? 'bg-amber-500 dark:bg-amber-600 text-white' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
        }`}>
          <span className="text-[10px] uppercase tracking-wide opacity-80">A Produzir</span>
          <span className="text-base font-bold">{aProduzir}</span>
        </div>

        {/* Lotes Necessários - apenas para itens lote_masseira */}
        {isLoteMasseira && lotesNecessarios > 0 && (
          <div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl min-w-[70px] bg-blue-500 dark:bg-blue-600 text-white">
            <span className="text-[10px] uppercase tracking-wide opacity-80 flex items-center gap-1">
              <Layers className="h-3 w-3" />
              Lotes
            </span>
            <span className="text-base font-bold">{lotesNecessarios}</span>
          </div>
        )}

        {/* Botão Produção Extra */}
        {showProducaoExtra && onSolicitarProducaoExtra && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSolicitarProducaoExtra}
            className="h-10 gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Extra</span>
          </Button>
        )}
      </div>
    </div>
  );
};
