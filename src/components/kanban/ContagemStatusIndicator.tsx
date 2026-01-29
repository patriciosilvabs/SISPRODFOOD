import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, Store, Package, Play, Star, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, parseISO } from "date-fns";

interface Loja {
  id: string;
  nome: string;
  tipo: string;
}

interface ContagemData {
  loja_id: string;
  loja_nome: string;
  totalItens: number;
  totalUnidades: number;
  ultimaAtualizacao?: string;
}

interface ContagemStatusIndicatorProps {
  lojas: Loja[];
  contagensHoje: ContagemData[];
  onIniciarProducaoLoja?: (lojaId: string, lojaNome: string) => void;
  onSelecionarLoja?: (lojaId: string | null, lojaNome: string) => void;
  lojaFiltradaId?: string | null;
}

export function ContagemStatusIndicator({
  lojas,
  contagensHoje,
  onIniciarProducaoLoja,
  onSelecionarLoja,
  lojaFiltradaId,
}: ContagemStatusIndicatorProps) {
  const { enviaram, aguardando, lojaMaiorDemanda } = useMemo(() => {
    const lojasNaoCPD = lojas.filter(l => l.tipo !== 'cpd');
    const contagemMap = new Map(contagensHoje.map(c => [c.loja_id, c]));
    
    const enviaram: Array<Loja & ContagemData> = [];
    const aguardando: Loja[] = [];
    
    lojasNaoCPD.forEach(loja => {
      const contagem = contagemMap.get(loja.id);
      if (contagem && contagem.totalItens > 0) {
        enviaram.push({ ...loja, ...contagem });
      } else {
        aguardando.push(loja);
      }
    });
    
    enviaram.sort((a, b) => b.totalUnidades - a.totalUnidades);
    
    const lojaMaiorDemanda = enviaram.length > 0 ? enviaram[0] : null;
    
    return { enviaram, aguardando, lojaMaiorDemanda };
  }, [lojas, contagensHoje]);

  const totalLojas = enviaram.length + aguardando.length;
  
  if (totalLojas === 0) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            Status das Contagens de Hoje
          </span>
          <Badge 
            variant={aguardando.length === 0 ? "default" : "secondary"}
            className={cn(
              "text-xs",
              aguardando.length === 0 && "bg-emerald-500 hover:bg-emerald-500"
            )}
          >
            {enviaram.length}/{totalLojas} lojas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Grid responsivo: 1 col mobile, 2 cols tablet, 4 cols desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {enviaram.map((loja) => {
            let horarioFormatado = '';
            if (loja.ultimaAtualizacao) {
              try {
                const dataAtualizacao = parseISO(loja.ultimaAtualizacao);
                if (isToday(dataAtualizacao)) {
                  horarioFormatado = format(dataAtualizacao, 'HH:mm');
                } else {
                  horarioFormatado = format(dataAtualizacao, 'dd/MM HH:mm');
                }
              } catch {
                horarioFormatado = '';
              }
            }
            
            const isMaiorDemanda = lojaMaiorDemanda?.id === loja.id && enviaram.length > 1;
            const isSelected = lojaFiltradaId === loja.id;
            
            return (
              <div
                key={loja.id}
                className={cn(
                  "rounded-lg p-4 transition-all cursor-pointer border-2",
                  isSelected
                    ? "bg-primary/10 border-primary ring-2 ring-primary/30"
                    : isMaiorDemanda 
                      ? "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-600 hover:border-amber-400 hover:shadow-md" 
                      : "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-600 hover:border-emerald-400 hover:shadow-md"
                )}
                onClick={() => {
                  if (onSelecionarLoja) {
                    onSelecionarLoja(isSelected ? null : loja.id, loja.nome);
                  }
                }}
              >
                {/* Ícone circular + Nome */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                    isMaiorDemanda 
                      ? "bg-amber-500 dark:bg-amber-600" 
                      : "bg-emerald-500 dark:bg-emerald-600"
                  )}>
                    {isMaiorDemanda ? (
                      <Star className="h-4 w-4 text-white fill-white" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <span className={cn(
                    "font-semibold truncate",
                    isMaiorDemanda 
                      ? "text-amber-800 dark:text-amber-200" 
                      : "text-emerald-800 dark:text-emerald-200"
                  )}>
                    {loja.nome}
                  </span>
                </div>
                
                {/* Estatísticas grandes */}
                <div className={cn(
                  "text-lg font-bold mb-1 flex items-center gap-1",
                  isMaiorDemanda 
                    ? "text-amber-900 dark:text-amber-100" 
                    : "text-emerald-900 dark:text-emerald-100"
                )}>
                  <Package className="h-4 w-4" />
                  <span>{loja.totalItens} itens</span>
                  <span className="text-muted-foreground mx-1">•</span>
                  <span>{loja.totalUnidades} un</span>
                </div>
                
                {/* Horário de atualização */}
                {horarioFormatado && (
                  <div className={cn(
                    "text-xs mb-3",
                    isMaiorDemanda 
                      ? "text-amber-600 dark:text-amber-400" 
                      : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    Atualizado: {horarioFormatado}
                  </div>
                )}
                
                {/* Nota de maior demanda */}
                {isMaiorDemanda && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 mb-3 bg-amber-200/50 dark:bg-amber-800/50 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>Maior demanda - recomendamos iniciar</span>
                  </div>
                )}
                
                {/* Botão Iniciar */}
                {onIniciarProducaoLoja && loja.totalItens > 0 && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIniciarProducaoLoja(loja.id, loja.nome);
                    }}
                    className={cn(
                      "w-full gap-2",
                      isMaiorDemanda 
                        ? "bg-amber-600 hover:bg-amber-700 text-white" 
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    )}
                  >
                    <Play className="h-4 w-4" />
                    Iniciar
                  </Button>
                )}
              </div>
            );
          })}
          
          {/* Cards de lojas aguardando */}
          {aguardando.map(loja => (
            <div
              key={loja.id}
              className="rounded-lg p-4 bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center min-h-[140px]"
            >
              <Clock className="h-6 w-6 text-muted-foreground animate-pulse mb-2" />
              <span className="text-sm font-medium text-muted-foreground text-center truncate max-w-full">
                {loja.nome}
              </span>
              <Badge variant="outline" className="text-xs text-muted-foreground mt-2">
                Aguardando contagem
              </Badge>
            </div>
          ))}
        </div>
        
        {aguardando.length > 0 && enviaram.length > 0 && (
          <p className="text-xs text-muted-foreground mt-4 italic text-center">
            💡 Clique em um card para filtrar a produção por loja ou em "Iniciar" para começar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
