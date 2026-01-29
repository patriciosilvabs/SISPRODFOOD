import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, Store, Package, Rocket, Star } from "lucide-react";
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
  ultimaAtualizacao?: string; // ISO timestamp
}

interface ContagemStatusIndicatorProps {
  lojas: Loja[];
  contagensHoje: ContagemData[];
  onIniciarProducaoLoja?: (lojaId: string, lojaNome: string) => void;
}

export function ContagemStatusIndicator({
  lojas,
  contagensHoje,
  onIniciarProducaoLoja,
}: ContagemStatusIndicatorProps) {
  // Separar lojas que enviaram contagem das que não enviaram
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
    
    // Ordenar enviaram por total de unidades (maior primeiro)
    enviaram.sort((a, b) => b.totalUnidades - a.totalUnidades);
    
    // Loja com maior demanda
    const lojaMaiorDemanda = enviaram.length > 0 ? enviaram[0] : null;
    
    return { enviaram, aguardando, lojaMaiorDemanda };
  }, [lojas, contagensHoje]);

  const totalLojas = enviaram.length + aguardando.length;
  
  if (totalLojas === 0) {
    return null;
  }

  return (
    <Card className="mb-4 border-dashed">
      <CardHeader className="pb-2 pt-3 px-4">
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
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Lojas que já enviaram */}
          {enviaram.map((loja, idx) => {
            // Formatar timestamp da última atualização
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
            
            return (
              <div
                key={loja.id}
                className={cn(
                  "flex flex-col p-2 rounded-md border",
                  isMaiorDemanda 
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700" 
                    : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isMaiorDemanda ? (
                      <Star className="h-4 w-4 text-amber-600 dark:text-amber-400 fill-amber-600 dark:fill-amber-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span className={cn(
                      "text-sm font-medium truncate max-w-[120px]",
                      isMaiorDemanda 
                        ? "text-amber-700 dark:text-amber-300" 
                        : "text-emerald-700 dark:text-emerald-300"
                    )}>
                      {loja.nome}
                    </span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs",
                    isMaiorDemanda 
                      ? "text-amber-600 dark:text-amber-400" 
                      : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    <Package className="h-3 w-3" />
                    <span>{loja.totalItens} itens</span>
                    <span className={isMaiorDemanda ? "text-amber-400" : "text-emerald-400"}>•</span>
                    <span>{loja.totalUnidades} un</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-1.5">
                  {horarioFormatado && (
                    <span className={cn(
                      "text-[10px] ml-6",
                      isMaiorDemanda 
                        ? "text-amber-500 dark:text-amber-400/70" 
                        : "text-emerald-500 dark:text-emerald-400/70"
                    )}>
                      Atualizado: {horarioFormatado}
                    </span>
                  )}
                  
                  {onIniciarProducaoLoja && loja.totalItens > 0 && (
                    <Button
                      size="sm"
                      variant={isMaiorDemanda ? "default" : "outline"}
                      onClick={() => onIniciarProducaoLoja(loja.id, loja.nome)}
                      className={cn(
                        "h-7 gap-1 text-xs ml-auto",
                        isMaiorDemanda && "bg-amber-500 hover:bg-amber-600 text-white"
                      )}
                    >
                      <Rocket className="h-3 w-3" />
                      Iniciar Produção
                    </Button>
                  )}
                </div>
                
                {isMaiorDemanda && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 ml-6">
                    ★ Maior demanda - recomendamos iniciar por aqui
                  </span>
                )}
              </div>
            );
          })}
          
          {/* Lojas aguardando */}
          {aguardando.map(loja => (
            <div
              key={loja.id}
              className="flex items-center justify-between p-2 bg-muted/50 border border-border rounded-md"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
                <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                  {loja.nome}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Aguardando
              </Badge>
            </div>
          ))}
        </div>
        
        {aguardando.length > 0 && enviaram.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            💡 Você pode iniciar a produção das lojas que já enviaram enquanto aguarda as demais.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
