import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  RefreshCw, 
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Package,
  TrendingDown,
  Settings
} from 'lucide-react';
import { useIntegracaoPDV, PDVDemandItem } from '@/hooks/useIntegracaoPDV';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const DemandaPDV = () => {
  const navigate = useNavigate();
  const { 
    config, 
    loading, 
    syncing, 
    isConfigured,
    isActive,
    syncDemand 
  } = useIntegracaoPDV();

  const [demandData, setDemandData] = useState<{
    date: string;
    store: { id: string; name: string };
    demand: PDVDemandItem[];
  } | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleSync = async () => {
    const data = await syncDemand();
    if (data) {
      setDemandData({
        date: data.date,
        store: data.store,
        demand: data.demand,
      });
      setLastSync(new Date());
    }
  };

  // Agrupar itens por status
  const criticalItems = demandData?.demand.filter(d => d.status === 'critical') || [];
  const lowItems = demandData?.demand.filter(d => d.status === 'low') || [];
  const neededItems = demandData?.demand.filter(d => d.status === 'needed') || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'low':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'needed':
        return <TrendingDown className="h-5 w-5 text-blue-500" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'low':
        return <Badge className="bg-yellow-500">Baixo</Badge>;
      case 'needed':
        return <Badge variant="secondary">Necessário</Badge>;
      default:
        return <Badge variant="outline">OK</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isConfigured) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Demanda de Produção (PDV)</h1>
            <p className="text-muted-foreground mt-1">
              Visualize a demanda sincronizada do sistema PDV externo.
            </p>
          </div>

          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Integração não configurada</h3>
              <p className="text-muted-foreground mb-4">
                Configure a integração com o PDV para visualizar a demanda de produção.
              </p>
              <Button onClick={() => navigate('/configurar-integracao-pdv')}>
                <Settings className="h-4 w-4 mr-2" />
                Configurar Integração
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!isActive) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Demanda de Produção (PDV)</h1>
            <p className="text-muted-foreground mt-1">
              Visualize a demanda sincronizada do sistema PDV externo.
            </p>
          </div>

          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-lg font-semibold mb-2">Integração desativada</h3>
              <p className="text-muted-foreground mb-4">
                A integração com o PDV está configurada mas desativada.
              </p>
              <Button onClick={() => navigate('/configurar-integracao-pdv')}>
                <Settings className="h-4 w-4 mr-2" />
                Ativar Integração
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Demanda de Produção (PDV)</h1>
            <p className="text-muted-foreground mt-1">
              {demandData?.store?.name 
                ? `Dados de ${demandData.store.name}` 
                : 'Sincronize para ver a demanda do PDV'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastSync && (
              <span className="text-sm text-muted-foreground">
                Atualizado: {format(lastSync, "HH:mm", { locale: ptBR })}
              </span>
            )}
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sincronizando...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Sincronizar</>
              )}
            </Button>
          </div>
        </div>

        {!demandData ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma demanda carregada</h3>
              <p className="text-muted-foreground mb-4">
                Clique em "Sincronizar" para buscar a demanda de produção do PDV.
              </p>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sincronizando...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" /> Sincronizar Agora</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : demandData.demand.length === 0 ? (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">Tudo em ordem!</h3>
              <p className="text-muted-foreground">
                Não há itens abaixo do estoque ideal no momento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Críticos */}
            {criticalItems.length > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader className="bg-red-50 dark:bg-red-950/30 rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <CardTitle className="text-red-700 dark:text-red-400">
                      Crítico ({criticalItems.length})
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Estoque abaixo de 25% da meta - produção urgente
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {criticalItems.map((item) => (
                      <DemandItemRow key={item.ingredient_id} item={item} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Baixo */}
            {lowItems.length > 0 && (
              <Card className="border-yellow-200 dark:border-yellow-800">
                <CardHeader className="bg-yellow-50 dark:bg-yellow-950/30 rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <CardTitle className="text-yellow-700 dark:text-yellow-400">
                      Baixo ({lowItems.length})
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Estoque entre 25% e 50% da meta
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {lowItems.map((item) => (
                      <DemandItemRow key={item.ingredient_id} item={item} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Necessário */}
            {neededItems.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-blue-500" />
                    <CardTitle>Necessário ({neededItems.length})</CardTitle>
                  </div>
                  <CardDescription>
                    Estoque acima de 50% mas abaixo da meta
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {neededItems.map((item) => (
                      <DemandItemRow key={item.ingredient_id} item={item} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

const DemandItemRow = ({ item }: { item: PDVDemandItem }) => {
  const percentage = item.target_stock > 0 
    ? Math.round((item.current_stock / item.target_stock) * 100) 
    : 0;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div className="flex-1">
        <p className="font-medium">{item.ingredient_name}</p>
        <p className="text-sm text-muted-foreground">
          {item.current_stock} {item.unit} → {item.target_stock} {item.unit}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-lg font-bold text-primary">
            +{item.to_produce} {item.unit}
          </p>
          <p className="text-xs text-muted-foreground">{percentage}% da meta</p>
        </div>
        {/* Progress bar visual */}
        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              item.status === 'critical' ? 'bg-red-500' :
              item.status === 'low' ? 'bg-yellow-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default DemandaPDV;
