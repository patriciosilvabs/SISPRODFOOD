import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Package, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface BacklogItem {
  id: string;
  item_id: string;
  item_nome: string;
  quantidade_pendente: number;
  gatilho_minimo: number;
  estoque_cpd: number;
  saldo_liquido: number;
  status: string;
  data_referencia: string;
}

interface BacklogIndicatorProps {
  backlogItems: BacklogItem[];
  onForcarProducao?: (itemId: string, itemNome: string) => void;
  className?: string;
}

export function BacklogIndicator({
  backlogItems,
  onForcarProducao,
  className,
}: BacklogIndicatorProps) {
  const itensAguardando = useMemo(() => {
    return backlogItems.filter(item => item.status === 'aguardando_gatilho');
  }, [backlogItems]);

  if (itensAguardando.length === 0) {
    return null;
  }

  return (
    <Alert 
      className={cn(
        "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700",
        className
      )}
    >
      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
        <span>Itens Aguardando Gatilho Mínimo</span>
        <Badge 
          variant="outline" 
          className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-600"
        >
          {itensAguardando.length} {itensAguardando.length === 1 ? 'item' : 'itens'}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-3">
        <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
          Os itens abaixo não atingiram o volume mínimo para iniciar produção. 
          A demanda será acumulada até atingir o gatilho.
        </p>
        
        <div className="space-y-3">
          {itensAguardando.map((item) => {
            const progressPercent = item.gatilho_minimo > 0 
              ? Math.min(100, (item.saldo_liquido / item.gatilho_minimo) * 100)
              : 0;
            const faltando = item.gatilho_minimo - item.saldo_liquido;
            
            return (
              <div 
                key={item.id} 
                className="p-3 bg-white dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium text-sm text-amber-900 dark:text-amber-100">
                      {item.item_nome}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline"
                      className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300"
                    >
                      {item.saldo_liquido}/{item.gatilho_minimo} un
                    </Badge>
                    
                    {onForcarProducao && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/50"
                        onClick={() => onForcarProducao(item.item_id, item.item_nome)}
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        Forçar
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Progress 
                    value={progressPercent} 
                    className="h-2 bg-amber-200 dark:bg-amber-800"
                  />
                  <div className="flex justify-between text-[10px] text-amber-600 dark:text-amber-400">
                    <span>Demanda atual: {item.saldo_liquido} un</span>
                    <span>Faltam: {faltando} un</span>
                  </div>
                </div>
                
                {item.estoque_cpd > 0 && (
                  <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Estoque CPD: {item.estoque_cpd} un (já descontado)</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-3 italic">
          💡 Quando novas contagens forem enviadas e o total atingir o gatilho mínimo, 
          a produção será criada automaticamente.
        </p>
      </AlertDescription>
    </Alert>
  );
}
