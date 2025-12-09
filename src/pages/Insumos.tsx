import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Package, RefreshCw, Settings } from 'lucide-react';
import { ConfigurarEstoqueMinimoInsumoModal } from '@/components/modals/ConfigurarEstoqueMinimoInsumoModal';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { numberToWords } from '@/lib/numberToWords';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type UnidadeMedida = 'kg' | 'unidade' | 'g' | 'ml' | 'l' | 'traco';

interface Insumo {
  id: string;
  nome: string;
  quantidade_em_estoque: number;
  unidade_medida: UnidadeMedida;
  estoque_minimo: number;
  perda_percentual: number;
  data_ultima_movimentacao: string | null;
  dias_cobertura_desejado: number | null;
  lead_time_real_dias: number | null;
}

const Insumos = () => {
  const { organizationId } = useOrganization();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [estoqueModalOpen, setEstoqueModalOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    quantidade_em_estoque: '0',
    unidade_medida: 'kg' as UnidadeMedida,
    estoque_minimo: '0',
    perda_percentual: '0',
    dias_cobertura_desejado: '7',
    lead_time_real_dias: '',
  });

  useEffect(() => {
    fetchInsumos();
  }, []);

  const fetchInsumos = async () => {
    try {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .order('nome');

      if (error) throw error;
      setInsumos(data || []);
    } catch (error) {
      console.error('Error fetching insumos:', error);
      toast.error('Erro ao carregar insumos');
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
      const data = {
        nome: formData.nome,
        quantidade_em_estoque: parseFloat(formData.quantidade_em_estoque),
        unidade_medida: formData.unidade_medida as UnidadeMedida,
        estoque_minimo: parseFloat(formData.estoque_minimo),
        perda_percentual: parseFloat(formData.perda_percentual),
        dias_cobertura_desejado: parseInt(formData.dias_cobertura_desejado) || 7,
        lead_time_real_dias: formData.lead_time_real_dias ? parseInt(formData.lead_time_real_dias) : null,
        organization_id: organizationId,
      };

      if (editingInsumo) {
        const { error } = await supabase
          .from('insumos')
          .update(data)
          .eq('id', editingInsumo.id);

        if (error) throw error;
        toast.success('Insumo atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('insumos')
          .insert([data]);

        if (error) throw error;
        toast.success('Insumo criado com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchInsumos();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este insumo?')) return;

    try {
      const { error } = await supabase
        .from('insumos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Insumo excluído com sucesso!');
      fetchInsumos();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openEditDialog = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    setFormData({
      nome: insumo.nome,
      quantidade_em_estoque: insumo.quantidade_em_estoque.toString(),
      unidade_medida: insumo.unidade_medida,
      estoque_minimo: insumo.estoque_minimo.toString(),
      perda_percentual: insumo.perda_percentual.toString(),
      dias_cobertura_desejado: insumo.dias_cobertura_desejado?.toString() || '7',
      lead_time_real_dias: insumo.lead_time_real_dias?.toString() || '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingInsumo(null);
    setFormData({
      nome: '',
      quantidade_em_estoque: '0',
      unidade_medida: 'kg',
      estoque_minimo: '0',
      perda_percentual: '0',
      dias_cobertura_desejado: '7',
      lead_time_real_dias: '',
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
            <h1 className="text-3xl font-bold">Insumos</h1>
            <p className="text-muted-foreground mt-1">
              Gerenciar matérias-primas e insumos de produção
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEstoqueModalOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Estoque Mínimo Semanal
            </Button>
            <Button size="sm" onClick={() => fetchInsumos()} disabled={loading} className="!bg-green-600 hover:!bg-green-700 text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Insumo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do insumo
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantidade">Quantidade em Estoque</Label>
                      <Input
                        id="quantidade"
                        type="number"
                        step="0.001"
                        value={formData.quantidade_em_estoque}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            quantidade_em_estoque: e.target.value,
                          })
                        }
                        required
                      />
                      {formData.quantidade_em_estoque && parseFloat(formData.quantidade_em_estoque) > 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          {numberToWords(formData.quantidade_em_estoque, formData.unidade_medida)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unidade">Unidade de Medida</Label>
                      <Select
                        value={formData.unidade_medida}
                        onValueChange={(value) =>
                          setFormData({ ...formData, unidade_medida: value as UnidadeMedida })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="unidade">unidade</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="l">l</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                      <Input
                        id="estoque_minimo"
                        type="number"
                        step="0.001"
                        value={formData.estoque_minimo}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            estoque_minimo: e.target.value,
                          })
                        }
                        required
                      />
                      {formData.estoque_minimo && parseFloat(formData.estoque_minimo) > 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          {numberToWords(formData.estoque_minimo, formData.unidade_medida)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="perda">Perda (%)</Label>
                      <Input
                        id="perda"
                        type="number"
                        step="0.01"
                        value={formData.perda_percentual}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            perda_percentual: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  {/* Parâmetros Lista de Compras */}
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-3">📊 Parâmetros Lista de Compras</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dias_cobertura">Dias de Cobertura</Label>
                        <Input
                          id="dias_cobertura"
                          type="number"
                          min="1"
                          value={formData.dias_cobertura_desejado}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              dias_cobertura_desejado: e.target.value,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Dias de estoque desejado
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lead_time">Lead Time (dias)</Label>
                        <Input
                          id="lead_time"
                          type="number"
                          min="0"
                          placeholder="Tempo de entrega"
                          value={formData.lead_time_real_dias}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lead_time_real_dias: e.target.value,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Tempo entrega fornecedor
                        </p>
                      </div>
                    </div>
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
                    {editingInsumo ? 'Atualizar' : 'Criar'}
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
              <Package className="h-5 w-5" />
              Lista de Insumos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Estoque Mínimo</TableHead>
                  <TableHead>Perda (%)</TableHead>
                  <TableHead>Cobertura</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insumos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nenhum insumo cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  insumos.map((insumo) => (
                    <TableRow key={insumo.id}>
                      <TableCell className="font-medium">{insumo.nome}</TableCell>
                      <TableCell>
                        <span
                          className={
                            insumo.quantidade_em_estoque < insumo.estoque_minimo
                              ? 'text-warning font-semibold'
                              : ''
                          }
                        >
                          {insumo.quantidade_em_estoque.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>{insumo.unidade_medida}</TableCell>
                      <TableCell>{insumo.estoque_minimo.toFixed(2)}</TableCell>
                      <TableCell>{insumo.perda_percentual}%</TableCell>
                      <TableCell>{insumo.dias_cobertura_desejado || 7} dias</TableCell>
                      <TableCell>{insumo.lead_time_real_dias ? `${insumo.lead_time_real_dias} dias` : '-'}</TableCell>
                      <TableCell className="text-sm">
                        {insumo.data_ultima_movimentacao ? (
                          <span className="text-muted-foreground">
                            {format(new Date(insumo.data_ultima_movimentacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Sem movimentação</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(insumo)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(insumo.id)}
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

        <ConfigurarEstoqueMinimoInsumoModal
          open={estoqueModalOpen}
          onOpenChange={setEstoqueModalOpen}
        />
      </div>
    </Layout>
  );
};

export default Insumos;
