import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Store } from 'lucide-react';
import { toast } from 'sonner';
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
}

const Lojas = () => {
  const { organizationId } = useOrganization();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLoja, setEditingLoja] = useState<Loja | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    responsavel: '',
  });

  useEffect(() => {
    fetchLojas();
  }, []);

  const fetchLojas = async () => {
    try {
      // Excluir CPD da listagem de lojas gerenciáveis
      const { data, error } = await supabase
        .from('lojas')
        .select('*')
        .neq('tipo', 'cpd')
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

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) return;

    try {
      const { error } = await supabase
        .from('lojas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Loja excluída com sucesso!');
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
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingLoja(null);
    setFormData({
      nome: '',
      responsavel: '',
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
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lojas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhuma loja cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  lojas.map((loja) => (
                    <TableRow key={loja.id}>
                      <TableCell className="font-medium">{loja.nome}</TableCell>
                      <TableCell>{loja.responsavel}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(loja)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(loja.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
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
