import { CheckCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: SyncStatus;
  pendingCount: number;
  onRetry?: () => void;
}

export const AutoSaveIndicator = ({ 
  status, 
  pendingCount, 
  onRetry 
}: AutoSaveIndicatorProps) => {
  if (status === 'idle' && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-colors",
          status === 'saving' && "bg-warning/20 text-warning-foreground border border-warning/40",
          status === 'saved' && "bg-success/20 text-success-foreground border border-success/40",
          status === 'error' && "bg-destructive/20 text-destructive border border-destructive/40 cursor-pointer",
          status === 'idle' && pendingCount > 0 && "bg-primary/20 text-primary border border-primary/40"
        )}
        onClick={status === 'error' && onRetry ? onRetry : undefined}
      >
        {status === 'saving' && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Salvando{pendingCount > 1 ? ` (${pendingCount})` : ''}...</span>
          </>
        )}
        
        {status === 'saved' && (
          <>
            <CheckCircle className="h-4 w-4" />
            <span>Salvo</span>
          </>
        )}
        
        {status === 'error' && (
          <>
            <AlertCircle className="h-4 w-4" />
            <span>Erro - Toque para tentar novamente</span>
            <RefreshCw className="h-4 w-4" />
          </>
        )}
        
        {status === 'idle' && pendingCount > 0 && (
          <>
            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
            <span>{pendingCount} alteração{pendingCount > 1 ? 'ões' : ''}</span>
          </>
        )}
      </div>
    </div>
  );
};
