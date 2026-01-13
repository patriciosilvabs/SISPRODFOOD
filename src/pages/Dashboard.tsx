import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Package, ShoppingBag, Store, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard = () => {
  const { isAdmin, hasRole } = useAuth();
  const [stats, setStats] = useState({
    totalInsumos: 0,
    insumosAbaixoMinimo: 0,
    totalItensPorcionados: 0,
    totalLojas: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      if (isAdmin() || hasRole('Produção')) {
        const { count: insumosCount } = await supabase
          .from('insumos')
          .select('*', { count: 'exact', head: true });

        const { data: insumosData } = await supabase
          .from('insumos')
          .select('*');

        const insumosAbaixo = insumosData?.filter(
          i => i.quantidade_em_estoque < i.estoque_minimo
        ).length || 0;

        const { count: itensCount } = await supabase
          .from('itens_porcionados')
          .select('*', { count: 'exact', head: true });

        setStats(prev => ({
          ...prev,
          totalInsumos: insumosCount || 0,
          insumosAbaixoMinimo: insumosAbaixo,
          totalItensPorcionados: itensCount || 0,
        }));
      }

      const { count: lojasCount } = await supabase
        .from('lojas')
        .select('*', { count: 'exact', head: true });

      setStats(prev => ({
        ...prev,
        totalLojas: lojasCount || 0,
      }));
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral do sistema de estoque e produção
            </p>
          </div>
          <Button size="sm" onClick={() => fetchStats()} className="!bg-green-600 hover:!bg-green-700 text-white">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(isAdmin() || hasRole('Produção')) && (
            <>
              <Card className="bg-white dark:bg-gray-900 border-l-4 border-l-blue-400">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Total de Insumos
                  </CardTitle>
                  <Package className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalInsumos}</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Matérias-primas cadastradas
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-900 border-l-4 border-l-amber-400">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Alertas de Estoque
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {stats.insumosAbaixoMinimo}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Insumos abaixo do mínimo
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-900 border-l-4 border-l-blue-400">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Itens Porcionados
                  </CardTitle>
                  <ShoppingBag className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalItensPorcionados}</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Produtos em produção
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          <Card className="bg-white dark:bg-gray-900 border-l-4 border-l-emerald-400">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Total de Lojas
              </CardTitle>
              <Store className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalLojas}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Pontos de venda ativos
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Bem-vindo ao Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Este é um sistema completo de gestão de estoque e produção. Use o menu lateral 
              para navegar entre as diferentes funcionalidades do sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
