import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Rocket, Store } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetalheLojaProducao {
  loja_id: string;
  loja_nome: string;
  quantidade: number;
}

interface ProducaoRegistro {
  id: string;
  item_id: string;
  item_nome: string;
  detalhes_lojas?: DetalheLojaProducao[];
  unidades_programadas: number | null;
}

interface LojaStats {
  lojaId: string;
  lojaNome: string;
  totalItens: number;
  totalUnidades: number;
}

interface LojaFilterTabsProps {
  registros: ProducaoRegistro[];
  selectedLojaId: string | null; // null = "TODAS"
  onSelectLoja: (lojaId: string | null) => void;
  onIniciarTudoLoja?: (lojaId: string, lojaNome: string) => void;
}

export function LojaFilterTabs({
  registros,
  selectedLojaId,
  onSelectLoja,
  onIniciarTudoLoja,
}: LojaFilterTabsProps) {
  // Calcular estatísticas por loja
  const lojaStats = useMemo((): LojaStats[] => {
    const stats = new Map<string, LojaStats>();
    
    registros.forEach(reg => {
      if (reg.detalhes_lojas && reg.detalhes_lojas.length > 0) {
        // Cada card agora tem apenas 1 loja em detalhes_lojas
        const loja = reg.detalhes_lojas[0];
        const key = loja.loja_id;
        
        if (!stats.has(key)) {
          stats.set(key, {
            lojaId: loja.loja_id,
            lojaNome: loja.loja_nome,
            totalItens: 0,
            totalUnidades: 0,
          });
        }
        
        const s = stats.get(key)!;
        s.totalItens += 1;
        s.totalUnidades += reg.unidades_programadas || 0;
      }
    });
    
    // Ordenar por maior demanda
    return Array.from(stats.values()).sort((a, b) => b.totalUnidades - a.totalUnidades);
  }, [registros]);

  // Loja com maior demanda (recomendada)
  const lojaMaiorDemanda = lojaStats[0] || null;

  if (lojaStats.length === 0) {
    return null;
  }

  // Se há apenas 1 loja, não mostra abas - vai direto
  if (lojaStats.length === 1) {
    return (
      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg mb-3">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{lojaStats[0].lojaNome}</span>
          <Badge variant="secondary" className="text-xs">
            {lojaStats[0].totalItens} {lojaStats[0].totalItens === 1 ? 'item' : 'itens'}
          </Badge>
        </div>
        {onIniciarTudoLoja && lojaStats[0].totalItens > 1 && (
          <Button
            size="sm"
            variant="default"
            onClick={() => onIniciarTudoLoja(lojaStats[0].lojaId, lojaStats[0].lojaNome)}
            className="gap-1"
          >
            <Rocket className="h-3 w-3" />
            Iniciar Tudo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-4">
      {/* Tabs de filtro por loja */}
      <Tabs 
        value={selectedLojaId || "todas"} 
        onValueChange={(val) => onSelectLoja(val === "todas" ? null : val)}
        className="w-full"
      >
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger 
            value="todas" 
            className="flex-shrink-0 data-[state=active]:bg-background"
          >
            TODAS
            <Badge variant="outline" className="ml-1.5 text-[10px]">
              {registros.length}
            </Badge>
          </TabsTrigger>
          
          {lojaStats.map((loja, idx) => (
            <TabsTrigger 
              key={loja.lojaId} 
              value={loja.lojaId}
              className={cn(
                "flex-shrink-0 gap-1 data-[state=active]:bg-background",
                idx === 0 && "ring-1 ring-amber-400/50"
              )}
            >
              {idx === 0 && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
              <span className="max-w-[120px] truncate">{loja.lojaNome}</span>
              <Badge 
                variant={idx === 0 ? "default" : "secondary"} 
                className={cn(
                  "text-[10px] px-1",
                  idx === 0 && "bg-amber-500 hover:bg-amber-500"
                )}
              >
                {loja.totalItens}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Botão "Iniciar Tudo" para a loja selecionada */}
      {selectedLojaId && onIniciarTudoLoja && (() => {
        const lojaAtual = lojaStats.find(l => l.lojaId === selectedLojaId);
        if (!lojaAtual || lojaAtual.totalItens <= 1) return null;
        
        return (
          <div className="flex items-center justify-between p-2 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-primary" />
              <span className="font-medium">{lojaAtual.lojaNome}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                {lojaAtual.totalItens} itens, {lojaAtual.totalUnidades} un
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => onIniciarTudoLoja(lojaAtual.lojaId, lojaAtual.lojaNome)}
              className="gap-1.5"
            >
              <Rocket className="h-3.5 w-3.5" />
              Iniciar Produção da Loja
            </Button>
          </div>
        );
      })()}

      {/* Dica para loja com maior demanda (quando "TODAS" selecionada) */}
      {!selectedLojaId && lojaMaiorDemanda && lojaStats.length > 1 && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs">
          <Star className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 fill-amber-600 dark:fill-amber-400" />
          <span className="text-amber-700 dark:text-amber-300">
            <strong>{lojaMaiorDemanda.lojaNome}</strong> tem a maior demanda 
            ({lojaMaiorDemanda.totalUnidades} un). Recomendamos iniciar por ela.
          </span>
        </div>
      )}
    </div>
  );
}
