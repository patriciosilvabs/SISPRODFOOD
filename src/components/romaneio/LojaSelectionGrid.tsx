import { Store, Package, CheckCircle, AlertTriangle, XCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface Loja {
  id: string;
  nome: string;
  responsavel?: string;
}

interface LojaSelectionGridProps {
  lojas: Loja[];
  demandasPorLoja: DemandaPorLoja[];
  estoqueCPDResumo: EstoqueCPDResumo[];
  lojaSelecionada: string | null;
  onSelectLoja: (lojaId: string | null) => void;
  loading: boolean;
}

type StatusGeral = 'disponivel' | 'parcial' | 'indisponivel' | 'sem_demanda';

export const LojaSelectionGrid = ({
  lojas,
  demandasPorLoja,
  estoqueCPDResumo,
  lojaSelecionada,
  onSelectLoja,
  loading
}: LojaSelectionGridProps) => {
  // Criar mapa de estoque CPD por item_id
  const estoqueCPDMap: Record<string, number> = {};
  demandasPorLoja.forEach(demanda => {
    demanda.itens.forEach(item => {
      if (!estoqueCPDMap[item.item_id]) {
        estoqueCPDMap[item.item_id] = item.quantidade_estoque_cpd;
      }
    });
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Carregando lojas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estoque do CPD */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Estoque Disponível no CPD
          </CardTitle>
        </CardHeader>
        <CardContent>
          {estoqueCPDResumo.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {estoqueCPDResumo.map((item, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm">
                  {item.item_nome}: {item.quantidade} un
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhum estoque registrado no CPD para hoje
            </p>
          )}
        </CardContent>
      </Card>

      {/* Grid de lojas - SEMPRE clicáveis */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Store className="h-5 w-5" />
          Selecione a Loja para Romaneio ({lojas.length} lojas)
        </h3>
        
        {lojas.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Nenhuma loja cadastrada</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lojas.map(loja => {
              const demanda = demandasPorLoja.find(d => d.loja_id === loja.id);
              const totalItens = demanda?.itens?.length || 0;
              const totalUnidades = demanda?.itens?.reduce((sum, item) => sum + item.quantidade_disponivel, 0) || 0;
              const isSelected = lojaSelecionada === loja.id;
              
              // Calcular disponibilidade
              let statusGeral: StatusGeral = 'sem_demanda';
              if (totalItens > 0) {
                const itensDisponiveis = demanda?.itens?.filter(item => 
                  item.quantidade_disponivel >= item.quantidade_demanda
                ).length || 0;
                
                if (itensDisponiveis === totalItens) statusGeral = 'disponivel';
                else if (itensDisponiveis > 0) statusGeral = 'parcial';
                else statusGeral = 'indisponivel';
              }
              
              return (
                <button
                  key={loja.id}
                  onClick={() => onSelectLoja(isSelected ? null : loja.id)}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all hover:shadow-md",
                    isSelected 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : "border-border hover:border-primary/50 bg-card",
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-lg">{loja.nome}</span>
                    </div>
                    <StatusBadge status={statusGeral} />
                  </div>
                  
                  {totalItens > 0 ? (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{totalItens} {totalItens === 1 ? 'item' : 'itens'} • {totalUnidades} unidades disponíveis</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {demanda?.itens?.slice(0, 3).map(item => (
                          <Badge key={item.item_id} variant="outline" className="text-xs">
                            {item.item_nome}: {item.quantidade_disponivel}/{item.quantidade_demanda}
                          </Badge>
                        ))}
                        {(demanda?.itens?.length || 0) > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{(demanda?.itens?.length || 0) - 3} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Clique para ver detalhes ou criar romaneio manual
                    </p>
                  )}
                  
                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Responsável: {loja.responsavel || 'Não definido'}
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente auxiliar para status badge
const StatusBadge = ({ status }: { status: StatusGeral }) => {
  switch (status) {
    case 'disponivel':
      return (
        <Badge className="bg-accent/20 text-accent-foreground border-accent/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Disponível
        </Badge>
      );
    case 'parcial':
      return (
        <Badge className="bg-secondary/50 text-secondary-foreground border-secondary/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          Parcial
        </Badge>
      );
    case 'indisponivel':
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30">
          <XCircle className="h-3 w-3 mr-1" />
          Sem estoque
        </Badge>
      );
    case 'sem_demanda':
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Sem demanda
        </Badge>
      );
  }
};
