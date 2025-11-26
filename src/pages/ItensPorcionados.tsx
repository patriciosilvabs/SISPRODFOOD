import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
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

interface ItemPorcionado {
  id: string;
  nome: string;
  peso_unitario_g: number;
  insumo_vinculado_id: string | null;
  unidade_medida: UnidadeMedida;
  equivalencia_traco: number | null;
  perda_percentual_adicional: number;
}

interface Insumo {
  id: string;
  nome: string;
}

const ItensPorcionados = () => {
  const [itens, setItens] = useState<ItemPorcionado[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemPorcionado | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    peso_unitario_g: '0',
    insumo_vinculado_id: '',
    unidade_medida: 'unidade' as UnidadeMedida,
    equivalencia_traco: '',
    perda_percentual_adicional: '0',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: itensData, error: itensError } = await supabase
        .from('itens_porcionados')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (itensError) throw itensError;

      const { data: insumosData, error: insumosError } = await supabase
        .from('insumos')
        .select('id, nome')
        .order('nome');

      if (insumosError) throw insumosError;

      setItens(itensData || []);
      setInsumos(insumosData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        nome: formData.nome,
        peso_unitario_g: parseFloat(formData.peso_unitario_g),
        insumo_vinculado_id: formData.insumo_vinculado_id === 'none' ? null : formData.insumo_vinculado_id || null,
        unidade_medida: formData.unidade_medida as UnidadeMedida,
        equivalencia_traco: formData.equivalencia_traco ? parseInt(formData.equivalencia_traco) : null,
        perda_percentual_adicional: parseFloat(formData.perda_percentual_adicional),
      };

      if (editingItem) {
        const { error } = await supabase
          .from('itens_porcionados')
          .update(data)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Item atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('itens_porcionados')
          .insert([data]);

        if (error) throw error;
        toast.success('Item criado com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const verificarRegistrosRelacionados = async (itemId: string) => {
    const counts = { producao: 0, romaneios: 0, contagens: 0 };
    
    try {
      const { count: producaoCount } = await supabase
        .from('producao_registros')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', itemId);
      
      const { count: romaneiosCount } = await supabase
        .from('romaneio_itens')
        .select('*', { count: 'exact', head: true })
        .eq('item_porcionado_id', itemId);
      
      const { count: contagensCount } = await supabase
        .from('contagem_porcionados')
        .select('*', { count: 'exact', head: true })
        .eq('item_porcionado_id', itemId);
      
      counts.producao = producaoCount || 0;
      counts.romaneios = romaneiosCount || 0;
      counts.contagens = contagensCount || 0;
    } catch (error) {
      console.error('Erro ao verificar registros relacionados:', error);
    }
    
    return counts;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja desativar este item?')) return;

    try {
      // Verificar se há registros relacionados
      const counts = await verificarRegistrosRelacionados(id);
      const totalRegistros = counts.producao + counts.romaneios + counts.contagens;
      
      if (totalRegistros > 0) {
        toast.error(
          `Este item possui registros relacionados e será desativado (não excluído):\n\n` +
          `• ${counts.producao} registro(s) de produção\n` +
          `• ${counts.romaneios} item(ns) em romaneios\n` +
          `• ${counts.contagens} contagem(ns)\n\n` +
          `O item não aparecerá mais nas operações diárias.`,
          { duration: 8000 }
        );
      }

      // Soft delete: marcar como inativo
      const { error } = await supabase
        .from('itens_porcionados')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Item desativado com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Erro ao desativar item:', error);
      toast.error('Erro ao desativar item: ' + error.message);
    }
  };

  const openEditDialog = (item: ItemPorcionado) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome,
      peso_unitario_g: item.peso_unitario_g.toString(),
      insumo_vinculado_id: item.insumo_vinculado_id || 'none',
      unidade_medida: item.unidade_medida,
      equivalencia_traco: item.equivalencia_traco?.toString() || '',
      perda_percentual_adicional: item.perda_percentual_adicional.toString(),
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      nome: '',
      peso_unitario_g: '0',
      insumo_vinculado_id: 'none',
      unidade_medida: 'unidade',
      equivalencia_traco: '',
      perda_percentual_adicional: '0',
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
            <h1 className="text-3xl font-bold">Itens Porcionados</h1>
            <p className="text-muted-foreground mt-1">
              Gerenciar produtos e itens de produção
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Editar Item' : 'Novo Item Porcionado'}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do item porcionado
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome do Item</Label>
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
                      <Label htmlFor="peso">Peso Unitário (g)</Label>
                      <Input
                        id="peso"
                        type="number"
                        step="0.01"
                        value={formData.peso_unitario_g}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            peso_unitario_g: e.target.value,
                          })
                        }
                        required
                      />
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
                          <SelectItem value="unidade">unidade</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="traco">traço</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="insumo">Insumo Vinculado</Label>
                    <Select
                      value={formData.insumo_vinculado_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, insumo_vinculado_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um insumo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {insumos.map((insumo) => (
                          <SelectItem key={insumo.id} value={insumo.id}>
                            {insumo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {formData.unidade_medida === 'traco' && (
                      <div className="space-y-2">
                        <Label htmlFor="equivalencia">Equivalência Traço</Label>
                        <Input
                          id="equivalencia"
                          type="number"
                          value={formData.equivalencia_traco}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              equivalencia_traco: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="perda">Perda Adicional (%)</Label>
                      <Input
                        id="perda"
                        type="number"
                        step="0.01"
                        value={formData.perda_percentual_adicional}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            perda_percentual_adicional: e.target.value,
                          })
                        }
                        required
                      />
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
                    {editingItem ? 'Atualizar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Lista de Itens Porcionados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Peso Unit. (g)</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Insumo Vinculado</TableHead>
                  <TableHead>Perda (%)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum item cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item) => {
                    const insumo = insumos.find(i => i.id === item.insumo_vinculado_id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell>{item.peso_unitario_g.toFixed(2)}</TableCell>
                        <TableCell>{item.unidade_medida}</TableCell>
                        <TableCell>{insumo?.nome || '-'}</TableCell>
                        <TableCell>{item.perda_percentual_adicional}%</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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
    </Layout>
  );
};

export default ItensPorcionados;
