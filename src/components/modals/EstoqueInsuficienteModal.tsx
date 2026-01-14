import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, ArrowRight, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface InsumoLimitante {
  nome: string;
  quantidadeNecessaria: number;
  estoqueDisponivel: number;
  unidade: string;
}

interface EstoqueInsuficienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (unidadesAgora: number, unidadesPendentes: number) => void;
  itemNome: string;
  unidadesProgramadas: number;
  unidadesProduziveis: number;
  insumoLimitante: InsumoLimitante;
}

export function EstoqueInsuficienteModal({
  open,
  onOpenChange,
  onConfirm,
  itemNome,
  unidadesProgramadas,
  unidadesProduziveis,
  insumoLimitante,
}: EstoqueInsuficienteModalProps) {
  const unidadesPendentes = unidadesProgramadas - unidadesProduziveis;
  const faltando = insumoLimitante.quantidadeNecessaria - insumoLimitante.estoqueDisponivel;

  const handleConfirm = () => {
    onConfirm(unidadesProduziveis, unidadesPendentes);
    onOpenChange(false);
  };

  // Formatar valor com unidade
  const formatarValor = (valor: number, unidade: string) => {
    if (unidade === 'g') {
      if (valor >= 1000) {
        return `${(valor / 1000).toFixed(2)} kg`;
      }
      return `${valor.toFixed(0)} g`;
    }
    return `${valor.toFixed(2)} ${unidade}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Estoque Insuficiente
          </DialogTitle>
          <DialogDescription>
            O insumo <span className="font-semibold text-foreground">{insumoLimitante.nome}</span> não 
            possui estoque suficiente para produzir todas as{' '}
            <span className="font-semibold text-foreground">{unidadesProgramadas}</span> unidades 
            de <span className="font-semibold text-foreground">{itemNome}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Detalhes do estoque */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Necessário:</span>
              <span className="font-semibold tabular-nums">
                {formatarValor(insumoLimitante.quantidadeNecessaria, insumoLimitante.unidade)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Disponível:</span>
              <span className="font-semibold text-amber-600 tabular-nums">
                {formatarValor(insumoLimitante.estoqueDisponivel, insumoLimitante.unidade)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-t pt-2">
              <span className="text-muted-foreground">Faltando:</span>
              <span className="font-semibold text-destructive tabular-nums">
                {formatarValor(faltando, insumoLimitante.unidade)}
              </span>
            </div>
          </div>

          {/* Proposta de divisão */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Com o estoque atual, você pode produzir:
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-lg p-3 border border-primary/30">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Agora</span>
                </div>
                <p className="text-2xl font-bold text-primary tabular-nums">
                  {unidadesProduziveis}
                  <span className="text-sm font-normal text-muted-foreground ml-1">un</span>
                </p>
              </div>
              
              <div className="bg-background rounded-lg p-3 border border-amber-300/50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Depois</span>
                </div>
                <p className="text-2xl font-bold text-amber-600 tabular-nums">
                  {unidadesPendentes}
                  <span className="text-sm font-normal text-muted-foreground ml-1">un</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <ArrowRight className="h-3 w-3" />
              <span>As {unidadesPendentes} unidades pendentes ficarão aguardando reabastecimento</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <Package className="h-4 w-4" />
            Produzir {unidadesProduziveis} agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
