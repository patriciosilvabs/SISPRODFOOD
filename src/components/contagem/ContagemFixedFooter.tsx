import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, Save } from 'lucide-react';

interface ContagemFixedFooterProps {
  isSessaoAtiva: boolean;
  podeEncerrar: boolean;
  savingAll: boolean;
  hasChanges: boolean;
  itensPendentes: number;
  changesCount: number;
  onEncerrar: () => void;
  onSaveAll: () => void;
}

export const ContagemFixedFooter = ({
  isSessaoAtiva,
  podeEncerrar,
  savingAll,
  hasChanges,
  itensPendentes,
  changesCount,
  onEncerrar,
  onSaveAll,
}: ContagemFixedFooterProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t-2 shadow-lg z-50">
      <div className="max-w-4xl mx-auto flex justify-end gap-3">
        {isSessaoAtiva ? (
          <Button 
            onClick={onEncerrar}
            disabled={!podeEncerrar || savingAll}
            size="lg"
            className={`h-14 px-8 text-lg font-bold rounded-xl shadow-md transition-all ${
              podeEncerrar 
                ? 'bg-success hover:bg-success/90 text-success-foreground' 
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {savingAll ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Salvando e verificando...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                ENCERRAR CONTAGEM
                {!podeEncerrar && itensPendentes > 0 && (
                  <span className="ml-2 bg-foreground/10 px-2 py-0.5 rounded-lg text-sm">
                    {itensPendentes} pendente(s)
                  </span>
                )}
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={onSaveAll}
            disabled={!hasChanges || savingAll}
            size="lg"
            className="h-14 px-8 text-lg font-bold rounded-xl shadow-md bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
          >
            {savingAll ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                SALVAR ALTERAÇÕES
                {hasChanges && changesCount > 0 && (
                  <span className="ml-2 bg-primary-foreground/20 px-2 py-0.5 rounded-lg text-sm">
                    {changesCount} alteração(ões)
                  </span>
                )}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
