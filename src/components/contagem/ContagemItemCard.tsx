import { Button } from '@/components/ui/button';
import { WeightInputInline } from '@/components/ui/weight-input';
import { 
  Plus, Minus, CheckCircle, AlertTriangle, TrendingUp 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContagemItemCardProps {
  item: {
    id: string;
    nome: string;
    peso_unitario_g: number;
  };
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
  onPesoChange: (value: string) => void;
  currentDayLabel: string;
  // Novas props para produção extra
  showProducaoExtra?: boolean;
  onSolicitarProducaoExtra?: () => void;
}

export const ContagemItemCard = ({
  item,
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
  onPesoChange,
  currentDayLabel,
  showProducaoExtra = false,
  onSolicitarProducaoExtra,
}: ContagemItemCardProps) => {
  const getCardClasses = () => {
    if (isItemNaoPreenchido) {
      return 'bg-warning/5 border-l-warning ring-2 ring-warning/30 ring-inset';
    }
    if (isDirty) {
      return 'bg-warning/10 border-l-warning';
    }
    if (campoTocado) {
      return 'bg-success/5 border-l-success';
    }
    return 'bg-card border-l-primary hover:shadow-md';
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

      {/* Controles de Sobra e Peso */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Controle de Quantidade */}
        <div className="flex items-center">
          <Button 
            type="button"
            variant="default" 
            size="icon" 
            className="h-12 w-12 rounded-l-xl rounded-r-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            onClick={onDecrementSobra}
          >
            <Minus className="h-5 w-5" />
          </Button>
          <div className={`h-12 w-16 flex items-center justify-center text-xl font-bold border-y-2 ${
            isItemNaoPreenchido 
              ? 'bg-warning/10 text-warning border-warning' 
              : 'bg-background text-primary border-primary'
          }`}>
            {finalSobra}
          </div>
          <Button 
            type="button"
            variant="default" 
            size="icon" 
            className="h-12 w-12 rounded-r-xl rounded-l-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            onClick={onIncrementSobra}
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

        {/* Colunas Admin */}
        {showAdminCols && (
          <>
            <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl border-2 min-w-[80px] ${
              idealFromConfig === 0 
                ? 'bg-warning/10 border-warning/50 text-warning' 
                : 'bg-muted border-input'
            }`}>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Ideal ({currentDayLabel})
              </span>
              {idealFromConfig === 0 ? (
                <span className="text-xs flex items-center gap-0.5">
                  <AlertTriangle className="h-3 w-3" />
                  N/C
                </span>
              ) : (
                <span className="text-base font-bold">{idealFromConfig}</span>
              )}
            </div>

            <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl min-w-[80px] ${
              aProduzir > 0 
                ? 'bg-warning text-warning-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}>
              <span className="text-[10px] uppercase tracking-wide opacity-80">A Produzir</span>
              <span className="text-base font-bold">{aProduzir}</span>
            </div>
          </>
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
