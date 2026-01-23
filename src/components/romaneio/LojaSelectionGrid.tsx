import { Store, Package, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ItemDemandaLoja {
  item_id: string;
  item_nome: string;
  quantidade_demanda: number;
  quantidade_estoque_cpd: number;
  quantidade_disponivel: number;
  quantidade_ja_enviada: number;
  codigo_lote?: string;
  producao_registro_id?: string;
}

interface ItemSelecionadoLoja {
  item_id: string;
  item_nome: string;
  quantidade: number;
  peso_g: string;
  volumes: string;
  codigo_lote?: string;
  producao_registro_id?: string;
  salvo: boolean;
}

interface DemandaPorLoja {
  loja_id: string;
  loja_nome: string;
  itens: ItemDemandaLoja[];
  itensSelecionados: ItemSelecionadoLoja[];
  enviando: boolean;
}

interface EstoqueCPDResumo {
  item_nome: string;
  quantidade: number;
}

interface LojaSelectionGridProps {
  lojas: Array<{ id: string; nome: string }>;
  demandasPorLoja: DemandaPorLoja[];
  estoqueCPDResumo: EstoqueCPDResumo[];
  lojaSelecionada: string | null;
  onSelectLoja: (lojaId: string | null) => void;
  loading: boolean;
}

type StatusEstoque = 'disponivel' | 'parcial' | 'indisponivel';

interface LojaButtonProps {
  loja: { id: string; nome: string };
  demanda: DemandaPorLoja | undefined;
  estoqueCPD: Record<string, number>;
  isSelected: boolean;
  onClick: () => void;
}

const getStatusItem = (
  demanda: number,
  disponivel: number
): StatusEstoque => {
  if (disponivel >= demanda) return 'disponivel';
  if (disponivel > 0) return 'parcial';
  return 'indisponivel';
};

const getLojaStatus = (itens: ItemDemandaLoja[]): StatusEstoque => {
  if (itens.length === 0) return 'indisponivel';
  
  const hasUnavailable = itens.some(i => i.quantidade_disponivel === 0);
  const hasPartial = itens.some(i => i.quantidade_disponivel < i.quantidade_demanda);
  
  if (hasUnavailable) return 'parcial';
  if (hasPartial) return 'parcial';
  return 'disponivel';
};

const StatusIcon = ({ status }: { status: StatusEstoque }) => {
  switch (status) {
    case 'disponivel':
      return <CheckCircle className="w-4 h-4 text-primary" />;
    case 'parcial':
      return <AlertTriangle className="w-4 h-4 text-secondary-foreground" />;
    case 'indisponivel':
      return <XCircle className="w-4 h-4 text-destructive" />;
  }
};

const LojaButton = ({ loja, demanda, isSelected, onClick }: LojaButtonProps) => {
  const itens = demanda?.itens || [];
  const status = getLojaStatus(itens);
  const totalItens = itens.length;
  const totalUnidades = itens.reduce((acc, i) => acc + i.quantidade_disponivel, 0);
  
  const statusColors = {
    disponivel: 'border-accent bg-accent/20 hover:bg-accent/30',
    parcial: 'border-secondary bg-secondary/20 hover:bg-secondary/30',
    indisponivel: 'border-muted bg-muted/30 opacity-60'
  };

  const selectedStyles = isSelected 
    ? 'ring-2 ring-primary ring-offset-2' 
    : '';

  return (
    <button
      onClick={onClick}
      disabled={totalItens === 0}
      className={cn(
        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200",
        statusColors[status],
        selectedStyles,
        totalItens === 0 && "cursor-not-allowed"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <span className="font-semibold text-base">{loja.nome}</span>
        </div>
        <StatusIcon status={status} />
      </div>
      
      {totalItens > 0 ? (
        <>
          <div className="space-y-1.5 mb-3">
            {itens.slice(0, 3).map(item => {
              const itemStatus = getStatusItem(item.quantidade_demanda, item.quantidade_disponivel);
              return (
                <div key={item.item_id} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 mr-2">{item.item_nome}</span>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon status={itemStatus} />
                    <span className={cn(
                      "font-medium tabular-nums",
                      itemStatus === 'disponivel' && "text-accent-foreground",
                      itemStatus === 'parcial' && "text-secondary-foreground",
                      itemStatus === 'indisponivel' && "text-destructive"
                    )}>
                      {item.quantidade_disponivel}
                    </span>
                    <span className="text-muted-foreground">
                      /{item.quantidade_demanda}
                    </span>
                  </div>
                </div>
              );
            })}
            {itens.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{itens.length - 3} itens...
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Badge variant="secondary" className="text-xs">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {totalUnidades} un disponíveis
            </Badge>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sem demanda pendente
        </p>
      )}
    </button>
  );
};

export const LojaSelectionGrid = ({
  lojas,
  demandasPorLoja,
  estoqueCPDResumo,
  lojaSelecionada,
  onSelectLoja,
  loading
}: LojaSelectionGridProps) => {
  // Criar mapa de estoque CPD
  const estoqueCPDMap: Record<string, number> = {};
  estoqueCPDResumo.forEach(item => {
    estoqueCPDMap[item.item_nome] = item.quantidade;
  });

  // Separar lojas com e sem demanda
  const lojasComDemanda = lojas.filter(loja => {
    const demanda = demandasPorLoja.find(d => d.loja_id === loja.id);
    return demanda && demanda.itens.length > 0;
  });

  const lojasSemDemanda = lojas.filter(loja => {
    const demanda = demandasPorLoja.find(d => d.loja_id === loja.id);
    return !demanda || demanda.itens.length === 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando lojas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Estoque CPD */}
      {estoqueCPDResumo.length > 0 && (
        <Card className="border border-primary/30 bg-primary/5">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-primary" />
              Estoque Disponível no CPD
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex flex-wrap gap-2">
              {estoqueCPDResumo.map((item) => (
                <Badge 
                  key={item.item_nome} 
                  variant="secondary" 
                  className="text-sm py-1 px-3"
                >
                  {item.item_nome}: <span className="font-bold ml-1">{item.quantidade}</span> un
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seleção de Lojas */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
          <Store className="w-5 h-5" />
          Selecione a Loja para Romaneio
        </h3>

        {lojasComDemanda.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">Nenhum item disponível para envio</p>
            <p className="text-sm mt-1">
              Itens aparecerão automaticamente quando a produção for finalizada
            </p>
            
            {lojasSemDemanda.length > 0 && (
              <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-dashed max-w-md mx-auto">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Lojas cadastradas ({lojasSemDemanda.length}):
                </p>
                <div className="flex flex-wrap gap-1 justify-center">
                  {lojasSemDemanda.map(loja => (
                    <Badge key={loja.id} variant="outline" className="text-xs">
                      {loja.nome}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Grid de Botões de Lojas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lojasComDemanda.map(loja => {
                const demanda = demandasPorLoja.find(d => d.loja_id === loja.id);
                return (
                  <LojaButton
                    key={loja.id}
                    loja={loja}
                    demanda={demanda}
                    estoqueCPD={estoqueCPDMap}
                    isSelected={lojaSelecionada === loja.id}
                    onClick={() => onSelectLoja(lojaSelecionada === loja.id ? null : loja.id)}
                  />
                );
              })}
            </div>

            {/* Lojas sem demanda */}
            {lojasSemDemanda.length > 0 && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-dashed">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Lojas sem demanda pendente ({lojasSemDemanda.length}):
                </p>
                <div className="flex flex-wrap gap-1">
                  {lojasSemDemanda.map(loja => (
                    <Badge key={loja.id} variant="outline" className="text-xs opacity-60">
                      {loja.nome}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
