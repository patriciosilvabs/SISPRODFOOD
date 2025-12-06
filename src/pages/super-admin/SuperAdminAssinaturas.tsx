import { useEffect, useState } from 'react';
import { SuperAdminLayout } from '@/components/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, CreditCard, Calendar, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Subscription {
  id: string;
  nome: string;
  slug: string;
  subscription_status: string | null;
  subscription_plan: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  subscription_expires_at: string | null;
}

interface Plan {
  id: string;
  nome: string;
  slug: string;
  preco_centavos: number;
}

export const SuperAdminAssinaturas = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filteredSubs, setFilteredSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editForm, setEditForm] = useState({
    subscription_status: '',
    subscription_plan: '',
    trial_end_date: '',
    subscription_expires_at: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterSubscriptions();
  }, [search, statusFilter, subscriptions]);

  const fetchData = async () => {
    try {
      const [{ data: orgs }, { data: plansData }] = await Promise.all([
        supabase
          .from('organizations')
          .select('id, nome, slug, subscription_status, subscription_plan, trial_start_date, trial_end_date, subscription_expires_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('planos_assinatura')
          .select('id, nome, slug, preco_centavos')
          .eq('ativo', true),
      ]);

      setSubscriptions(orgs || []);
      setPlans(plansData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const filterSubscriptions = () => {
    let filtered = subscriptions;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        sub => 
          sub.nome.toLowerCase().includes(searchLower) ||
          sub.slug.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(sub => sub.subscription_status === statusFilter);
    }

    setFilteredSubs(filtered);
  };

  const handleEditClick = (sub: Subscription) => {
    setEditingSub(sub);
    setEditForm({
      subscription_status: sub.subscription_status || 'trial',
      subscription_plan: sub.subscription_plan || '',
      trial_end_date: sub.trial_end_date ? format(new Date(sub.trial_end_date), 'yyyy-MM-dd') : '',
      subscription_expires_at: sub.subscription_expires_at ? format(new Date(sub.subscription_expires_at), 'yyyy-MM-dd') : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSub) return;

    try {
      const updates: any = {
        subscription_status: editForm.subscription_status,
        subscription_plan: editForm.subscription_plan || null,
      };

      if (editForm.trial_end_date) {
        updates.trial_end_date = new Date(editForm.trial_end_date).toISOString();
      }

      if (editForm.subscription_expires_at) {
        updates.subscription_expires_at = new Date(editForm.subscription_expires_at).toISOString();
      }

      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', editingSub.id);

      if (error) throw error;

      toast.success('Assinatura atualizada com sucesso');
      setEditingSub(null);
      fetchData();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Erro ao atualizar assinatura');
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Ativa</Badge>;
      case 'trial':
        return <Badge className="bg-yellow-500">Trial</Badge>;
      case 'expired':
        return <Badge className="bg-red-500">Expirada</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  const getTrialDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const days = differenceInDays(new Date(endDate), new Date());
    return days;
  };

  const getPlanPrice = (planSlug: string | null) => {
    if (!planSlug) return null;
    const plan = plans.find(p => p.slug === planSlug);
    return plan ? (plan.preco_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;
  };

  return (
    <SuperAdminLayout title="Assinaturas">
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">
                {subscriptions.filter(s => s.subscription_status === 'active').length}
              </div>
              <p className="text-sm text-muted-foreground">Assinaturas Ativas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-500">
                {subscriptions.filter(s => s.subscription_status === 'trial').length}
              </div>
              <p className="text-sm text-muted-foreground">Em Trial</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">
                {subscriptions.filter(s => s.subscription_status === 'expired').length}
              </div>
              <p className="text-sm text-muted-foreground">Expiradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-500">
                {subscriptions.filter(s => {
                  const days = getTrialDaysRemaining(s.trial_end_date);
                  return s.subscription_status === 'trial' && days !== null && days <= 7 && days > 0;
                }).length}
              </div>
              <p className="text-sm text-muted-foreground">Expirando em 7 dias</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Gerenciar Assinaturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar organização..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Expiradas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Trial/Expiração</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredSubs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma assinatura encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubs.map((sub) => {
                    const daysRemaining = getTrialDaysRemaining(sub.trial_end_date);
                    const isExpiringSoon = sub.subscription_status === 'trial' && daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
                    
                    return (
                      <TableRow key={sub.id} className={isExpiringSoon ? 'bg-yellow-500/5' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sub.nome}</p>
                            <p className="text-sm text-muted-foreground">{sub.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(sub.subscription_status)}
                            {isExpiringSoon && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{sub.subscription_plan || '-'}</TableCell>
                        <TableCell>{getPlanPrice(sub.subscription_plan) || '-'}</TableCell>
                        <TableCell>
                          {sub.subscription_status === 'trial' && sub.trial_end_date ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {format(new Date(sub.trial_end_date), 'dd/MM/yyyy', { locale: ptBR })}
                                {daysRemaining !== null && (
                                  <span className={`ml-1 text-sm ${daysRemaining <= 7 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                                    ({daysRemaining}d)
                                  </span>
                                )}
                              </span>
                            </div>
                          ) : sub.subscription_expires_at ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(sub.subscription_expires_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(sub)}
                          >
                            Gerenciar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSub} onOpenChange={() => setEditingSub(null)} modal={false}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Gerenciar Assinatura</DialogTitle>
            <DialogDescription>
              Altere as informações da assinatura de {editingSub?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={editForm.subscription_status}
                onValueChange={(value) => setEditForm({ ...editForm, subscription_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Plano</label>
              <Select
                value={editForm.subscription_plan}
                onValueChange={(value) => setEditForm({ ...editForm, subscription_plan: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.slug}>
                      {plan.nome} - {(plan.preco_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editForm.subscription_status === 'trial' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Fim do Trial</label>
                <Input
                  type="date"
                  value={editForm.trial_end_date}
                  onChange={(e) => setEditForm({ ...editForm, trial_end_date: e.target.value })}
                />
              </div>
            )}
            {editForm.subscription_status === 'active' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Expiração da Assinatura</label>
                <Input
                  type="date"
                  value={editForm.subscription_expires_at}
                  onChange={(e) => setEditForm({ ...editForm, subscription_expires_at: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSub(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
};
