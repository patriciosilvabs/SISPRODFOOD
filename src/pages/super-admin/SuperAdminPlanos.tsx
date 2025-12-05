import { useEffect, useState } from 'react';
import { SuperAdminLayout } from '@/components/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tag, Plus, Edit, Trash2, Star, Check } from 'lucide-react';

interface Plan {
  id: string;
  nome: string;
  slug: string;
  preco_centavos: number;
  intervalo: string;
  descricao: string | null;
  recursos: any[];
  ativo: boolean;
  destaque: boolean;
  max_usuarios: number;
  max_lojas: number;
  created_at: string;
}

const emptyPlan = {
  nome: '',
  slug: '',
  preco_centavos: 0,
  intervalo: 'mensal',
  descricao: '',
  recursos: [] as string[],
  ativo: true,
  destaque: false,
  max_usuarios: 5,
  max_lojas: 3,
};

export const SuperAdminPlanos = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState(emptyPlan);
  const [newRecurso, setNewRecurso] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('planos_assinatura')
        .select('*')
        .order('preco_centavos', { ascending: true });

      if (error) throw error;

      setPlans(data?.map(p => ({
        ...p,
        recursos: Array.isArray(p.recursos) ? p.recursos : [],
      })) || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = () => {
    setIsCreating(true);
    setFormData(emptyPlan);
  };

  const handleEditClick = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      nome: plan.nome,
      slug: plan.slug,
      preco_centavos: plan.preco_centavos,
      intervalo: plan.intervalo,
      descricao: plan.descricao || '',
      recursos: plan.recursos,
      ativo: plan.ativo,
      destaque: plan.destaque,
      max_usuarios: plan.max_usuarios,
      max_lojas: plan.max_lojas,
    });
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.slug) {
      toast.error('Nome e slug são obrigatórios');
      return;
    }

    try {
      const planData = {
        nome: formData.nome,
        slug: formData.slug,
        preco_centavos: formData.preco_centavos,
        intervalo: formData.intervalo,
        descricao: formData.descricao || null,
        recursos: formData.recursos,
        ativo: formData.ativo,
        destaque: formData.destaque,
        max_usuarios: formData.max_usuarios,
        max_lojas: formData.max_lojas,
      };

      if (isCreating) {
        const { error } = await supabase
          .from('planos_assinatura')
          .insert(planData);

        if (error) throw error;
        toast.success('Plano criado com sucesso');
      } else if (editingPlan) {
        const { error } = await supabase
          .from('planos_assinatura')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        toast.success('Plano atualizado com sucesso');
      }

      setIsCreating(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(error.message || 'Erro ao salvar plano');
    }
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;

    try {
      const { error } = await supabase
        .from('planos_assinatura')
        .delete()
        .eq('id', deletingPlan.id);

      if (error) throw error;

      toast.success('Plano excluído com sucesso');
      setDeletingPlan(null);
      fetchPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao excluir plano');
    }
  };

  const handleAddRecurso = () => {
    if (newRecurso.trim()) {
      setFormData({
        ...formData,
        recursos: [...formData.recursos, newRecurso.trim()],
      });
      setNewRecurso('');
    }
  };

  const handleRemoveRecurso = (index: number) => {
    setFormData({
      ...formData,
      recursos: formData.recursos.filter((_, i) => i !== index),
    });
  };

  const formatPrice = (centavos: number) => {
    return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <SuperAdminLayout title="Planos">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Planos de Assinatura</h2>
            <p className="text-sm text-muted-foreground">
              Configure os planos e preços do sistema
            </p>
          </div>
          <Button onClick={handleCreateClick} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Plano
          </Button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <p>Carregando...</p>
          ) : plans.length === 0 ? (
            <p className="text-muted-foreground col-span-3 text-center py-8">
              Nenhum plano cadastrado
            </p>
          ) : (
            plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative ${plan.destaque ? 'border-primary shadow-lg' : ''} ${!plan.ativo ? 'opacity-60' : ''}`}
              >
                {plan.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary gap-1">
                      <Star className="h-3 w-3" />
                      Destaque
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {plan.nome}
                        {!plan.ativo && <Badge variant="secondary">Inativo</Badge>}
                      </CardTitle>
                      <CardDescription>{plan.slug}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(plan)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeletingPlan(plan)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {formatPrice(plan.preco_centavos)}
                    <span className="text-sm font-normal text-muted-foreground">/{plan.intervalo}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{plan.descricao}</p>
                  <div className="space-y-2 mb-4">
                    {plan.recursos.map((recurso, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {recurso}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <p>Máx. {plan.max_usuarios} usuários • {plan.max_lojas} lojas</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Tabela de Planos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Intervalo</TableHead>
                  <TableHead>Limites</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.nome}</TableCell>
                    <TableCell>{plan.slug}</TableCell>
                    <TableCell>{formatPrice(plan.preco_centavos)}</TableCell>
                    <TableCell className="capitalize">{plan.intervalo}</TableCell>
                    <TableCell>
                      {plan.max_usuarios} usuários / {plan.max_lojas} lojas
                    </TableCell>
                    <TableCell>
                      {plan.ativo ? (
                        <Badge className="bg-green-500">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating || !!editingPlan} onOpenChange={() => { setIsCreating(false); setEditingPlan(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Criar Plano' : 'Editar Plano'}</DialogTitle>
            <DialogDescription>
              {isCreating ? 'Configure os detalhes do novo plano' : `Editando plano: ${editingPlan?.nome}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Profissional"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug *</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                  placeholder="Ex: profissional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Preço (centavos)</label>
                <Input
                  type="number"
                  value={formData.preco_centavos}
                  onChange={(e) => setFormData({ ...formData, preco_centavos: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 9900 (R$ 99,00)"
                />
                <p className="text-xs text-muted-foreground">
                  = {formatPrice(formData.preco_centavos)}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Intervalo</label>
                <Select
                  value={formData.intervalo}
                  onValueChange={(value) => setFormData({ ...formData, intervalo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição breve do plano..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Máx. Usuários</label>
                <Input
                  type="number"
                  value={formData.max_usuarios}
                  onChange={(e) => setFormData({ ...formData, max_usuarios: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Máx. Lojas</label>
                <Input
                  type="number"
                  value={formData.max_lojas}
                  onChange={(e) => setFormData({ ...formData, max_lojas: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Recursos</label>
              <div className="flex gap-2">
                <Input
                  value={newRecurso}
                  onChange={(e) => setNewRecurso(e.target.value)}
                  placeholder="Ex: Suporte prioritário"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRecurso())}
                />
                <Button type="button" variant="outline" onClick={handleAddRecurso}>
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.recursos.map((recurso, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {recurso}
                    <button
                      type="button"
                      onClick={() => handleRemoveRecurso(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <label className="text-sm">Ativo</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.destaque}
                  onCheckedChange={(checked) => setFormData({ ...formData, destaque: checked })}
                />
                <label className="text-sm">Destaque</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreating(false); setEditingPlan(null); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPlan} onOpenChange={() => setDeletingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano <strong>{deletingPlan?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
};
