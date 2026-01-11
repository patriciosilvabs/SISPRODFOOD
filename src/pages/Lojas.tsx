import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Store, RefreshCw, Clock, Globe } from 'lucide-react';
import { useCanDelete } from '@/hooks/useCanDelete';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Loja {
  id: string;
  nome: string;
  responsavel: string;
  fuso_horario: string;
  cutoff_operacional: string;
  tipo: string | null;
}

// Lista de fusos horários brasileiros
const FUSOS_HORARIOS = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT -3)' },
  { value: 'America/Manaus', label: 'Manaus (AMT -4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (ACT -5)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (AMT -4)' },
  { value: 'America/Belem', label: 'Belém (BRT -3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (BRT -3)' },
  { value: 'America/Recife', label: 'Recife (BRT -3)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (FNT -2)' },
];

const Lojas = () => {
  const { organizationId } = useOrganization();
  const { canDelete } = useCanDelete();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLoja, setEditingLoja] = useState<Loja | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    responsavel: '',
    fuso_horario: 'America/Sao_Paulo',
    cutoff_operacional: '03:00',
  });

  useEffect(() => {
    fetchLojas();
  }, []);

  const fetchLojas = async () => {
    try {
      // Incluir todas as lojas (incluindo CPD)
      const { data, error } = await supabase
        .from('lojas')
        .select('*')
        .order('tipo', { ascending: true }) // CPD primeiro
        .order('nome');

      if (error) throw error;
      setLojas(data || []);
    } catch (error) {
      console.error('Error fetching lojas:', error);
      toast.error('Erro ao carregar lojas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      toast.error('Organização não identificada. Faça login novamente.');
      return;
    }

    try {
      const dataToSave = {
        ...formData,
        organization_id: organizationId,
      };

      if (editingLoja) {
        const { error } = await supabase
          .from('lojas')
          .update(dataToSave)
          .eq('id', editingLoja.id);

        if (error) throw error;
        toast.success('Loja atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('lojas')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Loja criada com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchLojas();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (loja: Loja) => {
    // Verificar permissão de exclusão
    if (!canDelete) {
      toast.error('Você não tem permissão para excluir lojas.');
      return;
    }

    // Impedir exclusão do CPD
    if (loja.tipo === 'cpd') {
      toast.error('O CPD é obrigatório e não pode ser excluído.');
      return;
    }

    if (!confirm('⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR PERMANENTEMENTE esta loja?\n\nEsta ação é IRREVERSÍVEL e todos os dados relacionados (estoques, contagens, acessos) serão perdidos.')) return;

    try {
      // 1. Deletar lojas_acesso
      await supabase
        .from('lojas_acesso')
        .delete()
        .eq('loja_id', loja.id);

      // 2. Deletar estoques_ideais_semanais
      await supabase
        .from('estoques_ideais_semanais')
        .delete()
        .eq('loja_id', loja.id);

      // 3. Deletar estoque_loja_itens
      await supabase
        .from('estoque_loja_itens')
        .delete()
        .eq('loja_id', loja.id);

      // 4. Deletar estoque_loja_produtos
      await supabase
        .from('estoque_loja_produtos')
        .delete()
        .eq('loja_id', loja.id);

      // 5. Deletar contagem_porcionados
      await supabase
        .from('contagem_porcionados')
        .delete()
        .eq('loja_id', loja.id);

      // 6. Finalmente deletar a loja
      const { error } = await supabase
        .from('lojas')
        .delete()
        .eq('id', loja.id);

      if (error) throw error;
      toast.success('Loja excluída permanentemente!');
      fetchLojas();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openEditDialog = (loja: Loja) => {
    setEditingLoja(loja);
    setFormData({
      nome: loja.nome,
      responsavel: loja.responsavel,
      fuso_horario: loja.fuso_horario || 'America/Sao_Paulo',
      cutoff_operacional: loja.cutoff_operacional?.slice(0, 5) || '03:00',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingLoja(null);
    setFormData({
      nome: '',
      responsavel: '',
      fuso_horario: 'America/Sao_Paulo',
      cutoff_operacional: '03:00',
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lojas</h1>
            <p className="text-muted-foreground mt-1">
              Gerenciar pontos de venda e seus estoques
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => fetchLojas()} disabled={loading} className="!bg-green-600 hover:!bg-green-700 text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Loja
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingLoja ? 'Editar Loja' : 'Nova Loja'}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados da loja
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Loja</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responsavel">Responsável</Label>
                    <Input
                      id="responsavel"
                      value={formData.responsavel}
                      onChange={(e) =>
                        setFormData({ ...formData, responsavel: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fuso_horario" className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" />
                      Fuso Horário
                    </Label>
                    <Select
                      value={formData.fuso_horario}
                      onValueChange={(value) =>
                        setFormData({ ...formData, fuso_horario: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fuso horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {FUSOS_HORARIOS.map((fuso) => (
                          <SelectItem key={fuso.value} value={fuso.value}>
                            {fuso.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cutoff_operacional" className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Cutoff Operacional
                    </Label>
                    <Input
                      id="cutoff_operacional"
                      type="time"
                      value={formData.cutoff_operacional}
                      onChange={(e) =>
                        setFormData({ ...formData, cutoff_operacional: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Contagens registradas até {formData.cutoff_operacional || '03:00'} serão consideradas para a produção do dia seguinte.
                    </p>
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingLoja ? 'Atualizar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Lista de Lojas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Fuso Horário</TableHead>
                  <TableHead>Cutoff</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lojas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma loja cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  lojas.map((loja) => {
                    const fusoLabel = FUSOS_HORARIOS.find(f => f.value === loja.fuso_horario)?.label || loja.fuso_horario;
                    const isCPD = loja.tipo === 'cpd';
                    return (
                      <TableRow key={loja.id} className={isCPD ? 'bg-primary/5' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {loja.nome}
                            {isCPD && (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                                CPD
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{loja.responsavel}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fusoLabel}</TableCell>
                        <TableCell className="text-xs">{loja.cutoff_operacional?.slice(0, 5) || '03:00'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(loja)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(loja)}
                              disabled={isCPD}
                              title={isCPD ? 'CPD não pode ser excluído' : 'Excluir loja'}
                            >
                              <Trash2 className={`h-4 w-4 text-destructive ${isCPD ? 'opacity-30' : ''}`} />
                            </Button>
                          )}
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
    </Layout>
  );
};

export default Lojas;
