import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Package, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CPDStockItem {
  item_nome: string;
  quantidade: number;
}

interface CPDStockIndicatorProps {
  estoquesCPD: CPDStockItem[];
}

export function CPDStockIndicator({ estoquesCPD }: CPDStockIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalItens = estoquesCPD.length;
  const totalUnidades = estoquesCPD.reduce((sum, item) => sum + item.quantidade, 0);

  // Ordenar por quantidade (maior para menor)
  const sortedEstoques = [...estoquesCPD].sort((a, b) => b.quantidade - a.quantidade);

  return (
    <div className="rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3 animate-fade-in">
      {/* Header com ícone e título */}
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
          Estoque CPD Suficiente
        </span>
      </div>

      {/* Resumo */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
        <Package className="h-4 w-4" />
        <span>
          {totalItens} {totalItens === 1 ? 'item' : 'itens'} • {totalUnidades} {totalUnidades === 1 ? 'unidade disponível' : 'unidades disponíveis'}
        </span>
      </div>

      {/* Botão para expandir/colapsar lista */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-1 text-sm font-medium transition-colors",
          "text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200"
        )}
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-4 w-4" />
            Ocultar itens
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            Ver itens em estoque
          </>
        )}
      </button>

      {/* Lista de itens (colapsável) */}
      {isExpanded && (
        <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/50 divide-y divide-emerald-100 dark:divide-emerald-800">
          {sortedEstoques.map((item, index) => (
            <div 
              key={`${item.item_nome}-${index}`}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className="text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                {item.item_nome}
              </span>
              <Badge 
                variant="secondary" 
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0"
              >
                {item.quantidade} un
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Mensagem de dica */}
      <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 mt-2">
        <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>Nenhuma produção necessária agora</span>
      </div>
    </div>
  );
}
