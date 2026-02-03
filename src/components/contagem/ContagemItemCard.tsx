import { Button } from '@/components/ui/button';
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
      className={`flex flex-col lg:flex-row lg:items-center gap-3 p-4 
                  border-2 rounded-xl shadow-sm
                  border-l-4 transition-all
                  ${getCardClasses()}`}
    >
      {/* Área do Nome (lado esquerdo) */}
      <div className="flex-shrink-0 lg:w-[280px]">
        {lojaNome && (
          <p className="text-xs text-primary font-medium mb-0.5">{lojaNome}</p>
        )}
        <div className="flex items-center gap-2">
          {campoTocado && (
            <CheckCircle className="h-4 w-4 text-success shrink-0" />
          )}
          <span className="font-semibold text-sm uppercase tracking-wide text-foreground truncate">
            {item.nome}
          </span>
        </div>
        {lastUpdate && (
          <p className="text-xs text-muted-foreground mt-1">
            Atualizado: {format(new Date(lastUpdate), "dd/MM HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>

      {/* Grid de Colunas Fixas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 flex-1 lg:ml-6">
        {/* SOBRA */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-primary uppercase tracking-wide font-medium mb-1">
            SOBRA
          </span>
          <div className="flex items-center">
            <Button 
              type="button"
              variant="default" 
              size="icon" 
              className="h-10 w-10 rounded-l-lg rounded-r-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm select-none"
              {...decrementHandlers}
            >
              <Minus className="h-4 w-4" />
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
              className={`h-10 w-14 text-center text-lg font-bold border-y-2 focus:outline-none focus:ring-2 focus:ring-primary ${
                isItemNaoPreenchido 
                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-400' 
                  : 'bg-background text-primary border-primary'
              }`}
            />
            <Button 
              type="button"
              variant="default" 
              size="icon" 
              className="h-10 w-10 rounded-r-lg rounded-l-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm select-none"
              {...incrementHandlers}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* EST. IDEAL */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">
            EST. IDEAL
          </span>
          <div className={`rounded-lg px-4 py-2 min-w-[70px] text-center border ${
            idealFromConfig === 0 
              ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700' 
              : 'bg-muted border-border'
          }`}>
            {idealFromConfig === 0 ? (
              <span className="text-sm flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                N/C
              </span>
            ) : (
              <span className="text-lg font-bold text-foreground">{idealFromConfig}</span>
            )}
          </div>
        </div>

        {/* C. WEB - sempre visível */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1 flex items-center gap-1">
            <Smartphone className="h-3 w-3" />
            C. WEB
          </span>
          <div className={`rounded-lg px-4 py-2 min-w-[70px] text-center border ${
            cardapioWebBaixaTotal && cardapioWebBaixaTotal > 0
              ? 'bg-violet-100 dark:bg-violet-900/50 border-violet-300 dark:border-violet-700'
              : 'bg-muted border-border'
          }`}>
            <span className={`text-lg font-bold ${
              cardapioWebBaixaTotal && cardapioWebBaixaTotal > 0
                ? 'text-violet-700 dark:text-violet-300'
                : 'text-muted-foreground'
            }`}>
              {cardapioWebBaixaTotal || 0}
            </span>
          </div>
        </div>

        {/* PRODUZIR */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">
            PRODUZIR
          </span>
          <div className={`rounded-lg px-4 py-2 min-w-[70px] text-center ${
            aProduzir > 0 
              ? 'bg-amber-500 dark:bg-amber-600 text-white' 
              : 'bg-muted border border-border text-muted-foreground'
          }`}>
            <span className="text-lg font-bold">{aProduzir}</span>
          </div>
        </div>

        {/* LOTES - condicional para itens lote_masseira */}
        {isLoteMasseira && (
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1 flex items-center gap-1">
              <Layers className="h-3 w-3" />
              LOTES
            </span>
            <div className={`rounded-lg px-4 py-2 min-w-[70px] text-center ${
              lotesNecessarios > 0 
                ? 'bg-blue-500 dark:bg-blue-600 text-white' 
                : 'bg-muted border border-border text-muted-foreground'
            }`}>
              <span className="text-lg font-bold">{lotesNecessarios}</span>
            </div>
          </div>
        )}

        {/* Botão Produção Extra */}
        {showProducaoExtra && onSolicitarProducaoExtra && (
          <div className="flex flex-col items-center justify-end">
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
          </div>
        )}
      </div>
    </div>
  );
};
