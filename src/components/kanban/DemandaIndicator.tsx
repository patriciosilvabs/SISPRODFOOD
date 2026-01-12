import { Badge } from '@/components/ui/badge';
import { Lock, TrendingUp, Store, Target } from 'lucide-react';

interface DemandaIndicatorProps {
  demandaLojas: number | null | undefined;
  demandaCongelada: number | null | undefined;
  demandaIncremental: number | null | undefined;
  demandaBase: number | null | undefined;
  compact?: boolean;
}

export function DemandaIndicator({
  demandaLojas,
  demandaCongelada,
  demandaIncremental,
  demandaBase,
  compact = false,
}: DemandaIndicatorProps) {
  const temCutoff = demandaCongelada !== null && demandaCongelada !== undefined;

  if (!temCutoff) {
    // Antes do cutoff - mostrar apenas demanda lojas
    if (demandaLojas === null || demandaLojas === undefined) {
      return null;
    }

    return (
      <div className="flex items-center gap-2 text-xs">
        <Store className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">Demanda:</span>
        <span className="font-medium">{demandaLojas} un</span>
      </div>
    );
  }

  // Depois do cutoff - mostrar congelada + incremental
  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700">
          <Lock className="h-3 w-3 mr-1" />
          {demandaCongelada}
        </Badge>
        
        {(demandaIncremental ?? 0) > 0 && (
          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700">
            <TrendingUp className="h-3 w-3 mr-1" />
            +{demandaIncremental}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 bg-gradient-to-r from-blue-50 to-orange-50 dark:from-blue-950 dark:to-orange-950 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-1.5 text-xs">
        <Lock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
        <span className="text-blue-600 dark:text-blue-400">Congelada:</span>
        <span className="font-semibold text-blue-700 dark:text-blue-300">{demandaCongelada} un</span>
      </div>

      {(demandaIncremental ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <TrendingUp className="h-3 w-3 text-orange-600 dark:text-orange-400" />
          <span className="text-orange-600 dark:text-orange-400">Incremental:</span>
          <span className="font-semibold text-orange-700 dark:text-orange-300">+{demandaIncremental} un</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs border-t border-blue-200 dark:border-blue-700 pt-1.5 mt-1">
        <Target className="h-3 w-3 text-primary" />
        <span className="font-medium">Base Total:</span>
        <span className="font-bold text-primary">{demandaBase} un</span>
      </div>
    </div>
  );
}

// Badge para indicar que é pós-cutoff
export function PostCutoffBadge({ demandaIncremental }: { demandaIncremental: number | null | undefined }) {
  if (!demandaIncremental || demandaIncremental <= 0) {
    return null;
  }

  return (
    <Badge 
      variant="outline" 
      className="bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700 text-xs"
    >
      <TrendingUp className="h-3 w-3 mr-1" />
      Pós-Cutoff
    </Badge>
  );
}
