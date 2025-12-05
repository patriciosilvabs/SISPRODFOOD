import { useEffect, useState } from 'react';
import { SuperAdminLayout } from '@/components/SuperAdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Users, CreditCard, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface DashboardStats {
  totalOrganizations: number;
  activeOrganizations: number;
  trialOrganizations: number;
  expiredOrganizations: number;
  totalUsers: number;
  totalSuperAdmins: number;
  trialsExpiringIn7Days: number;
  mrr: number;
}

export const SuperAdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrganizations: 0,
    activeOrganizations: 0,
    trialOrganizations: 0,
    expiredOrganizations: 0,
    totalUsers: 0,
    totalSuperAdmins: 0,
    trialsExpiringIn7Days: 0,
    mrr: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch organizations
      const { data: orgs } = await supabase
        .from('organizations')
        .select('*');

      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const totalOrganizations = orgs?.length || 0;
      const activeOrganizations = orgs?.filter(o => o.subscription_status === 'active').length || 0;
      const trialOrganizations = orgs?.filter(o => o.subscription_status === 'trial').length || 0;
      const expiredOrganizations = orgs?.filter(o => 
        o.subscription_status === 'expired' || 
        (o.subscription_status === 'trial' && o.trial_end_date && new Date(o.trial_end_date) < now)
      ).length || 0;
      
      const trialsExpiringIn7Days = orgs?.filter(o => {
        if (o.subscription_status !== 'trial' || !o.trial_end_date) return false;
        const endDate = new Date(o.trial_end_date);
        return endDate > now && endDate <= in7Days;
      }).length || 0;

      // Fetch users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id');

      const { data: superAdmins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'SuperAdmin');

      // Calculate MRR (simplified - just count active subscriptions * average price)
      const { data: plans } = await supabase
        .from('planos_assinatura')
        .select('preco_centavos')
        .eq('ativo', true);

      const avgPrice = plans?.length 
        ? plans.reduce((sum, p) => sum + p.preco_centavos, 0) / plans.length 
        : 0;
      const mrr = (activeOrganizations * avgPrice) / 100;

      setStats({
        totalOrganizations,
        activeOrganizations,
        trialOrganizations,
        expiredOrganizations,
        totalUsers: profiles?.length || 0,
        totalSuperAdmins: superAdmins?.length || 0,
        trialsExpiringIn7Days,
        mrr,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total de Organizações',
      value: stats.totalOrganizations,
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Assinaturas Ativas',
      value: stats.activeOrganizations,
      icon: CreditCard,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Em Trial',
      value: stats.trialOrganizations,
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Expirados',
      value: stats.expiredOrganizations,
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Total de Usuários',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'MRR Estimado',
      value: `R$ ${stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  return (
    <SuperAdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alerts */}
        {stats.trialsExpiringIn7Days > 0 && (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                Atenção
              </CardTitle>
              <CardDescription>
                {stats.trialsExpiringIn7Days} trial(s) expirando nos próximos 7 dias
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Status</CardTitle>
              <CardDescription>Visão geral das organizações por status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ativas</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ 
                          width: `${stats.totalOrganizations ? (stats.activeOrganizations / stats.totalOrganizations) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">{stats.activeOrganizations}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Trial</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500 rounded-full"
                        style={{ 
                          width: `${stats.totalOrganizations ? (stats.trialOrganizations / stats.totalOrganizations) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">{stats.trialOrganizations}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expiradas</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full"
                        style={{ 
                          width: `${stats.totalOrganizations ? (stats.expiredOrganizations / stats.totalOrganizations) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">{stats.expiredOrganizations}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Super Admins</CardTitle>
              <CardDescription>Usuários com acesso total ao sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-destructive">
                {stats.totalSuperAdmins}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Super administradores cadastrados
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
};
