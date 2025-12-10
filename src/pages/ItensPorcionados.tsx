import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, ShoppingBag, Timer, RefreshCw, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

type UnidadeMedida = 'kg' | 'unidade' | 'g' | 'ml' | 'l' | 'traco' | 'lote' | 'lote_com_perda' | 'lote_sem_perda' | 'lote_masseira' | 'saco' | 'caixa' | 'fardo';

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
  // Campos para Lote com Perda
  perda_cozimento_percentual?: number;
  peso_pronto_g?: number;
  // Campo para Lote sem Perda
  quantidade_por_lote?: number;
  // Campos para Embalagem Opcional
  usa_embalagem_por_porcao?: boolean;
  insumo_embalagem_id?: string | null;
  unidade_embalagem?: string;
  fator_consumo_embalagem_por_porcao?: number;
  // Campos para LOTE_MASSEIRA (Produção Industrial de Massa)
  farinha_por_lote_kg?: number;
  massa_gerada_por_lote_kg?: number;
  peso_minimo_bolinha_g?: number;
  peso_maximo_bolinha_g?: number;
  peso_alvo_bolinha_g?: number;
  peso_medio_operacional_bolinha_g?: number;
}

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: UnidadeMedida;
}

interface InsumoVinculado {
  id?: string;
  insumo_id: string;
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
}

const ItensPorcionados = () => {
  const { organizationId } = useOrganization();
  const [itens, setItens] = useState<ItemPorcionado[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosVinculados, setInsumosVinculados] = useState<InsumoVinculado[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemPorcionado | null>(null);
  
  // Estado para novo insumo vinculado
  const [novoInsumo, setNovoInsumo] = useState({
    insumo_id: '',
    quantidade: '',
    unidade: 'kg' as UnidadeMedida,
  });
  const [formData, setFormData] = useState({
    nome: '',
    unidade_medida: 'unidade' as UnidadeMedida,
    timer_ativo: false,
    tempo_timer_minutos: '10',
    usa_traco_massa: false,
    // Campos para Lote com Perda
    perda_cozimento_percentual: '0',
    peso_pronto_g: '',
    // Campo para Lote sem Perda
    quantidade_por_lote: '',
    // Campos para Embalagem Opcional
    usa_embalagem_por_porcao: false,
    insumo_embalagem_id: '',
    unidade_embalagem: 'unidade' as UnidadeMedida,
    fator_consumo_embalagem_por_porcao: '1',
    // Campos para LOTE_MASSEIRA
    farinha_por_lote_kg: '',
    massa_gerada_por_lote_kg: '',
    peso_minimo_bolinha_g: '',
    peso_maximo_bolinha_g: '',
    peso_alvo_bolinha_g: '',
  });

  // Cálculos automáticos para Lote com Perda
  const perdaCozimento = parseFloat(formData.perda_cozimento_percentual) || 0;
  const rendimentoCozimento = 100 - perdaCozimento;
  const pesoProntoG = parseFloat(formData.peso_pronto_g) || 0;
  const pesoCruPorPorcaoG = rendimentoCozimento > 0 ? pesoProntoG / (rendimentoCozimento / 100) : 0;

  // Quantidade automática do insumo para lote_com_perda (em kg)
  const quantidadeInsumoAutomatica = (() => {
    if (formData.unidade_medida !== 'lote_com_perda') return null;
    if (pesoProntoG <= 0 || perdaCozimento < 0 || rendimentoCozimento <= 0) return null;
    const pesoCruKg = pesoCruPorPorcaoG / 1000;
    return pesoCruKg.toFixed(3);
  })();

  // Quantidade automática do insumo para lote_masseira (em kg) - usa farinha_por_lote
  const quantidadeInsumoMasseiraAutomatica = (() => {
    if (formData.unidade_medida !== 'lote_masseira') return null;
    const farinhaLote = parseFloat(formData.farinha_por_lote_kg) || 0;
    if (farinhaLote <= 0) return null;
    return farinhaLote.toFixed(2);
  })();

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

    // Validação universal: insumo vinculado é OBRIGATÓRIO
    if (insumosVinculados.length === 0) {
      toast.error('É obrigatório vincular pelo menos um insumo (matéria-prima)');
      return;
    }

    // Validação para Lote com Perda
    if (formData.unidade_medida === 'lote_com_perda') {
      if (!formData.peso_pronto_g || parseFloat(formData.peso_pronto_g) <= 0) {
        toast.error('Peso Pronto é obrigatório para Lote com Perda');
        return;
      }
      if (!formData.perda_cozimento_percentual || parseFloat(formData.perda_cozimento_percentual) <= 0) {
        toast.error('Perda de Cozimento é obrigatória para Lote com Perda');
        return;
      }
      if (parseFloat(formData.perda_cozimento_percentual) > 90) {
        toast.error('Perda de cozimento não pode ser maior que 90%');
        return;
      }
    }

    // Validação para Lote sem Perda
    if (formData.unidade_medida === 'lote_sem_perda') {
      if (!formData.quantidade_por_lote || parseInt(formData.quantidade_por_lote) <= 0) {
        toast.error('Quantidade por Lote é obrigatória para Lote sem Perda');
        return;
      }
    }

    // Validação para LOTE_MASSEIRA
    if (formData.unidade_medida === 'lote_masseira') {
      const farinhaLote = parseFloat(formData.farinha_por_lote_kg);
      const massaGerada = parseFloat(formData.massa_gerada_por_lote_kg);
      const pesoMin = parseFloat(formData.peso_minimo_bolinha_g);
      const pesoMax = parseFloat(formData.peso_maximo_bolinha_g);
      const pesoAlvo = parseFloat(formData.peso_alvo_bolinha_g);

      if (!farinhaLote || farinhaLote <= 0) {
        toast.error('Farinha por Lote é obrigatório para Lote Masseira');
        return;
      }
      if (!massaGerada || massaGerada <= 0) {
        toast.error('Massa Gerada por Lote é obrigatório para Lote Masseira');
        return;
      }
      if (!pesoMin || pesoMin <= 0) {
        toast.error('Peso Mínimo da Bolinha é obrigatório');
        return;
      }
      if (!pesoMax || pesoMax <= 0) {
        toast.error('Peso Máximo da Bolinha é obrigatório');
        return;
      }
      if (!pesoAlvo || pesoAlvo <= 0) {
        toast.error('Peso Alvo da Bolinha é obrigatório');
        return;
      }
      if (pesoMin >= pesoMax) {
        toast.error('Peso Mínimo deve ser menor que Peso Máximo');
        return;
      }
      if (pesoAlvo < pesoMin || pesoAlvo > pesoMax) {
        toast.error('Peso Alvo deve estar entre Peso Mínimo e Peso Máximo');
        return;
      }
    }

    // Validação para Embalagem Opcional
    if (formData.usa_embalagem_por_porcao && !formData.insumo_embalagem_id) {
      toast.error('Selecione o insumo de embalagem');
      return;
    }

    // Verificar se já existe item com este nome na organização
    const { data: existingItem } = await supabase
      .from('itens_porcionados')
      .select('id, nome')
      .eq('organization_id', organizationId)
      .ilike('nome', formData.nome.trim())
      .eq('ativo', true)
      .maybeSingle();

    if (existingItem && !editingItem) {
      toast.error(`Já existe um item com o nome "${formData.nome}". Use outro nome ou edite o item existente.`);
      return;
    }

    // Para edição, verificar se outro item (diferente do atual) já usa o nome
    if (existingItem && editingItem && existingItem.id !== editingItem.id) {
      toast.error(`Outro item já possui o nome "${formData.nome}".`);
      return;
    }

    try {
      const insertData: any = {
        nome: formData.nome,
        peso_unitario_g: 0, // Será calculado automaticamente se necessário
        insumo_vinculado_id: null as string | null,
        unidade_medida: formData.unidade_medida as UnidadeMedida,
        equivalencia_traco: null,
        consumo_por_traco_g: 0,
        perda_percentual_adicional: 0,
        timer_ativo: formData.timer_ativo,
        tempo_timer_minutos: parseInt(formData.tempo_timer_minutos) || 10,
        usa_traco_massa: formData.usa_traco_massa,
        organization_id: organizationId,
        perda_cozimento_percentual: null as number | null,
        peso_pronto_g: null as number | null,
        quantidade_por_lote: null as number | null,
        // Embalagem opcional
        usa_embalagem_por_porcao: formData.usa_embalagem_por_porcao || false,
        insumo_embalagem_id: formData.usa_embalagem_por_porcao && formData.insumo_embalagem_id ? formData.insumo_embalagem_id : null,
        unidade_embalagem: formData.usa_embalagem_por_porcao ? formData.unidade_embalagem : null,
        fator_consumo_embalagem_por_porcao: formData.usa_embalagem_por_porcao ? parseFloat(formData.fator_consumo_embalagem_por_porcao) || 1 : null,
      };

      // Adicionar campos específicos de Lote com Perda
      if (formData.unidade_medida === 'lote_com_perda') {
        insertData.perda_cozimento_percentual = parseFloat(formData.perda_cozimento_percentual);
        insertData.peso_pronto_g = parseFloat(formData.peso_pronto_g);
        // O peso unitário para lote com perda é o peso cru por porção (calculado)
        insertData.peso_unitario_g = pesoCruPorPorcaoG;
      }

      // Adicionar campo específico de Lote sem Perda
      if (formData.unidade_medida === 'lote_sem_perda') {
        insertData.quantidade_por_lote = parseInt(formData.quantidade_por_lote);
        // Para lote sem perda, ativar fila de lotes automaticamente
        insertData.usa_traco_massa = true;
      }

      // Adicionar campos específicos de LOTE_MASSEIRA
      if (formData.unidade_medida === 'lote_masseira') {
        const pesoMin = parseFloat(formData.peso_minimo_bolinha_g);
        const pesoMax = parseFloat(formData.peso_maximo_bolinha_g);
        const pesoMedioOperacional = (pesoMin + pesoMax) / 2;
        
        insertData.farinha_por_lote_kg = parseFloat(formData.farinha_por_lote_kg);
        insertData.massa_gerada_por_lote_kg = parseFloat(formData.massa_gerada_por_lote_kg);
        insertData.peso_minimo_bolinha_g = pesoMin;
        insertData.peso_maximo_bolinha_g = pesoMax;
        insertData.peso_alvo_bolinha_g = parseFloat(formData.peso_alvo_bolinha_g);
        insertData.peso_medio_operacional_bolinha_g = pesoMedioOperacional;
        // Para masseira, ativar fila de lotes automaticamente
        insertData.usa_traco_massa = true;
        // Calcular unidades por lote para equivalencia_traco
        const massaGeradaKg = parseFloat(formData.massa_gerada_por_lote_kg);
        const unidadesPorLote = Math.floor(massaGeradaKg / (pesoMedioOperacional / 1000));
        insertData.equivalencia_traco = unidadesPorLote;
      }

      if (editingItem) {
        const { error } = await supabase
          .from('itens_porcionados')
          .update(insertData)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Item atualizado com sucesso!');
      } else {
        const { data: newItem, error } = await supabase
          .from('itens_porcionados')
          .insert([insertData])
          .select()
          .single();

        if (error) throw error;
        
        // Se é um novo item e há insumos vinculados, salvar os insumos
        if (newItem && insumosVinculados.length > 0) {
          // Para LOTE_MASSEIRA, todos os insumos são 'por_lote'
          const escalaConfig = formData.unidade_medida === 'lote_masseira' ? 'por_lote' : 'por_unidade';
          
          const insumosToInsert = insumosVinculados.map(insumo => ({
            item_porcionado_id: newItem.id,
            insumo_id: insumo.insumo_id,
            nome: insumo.nome,
            quantidade: insumo.quantidade,
            unidade: insumo.unidade as any,
            is_principal: false,
            consumo_por_traco_g: null as number | null,
            escala_configuracao: escalaConfig,
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
      }));
      
      setInsumosVinculados(mapped);
    } catch (error) {
      console.error('Erro ao carregar insumos vinculados:', error);
      toast.error('Erro ao carregar insumos vinculados');
    }
  };

  const adicionarInsumoVinculado = async () => {
    if (!novoInsumo.insumo_id) {
      toast.error('Selecione um insumo');
      return;
    }

    // Para lote_com_perda e lote_masseira, usar quantidade calculada automaticamente
    let quantidade: number;
    let unidade: UnidadeMedida;
    let isPrincipal = false;

    if (formData.unidade_medida === 'lote_com_perda') {
      if (!quantidadeInsumoAutomatica) {
        toast.error('Preencha Peso Pronto e Perda de Cozimento antes de adicionar insumo');
        return;
      }
      quantidade = parseFloat(quantidadeInsumoAutomatica);
      unidade = 'kg'; // Força kg para cálculo automático
      isPrincipal = insumosVinculados.length === 0;
    } else if (formData.unidade_medida === 'lote_masseira') {
      // LOTE_MASSEIRA: primeiro insumo é automático (farinha), demais são manuais (por lote)
      if (insumosVinculados.length === 0) {
        // PRIMEIRO INSUMO (FARINHA): usar quantidade automática
        if (!quantidadeInsumoMasseiraAutomatica) {
          toast.error('Preencha Farinha por Lote antes de adicionar o insumo principal');
          return;
        }
        quantidade = parseFloat(quantidadeInsumoMasseiraAutomatica);
        unidade = 'kg'; // Força kg para farinha
        isPrincipal = true;
      } else {
        // DEMAIS INSUMOS: usar quantidade manual (POR LOTE)
        quantidade = parseFloat(novoInsumo.quantidade) || 0;
        unidade = novoInsumo.unidade;
        
        if (quantidade <= 0) {
          toast.error('Informe a quantidade do insumo POR LOTE');
          return;
        }
      }
    } else {
      // Para outros tipos, usar quantidade manual
      quantidade = parseFloat(novoInsumo.quantidade) || 0;
      unidade = novoInsumo.unidade;
      
      if (quantidade <= 0) {
        toast.error('Informe a quantidade do insumo');
        return;
      }
    }

    if (!organizationId) {
      toast.error('Organização não identificada. Faça login novamente.');
      return;
    }

    const insumoSelecionado = insumos.find(i => i.id === novoInsumo.insumo_id);
    if (!insumoSelecionado) return;

    const novoInsumoVinculado: InsumoVinculado = {
      insumo_id: novoInsumo.insumo_id,
      nome: insumoSelecionado.nome,
      quantidade: quantidade,
      unidade: unidade,
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
            quantidade: quantidade,
            unidade: unidade as any,
            is_principal: isPrincipal,
            escala_configuracao: formData.unidade_medida === 'lote_masseira' ? 'por_lote' : 'por_unidade',
            consumo_por_traco_g: null as number | null,
            organization_id: organizationId,
          } as any)
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
      unidade_medida: item.unidade_medida,
      timer_ativo: item.timer_ativo || false,
      tempo_timer_minutos: item.tempo_timer_minutos?.toString() || '10',
      usa_traco_massa: item.usa_traco_massa || false,
      // Campos para Lote com Perda
      perda_cozimento_percentual: item.perda_cozimento_percentual?.toString() || '0',
      peso_pronto_g: item.peso_pronto_g?.toString() || '',
      // Campo para Lote sem Perda
      quantidade_por_lote: item.quantidade_por_lote?.toString() || '',
      // Campos para Embalagem Opcional
      usa_embalagem_por_porcao: item.usa_embalagem_por_porcao || false,
      insumo_embalagem_id: item.insumo_embalagem_id || '',
      unidade_embalagem: (item.unidade_embalagem as UnidadeMedida) || 'unidade',
      fator_consumo_embalagem_por_porcao: item.fator_consumo_embalagem_por_porcao?.toString() || '1',
      // Campos para LOTE_MASSEIRA
      farinha_por_lote_kg: item.farinha_por_lote_kg?.toString() || '',
      massa_gerada_por_lote_kg: item.massa_gerada_por_lote_kg?.toString() || '',
      peso_minimo_bolinha_g: item.peso_minimo_bolinha_g?.toString() || '',
      peso_maximo_bolinha_g: item.peso_maximo_bolinha_g?.toString() || '',
      peso_alvo_bolinha_g: item.peso_alvo_bolinha_g?.toString() || '',
    });
    await loadInsumosVinculados(item.id);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setInsumosVinculados([]);
    setFormData({
      nome: '',
      unidade_medida: 'unidade',
      timer_ativo: false,
      tempo_timer_minutos: '10',
      usa_traco_massa: false,
      perda_cozimento_percentual: '0',
      peso_pronto_g: '',
      quantidade_por_lote: '',
      // Embalagem
      usa_embalagem_por_porcao: false,
      insumo_embalagem_id: '',
      unidade_embalagem: 'unidade',
      fator_consumo_embalagem_por_porcao: '1',
      // Campos para LOTE_MASSEIRA
      farinha_por_lote_kg: '',
      massa_gerada_por_lote_kg: '',
      peso_minimo_bolinha_g: '',
      peso_maximo_bolinha_g: '',
      peso_alvo_bolinha_g: '',
    });
  };

  // Helper para exibir label da unidade
  const getUnidadeLabel = (unidade: string) => {
    switch (unidade) {
      case 'lote_com_perda': return '🔥 Lote c/ Perda';
      case 'lote_sem_perda': return '📦 Lote s/ Perda';
      case 'lote_masseira': return '🍕 Lote Masseira';
      case 'lote': return '📦 Lote';
      default: return unidade;
    }
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
                  {/* Nome do Item */}
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome do Item *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      placeholder="Ex: Pão de Queijo, Frango Desfiado..."
                      required
                    />
                  </div>

                  {/* Unidade de Medida */}
                  <div className="space-y-2">
                    <Label htmlFor="unidade">Unidade de Medida *</Label>
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
                        <SelectItem value="unidade">Unidade</SelectItem>
                        <SelectItem value="kg">kg (quilograma)</SelectItem>
                        <SelectItem value="g">g (grama)</SelectItem>
                        <SelectItem value="lote_sem_perda">📦 Lote sem Perda</SelectItem>
                        <SelectItem value="lote_com_perda">🔥 Lote com Perda (cozimento)</SelectItem>
                        <SelectItem value="lote_masseira">🍕 Lote Masseira (Produção Industrial)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campos específicos para Lote SEM Perda */}
                  {formData.unidade_medida === 'lote_sem_perda' && (
                    <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">📦</span>
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200">Configuração de Lote sem Perda</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Configure quantas unidades cada lote produz. O consumo de insumos será calculado automaticamente.
                      </p>

                      <div className="space-y-2">
                        <Label htmlFor="quantidade_por_lote">Quantidade por Lote (unidades) *</Label>
                        <Input
                          id="quantidade_por_lote"
                          type="number"
                          min="1"
                          value={formData.quantidade_por_lote}
                          onChange={(e) =>
                            setFormData({ ...formData, quantidade_por_lote: e.target.value })
                          }
                          placeholder="Ex: 50"
                          required
                        />
                        <p className="text-xs text-muted-foreground">Ex: 1 lote = 50 unidades</p>
                      </div>

                      <div className="p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg border border-blue-300 dark:border-blue-700 mt-2">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          <strong>ℹ️ Como funciona:</strong> O consumo de insumos será: insumo_configurado × quantidade_de_lotes_produzidos.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Campos específicos para LOTE MASSEIRA */}
                  {formData.unidade_medida === 'lote_masseira' && (
                    <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🍕</span>
                        <h4 className="font-semibold text-amber-800 dark:text-amber-200">Configuração Industrial da Masseira</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Configure a capacidade da masseira e a faixa de peso da porcionadora. O sistema calculará automaticamente os lotes e a farinha necessária.
                      </p>

                      {/* Capacidade da Masseira */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="farinha_por_lote">Farinha por Lote (kg) *</Label>
                          <Input
                            id="farinha_por_lote"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={formData.farinha_por_lote_kg}
                            onChange={(e) =>
                              setFormData({ ...formData, farinha_por_lote_kg: e.target.value })
                            }
                            placeholder="Ex: 15"
                            required
                          />
                          <p className="text-xs text-muted-foreground">Kg de farinha consumida por lote</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="massa_gerada">Massa Gerada por Lote (kg) *</Label>
                          <Input
                            id="massa_gerada"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={formData.massa_gerada_por_lote_kg}
                            onChange={(e) =>
                              setFormData({ ...formData, massa_gerada_por_lote_kg: e.target.value })
                            }
                            placeholder="Ex: 25"
                            required
                          />
                          <p className="text-xs text-muted-foreground">Kg de massa total por lote</p>
                        </div>
                      </div>

                      {/* Faixa de Peso da Porcionadora */}
                      <div className="pt-3 border-t border-amber-200 dark:border-amber-700">
                        <Label className="font-semibold mb-2 block">⚖️ Faixa de Peso da Porcionadora</Label>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="peso_minimo">Peso Mínimo (g) *</Label>
                            <Input
                              id="peso_minimo"
                              type="number"
                              step="1"
                              min="1"
                              value={formData.peso_minimo_bolinha_g}
                              onChange={(e) =>
                                setFormData({ ...formData, peso_minimo_bolinha_g: e.target.value })
                              }
                              placeholder="Ex: 390"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="peso_alvo">Peso Alvo (g) *</Label>
                            <Input
                              id="peso_alvo"
                              type="number"
                              step="1"
                              min="1"
                              value={formData.peso_alvo_bolinha_g}
                              onChange={(e) =>
                                setFormData({ ...formData, peso_alvo_bolinha_g: e.target.value })
                              }
                              placeholder="Ex: 422"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="peso_maximo">Peso Máximo (g) *</Label>
                            <Input
                              id="peso_maximo"
                              type="number"
                              step="1"
                              min="1"
                              value={formData.peso_maximo_bolinha_g}
                              onChange={(e) =>
                                setFormData({ ...formData, peso_maximo_bolinha_g: e.target.value })
                              }
                              placeholder="Ex: 480"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cálculos Automáticos */}
                      {formData.farinha_por_lote_kg && formData.massa_gerada_por_lote_kg && formData.peso_minimo_bolinha_g && formData.peso_maximo_bolinha_g && (
                        <div className="pt-3 border-t border-amber-200 dark:border-amber-700">
                          <Label className="font-semibold mb-2 block">📊 Cálculos Automáticos</Label>
                          {(() => {
                            const pesoMin = parseFloat(formData.peso_minimo_bolinha_g) || 0;
                            const pesoMax = parseFloat(formData.peso_maximo_bolinha_g) || 0;
                            const pesoMedioOp = (pesoMin + pesoMax) / 2;
                            const massaGerada = parseFloat(formData.massa_gerada_por_lote_kg) || 0;
                            const unidadesPorLote = pesoMedioOp > 0 ? Math.floor(massaGerada / (pesoMedioOp / 1000)) : 0;
                            return (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-2 bg-background rounded border text-sm">
                                  <span className="text-muted-foreground">Peso Médio Operacional:</span>
                                  <span className="font-bold ml-2">{pesoMedioOp.toFixed(0)} g</span>
                                </div>
                                <div className="p-2 bg-background rounded border text-sm">
                                  <span className="text-muted-foreground">Unidades por Lote:</span>
                                  <span className="font-bold ml-2">{unidadesPorLote} un</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div className="p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700 mt-2">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          <strong>ℹ️ Como funciona:</strong> O sistema calculará automaticamente quantos lotes são necessários e ajustará o peso médio operacional com base na média móvel dos últimos 10 lotes finalizados.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Campos específicos para Lote COM Perda */}
                  {formData.unidade_medida === 'lote_com_perda' && (
                    <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🔥</span>
                        <h4 className="font-semibold text-orange-800 dark:text-orange-200">Configuração de Lote com Perda</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Configure os parâmetros de cozimento. O sistema calculará automaticamente o peso cru necessário.
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="peso_pronto">Peso Unitário Pronto (g) *</Label>
                          <Input
                            id="peso_pronto"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.peso_pronto_g}
                            onChange={(e) =>
                              setFormData({ ...formData, peso_pronto_g: e.target.value })
                            }
                            placeholder="Ex: 150"
                            required
                          />
                          <p className="text-xs text-muted-foreground">Peso da porção após o cozimento</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="perda_cozimento">Perda no Cozimento (%) *</Label>
                          <Input
                            id="perda_cozimento"
                            type="number"
                            step="1"
                            min="0"
                            max="90"
                            value={formData.perda_cozimento_percentual}
                            onChange={(e) =>
                              setFormData({ ...formData, perda_cozimento_percentual: e.target.value })
                            }
                            placeholder="Ex: 30"
                            required
                          />
                          <p className="text-xs text-muted-foreground">Percentual perdido no cozimento</p>
                        </div>
                      </div>

                      {/* Campos calculados automaticamente */}
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-orange-200 dark:border-orange-700">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Rendimento (%)</Label>
                          <div className="p-2 bg-background rounded border text-sm font-medium">
                            {rendimentoCozimento.toFixed(1)}%
                          </div>
                          <p className="text-xs text-muted-foreground">Calculado: 100 - perda</p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Peso Cru por Porção (g)</Label>
                          <div className="p-2 bg-background rounded border text-sm font-medium">
                            {pesoCruPorPorcaoG.toFixed(2)} g
                          </div>
                          <p className="text-xs text-muted-foreground">Calculado: peso pronto ÷ rendimento</p>
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mt-2">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          <strong>ℹ️ Como funciona:</strong> A loja informa porções prontas. O sistema converte automaticamente para KG de insumo cru. 
                          O CPD recebe apenas o peso cru a preparar.
                        </p>
                      </div>
                    </div>
                  )}

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

                  {/* Produção por Lote Sequencial - apenas para lote_sem_perda ou lote */}
                  {(formData.unidade_medida === 'lote_sem_perda' || formData.unidade_medida === 'lote') && (
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
                          📋 Produção por lote (fila de lotes)
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Quando ativo, cada lote será produzido sequencialmente. 
                          O próximo lote só pode iniciar quando o timer do anterior terminar.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Seção de Insumos Vinculados - OBRIGATÓRIO */}
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        📦 Insumos Vinculados (Obrigatório) *
                      </h4>
                      <p className="text-xs text-muted-foreground mb-4">
                        Configure quanto cada lote consome dos insumos. Estes valores serão debitados automaticamente quando a produção for finalizada.
                      </p>
                    </div>

                    {/* Alerta se não há insumos vinculados */}
                    {insumosVinculados.length === 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          É obrigatório vincular pelo menos um insumo (matéria-prima).
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Lista de insumos vinculados */}
                    {insumosVinculados.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {insumosVinculados.map((insumo, index) => (
                          <div 
                            key={insumo.id || index} 
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {insumo.nome}
                                {formData.unidade_medida === 'lote_masseira' && index === 0 && (
                                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(Principal)</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {insumo.quantidade} {insumo.unidade} {
                                  ['lote_masseira', 'lote_com_perda', 'lote_sem_perda', 'lote'].includes(formData.unidade_medida) 
                                    ? 'por lote' 
                                    : formData.unidade_medida === 'kg' 
                                      ? 'por kg' 
                                      : formData.unidade_medida === 'g' 
                                        ? 'por g' 
                                        : 'por unidade'
                                }
                                {(formData.unidade_medida === 'lote_com_perda' || 
                                  (formData.unidade_medida === 'lote_masseira' && index === 0)) && (
                                  <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded text-[10px] font-medium">
                                    🔒 Automático
                                  </span>
                                )}
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
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5 space-y-2">
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

                      <div className="col-span-3 space-y-2">
                        <Label>Quantidade {formData.unidade_medida === 'lote_masseira' && insumosVinculados.length > 0 && '(por lote)'}</Label>
                        {formData.unidade_medida === 'lote_com_perda' ? (
                          // Campo READ-ONLY para Lote com Perda
                          <Input
                            type="text"
                            value={quantidadeInsumoAutomatica ? `${quantidadeInsumoAutomatica} kg` : 'Preencha peso/perda acima'}
                            disabled
                            className="bg-muted cursor-not-allowed"
                          />
                        ) : formData.unidade_medida === 'lote_masseira' && insumosVinculados.length === 0 ? (
                          // Campo READ-ONLY apenas para PRIMEIRO insumo do Lote Masseira (farinha)
                          <Input
                            type="text"
                            value={quantidadeInsumoMasseiraAutomatica ? `${quantidadeInsumoMasseiraAutomatica} kg` : 'Preencha farinha/lote acima'}
                            disabled
                            className="bg-muted cursor-not-allowed"
                          />
                        ) : (
                          // Campo editável para outros tipos E para insumos adicionais do lote_masseira
                          <Input
                            type="number"
                            step="0.001"
                            value={novoInsumo.quantidade}
                            onChange={(e) => 
                              setNovoInsumo({ ...novoInsumo, quantidade: e.target.value })
                            }
                            placeholder={formData.unidade_medida === 'lote_masseira' ? 'Qtd por lote' : 'Ex: 6'}
                          />
                        )}
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label>Unidade</Label>
                        {formData.unidade_medida === 'lote_com_perda' || 
                         (formData.unidade_medida === 'lote_masseira' && insumosVinculados.length === 0) ? (
                          // Unidade fixa kg para Lote com Perda e PRIMEIRO insumo do Lote Masseira
                          <Input value="kg" disabled className="bg-muted cursor-not-allowed" />
                        ) : (
                          // Dropdown normal para outros tipos E insumos adicionais do lote_masseira
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
                              <SelectItem value="l">litro</SelectItem>
                              <SelectItem value="ml">ml</SelectItem>
                              <SelectItem value="unidade">unidade</SelectItem>
                              <SelectItem value="saco">saco</SelectItem>
                              <SelectItem value="caixa">caixa</SelectItem>
                              <SelectItem value="fardo">fardo</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={adicionarInsumoVinculado}
                          className="w-full"
                          disabled={
                            !novoInsumo.insumo_id || 
                            (formData.unidade_medida === 'lote_com_perda' 
                              ? !quantidadeInsumoAutomatica 
                              : formData.unidade_medida === 'lote_masseira'
                              ? insumosVinculados.length === 0 
                                ? !quantidadeInsumoMasseiraAutomatica // Primeiro: precisa ter farinha configurada
                                : !novoInsumo.quantidade || parseFloat(novoInsumo.quantidade) <= 0 // Demais: precisa ter quantidade manual
                              : !novoInsumo.quantidade || parseFloat(novoInsumo.quantidade) <= 0)
                          }
                        >
                          + Adicionar
                        </Button>
                      </div>
                    </div>

                    {/* Tooltip explicativo para Lote Masseira */}
                    {formData.unidade_medida === 'lote_masseira' && (
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-700">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          {insumosVinculados.length === 0 ? (
                            <>
                              <strong>🔒 INSUMO PRINCIPAL (Farinha):</strong> Quantidade automática = {formData.farinha_por_lote_kg || '?'} kg por lote. 
                              Não pode ser editado manualmente.
                            </>
                          ) : (
                            <>
                              <strong>📝 INSUMOS ADICIONAIS:</strong> Configure a quantidade POR LOTE de cada insumo. 
                              O sistema multiplicará automaticamente pelos lotes produzidos.
                            </>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Seção de Embalagem Opcional por Porção */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="usa_embalagem_por_porcao"
                        checked={formData.usa_embalagem_por_porcao}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, usa_embalagem_por_porcao: checked as boolean })
                        }
                      />
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="usa_embalagem_por_porcao" className="font-medium cursor-pointer flex items-center gap-2">
                          🎁 Usa embalagem por porção?
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Marque se cada porção produzida consome uma embalagem (saco, bandeja, etc). O sistema calculará automaticamente o consumo.
                        </p>
                      </div>
                    </div>

                    {/* Campos de Embalagem - aparecem quando checkbox ativo */}
                    {formData.usa_embalagem_por_porcao && (
                      <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 ml-6">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🎁</span>
                          <h4 className="font-semibold text-purple-800 dark:text-purple-200">Configuração de Embalagem</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Insumo Embalagem */}
                          <div className="space-y-2">
                            <Label htmlFor="insumo_embalagem">Insumo Embalagem *</Label>
                            <Select
                              value={formData.insumo_embalagem_id}
                              onValueChange={(value) => 
                                setFormData({ ...formData, insumo_embalagem_id: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a embalagem..." />
                              </SelectTrigger>
                              <SelectContent>
                                {insumos.map((insumo) => (
                                  <SelectItem key={insumo.id} value={insumo.id}>
                                    {insumo.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Ex: Saco plástico 1kg, Bandeja isopor</p>
                          </div>

                          {/* Unidade da Embalagem */}
                          <div className="space-y-2">
                            <Label htmlFor="unidade_embalagem">Unidade *</Label>
                            <Select
                              value={formData.unidade_embalagem}
                              onValueChange={(value: UnidadeMedida) => 
                                setFormData({ ...formData, unidade_embalagem: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unidade">unidade</SelectItem>
                                <SelectItem value="saco">saco</SelectItem>
                                <SelectItem value="caixa">caixa</SelectItem>
                                <SelectItem value="fardo">fardo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Fator de Consumo */}
                        <div className="space-y-2">
                          <Label htmlFor="fator_consumo">Fator de Consumo (por porção)</Label>
                          <Input
                            id="fator_consumo"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={formData.fator_consumo_embalagem_por_porcao}
                            onChange={(e) =>
                              setFormData({ ...formData, fator_consumo_embalagem_por_porcao: e.target.value })
                            }
                            placeholder="1"
                            className="max-w-[200px]"
                          />
                          <p className="text-xs text-muted-foreground">
                            Quantas embalagens por porção. Ex: 1 = cada porção usa 1 saco.
                          </p>
                        </div>

                        {/* Info do cálculo automático */}
                        <div className="p-3 bg-purple-100/50 dark:bg-purple-900/30 rounded-lg border border-purple-300 dark:border-purple-700 mt-2">
                          <p className="text-xs text-purple-800 dark:text-purple-200">
                            <strong>🔒 Cálculo Automático:</strong> Para cada porção produzida, o sistema debitará automaticamente{' '}
                            <span className="font-semibold">{formData.fator_consumo_embalagem_por_porcao || 1}</span>{' '}
                            {formData.unidade_embalagem}(s) do estoque de embalagens.
                          </p>
                        </div>
                      </div>
                    )}
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
                  <Button type="submit" disabled={insumosVinculados.length === 0}>
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
                  <TableHead>Unidade</TableHead>
                  <TableHead>Configuração</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhum item cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.nome}
                        {item.timer_ativo && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">
                            <Timer className="inline h-3 w-3 mr-1" />
                            {item.tempo_timer_minutos}min
                          </span>
                        )}
                        {item.usa_embalagem_por_porcao && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded">
                            🎁 Embalagem
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.unidade_medida === 'lote_com_perda' 
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
                            : item.unidade_medida === 'lote_sem_perda'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {getUnidadeLabel(item.unidade_medida)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.unidade_medida === 'lote_com_perda' ? (
                          <div>
                            <span>{item.peso_pronto_g?.toFixed(0)}g pronto</span>
                            <span className="mx-1">|</span>
                            <span className="text-orange-600">{item.perda_cozimento_percentual}% perda</span>
                          </div>
                        ) : item.unidade_medida === 'lote_sem_perda' ? (
                          <span>{item.quantidade_por_lote || '-'} un/lote</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
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
