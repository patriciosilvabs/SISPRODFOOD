import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, Store, Package } from "lucide-react";
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
}

export function ContagemStatusIndicator({
  lojas,
  contagensHoje,
}: ContagemStatusIndicatorProps) {
  // Separar lojas que enviaram contagem das que não enviaram
  const { enviaram, aguardando } = useMemo(() => {
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
    
    return { enviaram, aguardando };
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
          {enviaram.map(loja => {
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
            
            return (
              <div
                key={loja.id}
                className="flex flex-col p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate max-w-[120px]">
                      {loja.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <Package className="h-3 w-3" />
                    <span>{loja.totalItens} itens</span>
                    <span className="text-emerald-400">•</span>
                    <span>{loja.totalUnidades} un</span>
                  </div>
                </div>
                {horarioFormatado && (
                  <span className="text-[10px] text-emerald-500 dark:text-emerald-400/70 ml-6 mt-0.5">
                    Atualizado: {horarioFormatado}
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
