import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, ShoppingBag, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
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
  consumo_por_traco_g: number | null;
  perda_percentual_adicional: number;
  timer_ativo: boolean;
  tempo_timer_minutos: number;
}

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: UnidadeMedida;
}

interface InsumoExtra {
  id?: string;
  insumo_id: string;
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
}

const ItensPorcionados = () => {
  const [itens, setItens] = useState<ItemPorcionado[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosExtras, setInsumosExtras] = useState<InsumoExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemPorcionado | null>(null);
  
  // Estado para novo insumo extra
  const [novoInsumoExtra, setNovoInsumoExtra] = useState({
    insumo_id: '',
    quantidade: '',
    unidade: 'kg' as UnidadeMedida,
  });
  const [formData, setFormData] = useState({
    nome: '',
    peso_unitario_g: '0',
    insumo_vinculado_id: '',
    unidade_medida: 'unidade' as UnidadeMedida,
    equivalencia_traco: '',
    consumo_por_traco_g: '0',
    perda_percentual_adicional: '0',
    timer_ativo: false,
    tempo_timer_minutos: '10',
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
        .select('id, nome, unidade_medida')
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
        consumo_por_traco_g: formData.consumo_por_traco_g ? parseFloat(formData.consumo_por_traco_g) : 0,
        perda_percentual_adicional: parseFloat(formData.perda_percentual_adicional),
        timer_ativo: formData.timer_ativo,
        tempo_timer_minutos: parseInt(formData.tempo_timer_minutos) || 10,
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

  const loadInsumosExtras = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('insumos_extras')
        .select('*')
        .eq('item_porcionado_id', itemId);

      if (error) throw error;
      setInsumosExtras(data || []);
    } catch (error) {
      console.error('Erro ao carregar insumos extras:', error);
      toast.error('Erro ao carregar insumos extras');
    }
  };

  const adicionarInsumoExtra = async () => {
    if (!editingItem || !novoInsumoExtra.insumo_id || !novoInsumoExtra.quantidade) {
      toast.error('Preencha todos os campos do insumo extra');
      return;
    }

    try {
      const insumoSelecionado = insumos.find(i => i.id === novoInsumoExtra.insumo_id);
      if (!insumoSelecionado) return;

      const { error } = await supabase
        .from('insumos_extras')
        .insert({
          item_porcionado_id: editingItem.id,
          insumo_id: novoInsumoExtra.insumo_id,
          nome: insumoSelecionado.nome,
          quantidade: parseFloat(novoInsumoExtra.quantidade),
          unidade: novoInsumoExtra.unidade,
        });

      if (error) throw error;

      toast.success('Insumo extra adicionado');
      await loadInsumosExtras(editingItem.id);
      setNovoInsumoExtra({ insumo_id: '', quantidade: '', unidade: 'kg' });
    } catch (error) {
      console.error('Erro ao adicionar insumo extra:', error);
      toast.error('Erro ao adicionar insumo extra');
    }
  };

  const removerInsumoExtra = async (id: string) => {
    try {
      const { error } = await supabase
        .from('insumos_extras')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Insumo extra removido');
      if (editingItem) {
        await loadInsumosExtras(editingItem.id);
      }
    } catch (error) {
      console.error('Erro ao remover insumo extra:', error);
      toast.error('Erro ao remover insumo extra');
    }
  };

  const openEditDialog = async (item: ItemPorcionado) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome,
      peso_unitario_g: item.peso_unitario_g.toString(),
      insumo_vinculado_id: item.insumo_vinculado_id || 'none',
      unidade_medida: item.unidade_medida,
      equivalencia_traco: item.equivalencia_traco?.toString() || '',
      consumo_por_traco_g: item.consumo_por_traco_g?.toString() || '0',
      perda_percentual_adicional: item.perda_percentual_adicional.toString(),
      timer_ativo: item.timer_ativo || false,
      tempo_timer_minutos: item.tempo_timer_minutos?.toString() || '10',
    });
    await loadInsumosExtras(item.id);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setInsumosExtras([]);
    setFormData({
      nome: '',
      peso_unitario_g: '0',
      insumo_vinculado_id: 'none',
      unidade_medida: 'unidade',
      equivalencia_traco: '',
      consumo_por_traco_g: '0',
      perda_percentual_adicional: '0',
      timer_ativo: false,
      tempo_timer_minutos: '10',
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
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="equivalencia">Equivalência por Traço</Label>
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
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="consumo_traco">Consumo por Traço (Principal)</Label>
                          <Input
                            id="consumo_traco"
                            type="number"
                            step="0.01"
                            value={formData.consumo_por_traco_g}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                consumo_por_traco_g: e.target.value,
                              })
                            }
                            placeholder="Em gramas (ex: 1)"
                          />
                        </div>
                      </>
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

                  {/* Timer de Produção */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="timer_ativo"
                        checked={formData.timer_ativo}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, timer_ativo: checked as boolean })
                        }
                      />
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="timer_ativo" className="font-medium cursor-pointer flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          Ativar timer de produção
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Define um cronômetro regressivo para este item na tela de produção (ex: tempo de cozimento, tempo de preparo)
                        </p>
                      </div>
                    </div>

                    {formData.timer_ativo && (
                      <div className="space-y-2 ml-6">
                        <Label htmlFor="tempo_timer">Tempo do Timer (minutos)</Label>
                        <Input
                          id="tempo_timer"
                          type="number"
                          min="1"
                          value={formData.tempo_timer_minutos}
                          onChange={(e) => 
                            setFormData({ ...formData, tempo_timer_minutos: e.target.value })
                          }
                          placeholder="Ex: 10"
                          className="max-w-[200px]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Seção de Insumos Adicionais */}
                  {editingItem && (
                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <h4 className="font-semibold mb-2">Insumos Adicionais (Baixa na Finalização)</h4>
                        <p className="text-xs text-muted-foreground mb-4">
                          Configure insumos extras que serão debitados automaticamente quando a produção for finalizada
                        </p>
                      </div>

                      {/* Lista de insumos extras */}
                      {insumosExtras.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {insumosExtras.map((extra) => (
                            <div key={extra.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{extra.nome}</p>
                                <p className="text-xs text-muted-foreground">
                                  {extra.quantidade} {extra.unidade} por {formData.unidade_medida === 'traco' ? 'traço' : 'unidade'}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => extra.id && removerInsumoExtra(extra.id)}
                              >
                                ✕
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulário para adicionar novo insumo extra */}
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5 space-y-2">
                          <Label>Insumo</Label>
                          <Select
                            value={novoInsumoExtra.insumo_id}
                            onValueChange={(value) => 
                              setNovoInsumoExtra({ ...novoInsumoExtra, insumo_id: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {insumos.map((insumo) => (
                                <SelectItem key={insumo.id} value={insumo.id}>
                                  {insumo.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-3 space-y-2">
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={novoInsumoExtra.quantidade}
                            onChange={(e) => 
                              setNovoInsumoExtra({ ...novoInsumoExtra, quantidade: e.target.value })
                            }
                            placeholder="0"
                          />
                        </div>

                        <div className="col-span-2 space-y-2">
                          <Label>Unidade</Label>
                          <Select
                            value={novoInsumoExtra.unidade}
                            onValueChange={(value: UnidadeMedida) => 
                              setNovoInsumoExtra({ ...novoInsumoExtra, unidade: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="l">l</SelectItem>
                              <SelectItem value="ml">ml</SelectItem>
                              <SelectItem value="unidade">un</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={adicionarInsumoExtra}
                            className="w-full"
                          >
                            + Adicionar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
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
