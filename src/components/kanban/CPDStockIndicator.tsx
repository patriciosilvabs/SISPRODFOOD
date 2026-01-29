import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Package, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CPDStockItem {
  item_id: string;
  item_nome: string;
  estoque_cpd: number;
  demanda_lojas: number;
  saldo_liquido: number; // demanda - estoque (negativo = suficiente)
}

interface CPDStockIndicatorProps {
  estoquesCPD: CPDStockItem[];
}

export function CPDStockIndicator({ estoquesCPD }: CPDStockIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filtrar apenas itens com demanda e estoque suficiente (saldo <= 0)
  const itensSuficientes = estoquesCPD.filter(e => e.demanda_lojas > 0 && e.saldo_liquido <= 0);
  
  const totalItens = itensSuficientes.length;
  const totalDemanda = itensSuficientes.reduce((sum, item) => sum + item.demanda_lojas, 0);
  const totalEstoque = itensSuficientes.reduce((sum, item) => sum + item.estoque_cpd, 0);

  // Ordenar por saldo (itens com mais folga primeiro)
  const sortedEstoques = [...itensSuficientes].sort((a, b) => a.saldo_liquido - b.saldo_liquido);

  if (totalItens === 0) {
    return null;
  }

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
          {totalItens} {totalItens === 1 ? 'item cobre' : 'itens cobrem'} demanda total de {totalDemanda} un
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
            Ocultar detalhes
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            Ver demanda vs estoque
          </>
        )}
      </button>

      {/* Lista de itens (colapsável) */}
      {isExpanded && (
        <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-emerald-950/50 divide-y divide-emerald-100 dark:divide-emerald-800">
          {sortedEstoques.map((item, index) => {
            const sobra = item.estoque_cpd - item.demanda_lojas;
            return (
              <div 
                key={`${item.item_id}-${index}`}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                  {item.item_nome}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap">
                    Demanda: {item.demanda_lojas}
                  </span>
                  <Badge 
                    variant="secondary" 
                    className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0"
                  >
                    Estoque: {item.estoque_cpd}
                  </Badge>
                  {sobra > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      (+{sobra})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mensagem de dica */}
      <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400 mt-2">
        <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>O estoque atual atende toda a demanda. Nenhuma produção necessária agora.</span>
      </div>
    </div>
  );
}
