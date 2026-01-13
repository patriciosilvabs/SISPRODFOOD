import { Card, CardContent } from '@/components/ui/card';
import { Package, Scale, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContagemSummaryCardsProps {
  totalItens: number;
  pesoTotalG: number;
  itensPendentes: number;
  ultimaAtualizacao?: Date;
}

export const ContagemSummaryCards = ({
  totalItens,
  pesoTotalG,
  itensPendentes,
  ultimaAtualizacao,
}: ContagemSummaryCardsProps) => {
  const formatWeight = (grams: number) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(1)} kg`;
    }
    return `${grams} g`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card className="border-2 rounded-xl shadow-sm bg-card hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Itens</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalItens}</p>
        </CardContent>
      </Card>

      <Card className="border-2 rounded-xl shadow-sm bg-card hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Scale className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Peso Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatWeight(pesoTotalG)}</p>
        </CardContent>
      </Card>

      <Card className={`border-2 rounded-xl shadow-sm hover:shadow-md transition-shadow ${
        itensPendentes > 0 
          ? 'bg-warning/10 border-warning/50' 
          : 'bg-success/10 border-success/50'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Pendentes</span>
          </div>
          <p className={`text-2xl font-bold ${
            itensPendentes > 0 ? 'text-warning' : 'text-success'
          }`}>
            {itensPendentes}
          </p>
        </CardContent>
      </Card>

      <Card className="border-2 rounded-xl shadow-sm bg-card hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <RefreshCw className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Atualização</span>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {ultimaAtualizacao 
              ? format(ultimaAtualizacao, "HH:mm", { locale: ptBR })
              : '--:--'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
