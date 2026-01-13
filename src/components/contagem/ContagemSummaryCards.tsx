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
      <Card className="border rounded-xl shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-shadow border-l-4 border-l-blue-400">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Itens</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalItens}</p>
        </CardContent>
      </Card>

      <Card className="border rounded-xl shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-shadow border-l-4 border-l-blue-400">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Scale className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Peso Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatWeight(pesoTotalG)}</p>
        </CardContent>
      </Card>

      <Card className={`border rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 ${
        itensPendentes > 0 
          ? 'bg-gray-50 dark:bg-gray-800/50 border-l-amber-400' 
          : 'bg-gray-50 dark:bg-gray-800/50 border-l-emerald-400'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Pendentes</span>
          </div>
          <p className={`text-2xl font-bold ${
            itensPendentes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {itensPendentes}
          </p>
        </CardContent>
      </Card>

      <Card className="border rounded-xl shadow-sm bg-white dark:bg-gray-900 hover:shadow-md transition-shadow border-l-4 border-l-gray-300 dark:border-l-gray-600">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <RefreshCw className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Atualização</span>
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
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
