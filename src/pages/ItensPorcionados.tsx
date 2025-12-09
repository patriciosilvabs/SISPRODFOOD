import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, ShoppingBag, Timer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type UnidadeMedida = 'kg' | 'unidade' | 'g' | 'ml' | 'l' | 'traco' | 'lote';

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
  usa_traco_massa: boolean;
}

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: UnidadeMedida;
}

type EscalaConfiguracao = 'por_unidade' | 'por_traco' | 'por_lote';

interface InsumoVinculado {
  id?: string;
  insumo_id: string;
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
  escala_configuracao: EscalaConfiguracao;
}

const ItensPorcionados = () => {
  const { organizationId } = useOrganization();
  const [itens, setItens] = useState<ItemPorcionado[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosVinculados, setInsumosVinculados] = useState<InsumoVinculado[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemPorcionado | null>(null);
  
  // Função para determinar escala permitida baseada na unidade do item
  const getEscalaParaUnidade = (unidade: UnidadeMedida): EscalaConfiguracao => {
    switch (unidade) {
      case 'lote':
        return 'por_lote';
      case 'traco':
        return 'por_traco';
      default:
        return 'por_unidade';
    }
  };

  const getEscalaLabel = (unidade: UnidadeMedida): string => {
    switch (unidade) {
      case 'lote':
        return 'Por Lote';
      case 'traco':
        return 'Por Traço';
      default:
        return 'Por Unidade';
    }
  };

  // Estado para novo insumo vinculado
  const [novoInsumo, setNovoInsumo] = useState({
    insumo_id: '',
    quantidade: '',
    unidade: 'kg' as UnidadeMedida,
  });
  const [formData, setFormData] = useState({
    nome: '',
    peso_unitario_g: '0',
    unidade_medida: 'unidade' as UnidadeMedida,
    equivalencia_traco: '',
    perda_percentual_adicional: '0',
    timer_ativo: false,
    tempo_timer_minutos: '10',
    usa_traco_massa: false,
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

    if (!organizationId) {
      toast.error('Organização não identificada. Faça login novamente.');
      return;
    }

    try {
      const data = {
        nome: formData.nome,
        peso_unitario_g: parseFloat(formData.peso_unitario_g),
        insumo_vinculado_id: null,
        unidade_medida: formData.unidade_medida as UnidadeMedida,
        equivalencia_traco: formData.equivalencia_traco ? parseInt(formData.equivalencia_traco) : null,
        consumo_por_traco_g: 0,
        perda_percentual_adicional: parseFloat(formData.perda_percentual_adicional),
        timer_ativo: formData.timer_ativo,
        tempo_timer_minutos: parseInt(formData.tempo_timer_minutos) || 10,
        usa_traco_massa: formData.usa_traco_massa,
        organization_id: organizationId,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('itens_porcionados')
          .update(data)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Item atualizado com sucesso!');
      } else {
        const { data: newItem, error } = await supabase
          .from('itens_porcionados')
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        
        // Se é um novo item e há insumos vinculados, salvar os insumos
        if (newItem && insumosVinculados.length > 0) {
        const insumosToInsert = insumosVinculados.map(insumo => ({
            item_porcionado_id: newItem.id,
            insumo_id: insumo.insumo_id,
            nome: insumo.nome,
            quantidade: insumo.quantidade,
            unidade: insumo.unidade,
            is_principal: false,
            consumo_por_traco_g: null,
            escala_configuracao: insumo.escala_configuracao,
            organization_id: organizationId,
          }));
          
          const { error: insumosError } = await supabase
            .from('insumos_extras')
            .insert(insumosToInsert);
            
          if (insumosError) {
            console.error('Erro ao salvar insumos vinculados:', insumosError);
          }
        }
        
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

  const loadInsumosVinculados = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('insumos_extras')
        .select('*')
        .eq('item_porcionado_id', itemId);

      if (error) throw error;
      
      // Mapear dados para o formato do componente
      const mapped: InsumoVinculado[] = (data || []).map(item => ({
        id: item.id,
        insumo_id: item.insumo_id,
        nome: item.nome,
        quantidade: item.quantidade,
        unidade: item.unidade as UnidadeMedida,
        escala_configuracao: (item as any).escala_configuracao || 'por_unidade',
      }));
      
      setInsumosVinculados(mapped);
    } catch (error) {
      console.error('Erro ao carregar insumos vinculados:', error);
      toast.error('Erro ao carregar insumos vinculados');
    }
  };

  const adicionarInsumoVinculado = async () => {
    if (!novoInsumo.insumo_id || !novoInsumo.quantidade) {
      toast.error('Preencha todos os campos do insumo');
      return;
    }

    if (!organizationId) {
      toast.error('Organização não identificada. Faça login novamente.');
      return;
    }

    const insumoSelecionado = insumos.find(i => i.id === novoInsumo.insumo_id);
    if (!insumoSelecionado) return;

    // Escala é determinada automaticamente pela unidade do item
    const escalaAutomatica = getEscalaParaUnidade(formData.unidade_medida);

    const novoInsumoVinculado: InsumoVinculado = {
      insumo_id: novoInsumo.insumo_id,
      nome: insumoSelecionado.nome,
      quantidade: parseFloat(novoInsumo.quantidade),
      unidade: novoInsumo.unidade,
      escala_configuracao: escalaAutomatica,
    };

    // Se estamos editando, salvar no banco
    if (editingItem) {
      try {
        const { data, error } = await supabase
          .from('insumos_extras')
          .insert({
            item_porcionado_id: editingItem.id,
            insumo_id: novoInsumo.insumo_id,
            nome: insumoSelecionado.nome,
            quantidade: parseFloat(novoInsumo.quantidade),
            unidade: novoInsumo.unidade,
            is_principal: false,
            consumo_por_traco_g: null,
            escala_configuracao: escalaAutomatica,
            organization_id: organizationId,
          })
          .select()
          .single();

        if (error) throw error;

        novoInsumoVinculado.id = data.id;
        toast.success('Insumo vinculado adicionado');
      } catch (error) {
        console.error('Erro ao adicionar insumo vinculado:', error);
        toast.error('Erro ao adicionar insumo vinculado');
        return;
      }
    }

    setInsumosVinculados([...insumosVinculados, novoInsumoVinculado]);
    setNovoInsumo({ insumo_id: '', quantidade: '', unidade: 'kg' });
  };

  const removerInsumoVinculado = async (index: number) => {
    const insumo = insumosVinculados[index];
    
    // Se tem ID, remover do banco
    if (insumo.id) {
      try {
        const { error } = await supabase
          .from('insumos_extras')
          .delete()
          .eq('id', insumo.id);

        if (error) throw error;
        toast.success('Insumo removido');
      } catch (error) {
        console.error('Erro ao remover insumo:', error);
        toast.error('Erro ao remover insumo');
        return;
      }
    }

    const novosInsumos = insumosVinculados.filter((_, i) => i !== index);
    setInsumosVinculados(novosInsumos);
  };

  const openEditDialog = async (item: ItemPorcionado) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome,
      peso_unitario_g: item.peso_unitario_g.toString(),
      unidade_medida: item.unidade_medida,
      equivalencia_traco: item.equivalencia_traco?.toString() || '',
      perda_percentual_adicional: item.perda_percentual_adicional.toString(),
      timer_ativo: item.timer_ativo || false,
      tempo_timer_minutos: item.tempo_timer_minutos?.toString() || '10',
      usa_traco_massa: item.usa_traco_massa || false,
    });
    await loadInsumosVinculados(item.id);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setInsumosVinculados([]);
    setFormData({
      nome: '',
      peso_unitario_g: '0',
      unidade_medida: 'unidade',
      equivalencia_traco: '',
      perda_percentual_adicional: '0',
      timer_ativo: false,
      tempo_timer_minutos: '10',
      usa_traco_massa: false,
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

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => fetchData()} disabled={loading} className="!bg-green-600 hover:!bg-green-700 text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                          <SelectItem value="lote">lote</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(formData.unidade_medida === 'traco' || formData.unidade_medida === 'lote') && (
                    <div className="space-y-2">
                      <Label htmlFor="equivalencia">
                        Equivalência por {formData.unidade_medida === 'lote' ? 'Lote' : 'Traço'} (unidades)
                      </Label>
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
                        placeholder={`Ex: 52 unidades por ${formData.unidade_medida === 'lote' ? 'lote' : 'traço'}`}
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

                  {/* Produção por Lote (Fila de Traços/Lotes) */}
                  {(formData.unidade_medida === 'traco' || formData.unidade_medida === 'lote') && (
                    <div className="flex items-start space-x-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <Checkbox
                        id="usa_traco_massa"
                        checked={formData.usa_traco_massa}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, usa_traco_massa: checked as boolean })
                        }
                      />
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="usa_traco_massa" className="font-medium cursor-pointer flex items-center gap-2">
                          📋 Produção por lote (fila de {formData.unidade_medida === 'lote' ? 'lotes' : 'traços'})
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Quando ativo, cada {formData.unidade_medida === 'lote' ? 'lote' : 'traço'} será produzido sequencialmente. 
                          O próximo só pode iniciar quando o timer do anterior terminar.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Seção de Insumos Vinculados */}
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        📦 Insumos Vinculados
                      </h4>
                      <p className="text-xs text-muted-foreground mb-4">
                        Configure os insumos que serão debitados automaticamente quando a produção for finalizada.
                      </p>
                    </div>

                    {/* Lista de insumos vinculados */}
                    {insumosVinculados.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {insumosVinculados.map((insumo, index) => (
                          <div 
                            key={insumo.id || index} 
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">{insumo.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {insumo.quantidade} {insumo.unidade} • 
                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  insumo.escala_configuracao === 'por_traco' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                  insumo.escala_configuracao === 'por_lote' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>
                                  {insumo.escala_configuracao === 'por_traco' ? 'por traço' : 
                                   insumo.escala_configuracao === 'por_lote' ? 'por lote' : 'por unidade'}
                                </span>
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removerInsumoVinculado(index)}
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Formulário para adicionar novo insumo */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4 space-y-2">
                          <Label>Insumo</Label>
                          <Select
                            value={novoInsumo.insumo_id}
                            onValueChange={(value) => 
                              setNovoInsumo({ ...novoInsumo, insumo_id: value })
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

                        <div className="col-span-2 space-y-2">
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={novoInsumo.quantidade}
                            onChange={(e) => 
                              setNovoInsumo({ ...novoInsumo, quantidade: e.target.value })
                            }
                            placeholder="0"
                          />
                        </div>

                        <div className="col-span-2 space-y-2">
                          <Label>Unidade</Label>
                          <Select
                            value={novoInsumo.unidade}
                            onValueChange={(value: UnidadeMedida) => 
                              setNovoInsumo({ ...novoInsumo, unidade: value })
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

                        <div className="col-span-2 space-y-2">
                          <Label>Escala</Label>
                          <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              formData.unidade_medida === 'lote' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                              formData.unidade_medida === 'traco' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {getEscalaLabel(formData.unidade_medida)}
                            </span>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={adicionarInsumoVinculado}
                            className="w-full"
                          >
                            + Adicionar
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-[10px] text-muted-foreground">
                        🔒 Escala automática: determinada pela unidade do item ({getEscalaLabel(formData.unidade_medida)}) para evitar erros de cálculo.
                      </p>
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
                  <TableHead>Perda (%)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum item cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>{item.peso_unitario_g.toFixed(2)}</TableCell>
                      <TableCell>{item.unidade_medida}</TableCell>
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

export default ItensPorcionados;
