import { useState, useEffect, useRef, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { 
  Loader2, RefreshCw, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ContagemSummaryCards } from '@/components/contagem/ContagemSummaryCards';
import { ContagemItemCard } from '@/components/contagem/ContagemItemCard';
import { ContagemPageHeader } from '@/components/contagem/ContagemPageHeader';
import { ContagemFixedFooter } from '@/components/contagem/ContagemFixedFooter';
import { SolicitarProducaoExtraModal } from '@/components/modals/SolicitarProducaoExtraModal';

interface Loja {
  id: string;
  nome: string;
  responsavel: string;
}

interface ItemPorcionado {
  id: string;
  nome: string;
  peso_unitario_g: number;
}

interface Contagem {
  id: string;
  loja_id: string;
  item_porcionado_id: string;
  final_sobra: number;
  peso_total_g: number | null;
  ideal_amanha: number;
  a_produzir: number;
  usuario_nome: string;
  updated_at: string;
  item_nome?: string;
}

interface EstoqueIdeal {
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

const diasSemanaLabels: Record<keyof EstoqueIdeal, string> = {
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
  sabado: 'Sáb',
  domingo: 'Dom'
};

const ContagemPorcionados = () => {
  const { user, roles, isAdmin } = useAuth();
  const { organizationId } = useOrganization();
  
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [itens, setItens] = useState<ItemPorcionado[]>([]);
  const [contagens, setContagens] = useState<Record<string, Contagem[]>>({});
  const [openLojas, setOpenLojas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ lojaId: string; itemId: string; itemNome: string } | null>(null);
  const [estoquesIdeais, setEstoquesIdeais] = useState<EstoqueIdeal>({
    segunda: 200,
    terca: 200,
    quarta: 200,
    quinta: 200,
    sexta: 200,
    sabado: 200,
    domingo: 200,
  });
  const [estoquesIdeaisMap, setEstoquesIdeaisMap] = useState<Record<string, EstoqueIdeal>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    lojaId: string;
    itemId: string;
    warnings: string[];
  } | null>(null);
  const [savingDialog, setSavingDialog] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [lojaAtualId, setLojaAtualId] = useState<string | null>(null);
  
  // Estado para modal de produção extra
  const [producaoExtraModal, setProducaoExtraModal] = useState<{
    open: boolean;
    item: { id: string; nome: string };
    loja: { id: string; nome: string };
    demandaAtual: number;
    producaoAtual: number;
  } | null>(null);
  
  // Ref para rastrear a operação atual e evitar race conditions
  const currentOperationId = useRef<string | null>(null);

  // Verificar se usuário é restrito (não-admin)
  const isRestrictedUser = !isAdmin();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      // Carregar lojas baseado no role do usuário
      let lojasData: Loja[] = [];
      
      if (isRestrictedUser && user) {
        // Usuário restrito: buscar apenas lojas vinculadas via lojas_acesso
        const { data: lojasAcesso, error: acessoError } = await supabase
          .from('lojas_acesso')
          .select('loja_id')
          .eq('user_id', user.id);
        
        if (acessoError) throw acessoError;
        
        const lojasIds = lojasAcesso?.map(la => la.loja_id) || [];
        
        if (lojasIds.length > 0) {
          const { data, error } = await supabase
            .from('lojas')
            .select('*')
            .in('id', lojasIds)
            .order('nome');
          
          if (error) throw error;
          lojasData = data || [];
        }
      } else {
        // Admin/Produção: ver todas as lojas
        const { data, error } = await supabase
          .from('lojas')
          .select('*')
          .order('nome');
        
        if (error) throw error;
        lojasData = data || [];
      }

      // Carregar itens porcionados (apenas ativos)
      const { data: itensData, error: itensError } = await supabase
        .from('itens_porcionados')
        .select('id, nome, peso_unitario_g')
        .eq('ativo', true)
        .order('nome');
      
      if (itensError) throw itensError;

      // Carregar contagens do dia atual
      const today = new Date().toISOString().split('T')[0];
      const { data: contagensData, error: contagensError } = await supabase
        .from('contagem_porcionados')
        .select('*')
        .eq('dia_operacional', today)
        .order('updated_at', { ascending: false });

      if (contagensError) throw contagensError;

      // Carregar estoques ideais semanais
      const { data: estoquesData, error: estoquesError } = await supabase
        .from('estoques_ideais_semanais')
        .select('*');
      
      if (estoquesError) throw estoquesError;

      // Criar mapa de estoques ideais por loja e item
      const estoquesMap: Record<string, EstoqueIdeal> = {};
      (estoquesData || []).forEach((estoque: any) => {
        const key = `${estoque.loja_id}-${estoque.item_porcionado_id}`;
        estoquesMap[key] = {
          segunda: estoque.segunda,
          terca: estoque.terca,
          quarta: estoque.quarta,
          quinta: estoque.quinta,
          sexta: estoque.sexta,
          sabado: estoque.sabado,
          domingo: estoque.domingo,
        };
      });
      setEstoquesIdeaisMap(estoquesMap);

      setLojas(lojasData || []);
      setItens(itensData || []);

      // Organizar contagens por loja
      const contagensPorLoja: Record<string, Contagem[]> = {};
      const originals: Record<string, any> = {};
      
      (contagensData || []).forEach((contagem: any) => {
        const item = itensData?.find(i => i.id === contagem.item_porcionado_id);
        const contagemComNome = {
          ...contagem,
          item_nome: item?.nome || 'Item desconhecido',
        };
        
        if (!contagensPorLoja[contagem.loja_id]) {
          contagensPorLoja[contagem.loja_id] = [];
        }
        contagensPorLoja[contagem.loja_id].push(contagemComNome);
        
        // Salvar valores originais para detecção de mudanças
        const key = `${contagem.loja_id}-${contagem.item_porcionado_id}`;
        originals[key] = {
          final_sobra: String(contagem.final_sobra ?? ''),
          peso_total_g: String(contagem.peso_total_g ?? ''),
          ideal_amanha: contagem.ideal_amanha,
        };
      });

      // Inicializar originalValues para TODOS os pares loja-item
      (lojasData || []).forEach(loja => {
        (itensData || []).forEach(item => {
          const key = `${loja.id}-${item.id}`;
          if (!originals[key]) {
            originals[key] = {
              final_sobra: '',
              peso_total_g: '',
              ideal_amanha: 0,
            };
          }
        });
      });

      setContagens(contagensPorLoja);
      setOriginalValues(originals);
      
      // Abrir todas as lojas por padrão
      setOpenLojas(new Set(lojasData?.map(l => l.id) || []));

      // Definir primeira loja como atual
      if (lojasData.length > 0) {
        setLojaAtualId(lojasData[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleLoja = (lojaId: string) => {
    setLojaAtualId(lojaId);
    setOpenLojas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lojaId)) {
        newSet.delete(lojaId);
      } else {
        newSet.add(lojaId);
      }
      return newSet;
    });
  };

  const handleValueChange = (lojaId: string, itemId: string, field: string, value: string) => {
    const key = `${lojaId}-${itemId}`;
    
    setEditingValues(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  // Função auxiliar para normalizar valores para comparação
  const normalizeValue = (val: any): string => {
    if (val === null || val === undefined || val === '') return '';
    const num = Number(val);
    return isNaN(num) ? String(val) : String(num);
  };

  // Função para detectar se uma linha está "dirty"
  const isRowDirty = (lojaId: string, itemId: string): boolean => {
    const key = `${lojaId}-${itemId}`;
    const current = editingValues[key];
    const original = originalValues[key];
    
    if (!current) return false;
    
    const fields = ['final_sobra', 'peso_total_g'];
    for (const field of fields) {
      if (current[field] !== undefined) {
        const currentVal = normalizeValue(current[field]);
        const originalVal = normalizeValue(original?.[field]);
        
        if (currentVal !== originalVal) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Verificar se há qualquer alteração pendente
  const hasAnyChanges = (): boolean => {
    const keys = Object.keys(editingValues);
    
    return keys.some(key => {
      const lojaId = key.substring(0, 36);
      const itemId = key.substring(37);
      return isRowDirty(lojaId, itemId);
    });
  };

  // Obter todas as linhas com alterações
  const getDirtyRows = (): { lojaId: string; itemId: string }[] => {
    const dirtyRows: { lojaId: string; itemId: string }[] = [];
    
    lojas.forEach(loja => {
      itens.forEach(item => {
        if (isRowDirty(loja.id, item.id)) {
          dirtyRows.push({ lojaId: loja.id, itemId: item.id });
        }
      });
    });
    
    return dirtyRows;
  };

  // Função para salvar todas as alterações
  const handleSaveAll = async () => {
    const dirtyRows = getDirtyRows();
    
    if (dirtyRows.length === 0) {
      toast.info('Não há alterações para salvar');
      return;
    }
    
    setSavingAll(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const row of dirtyRows) {
      try {
        await executeSave(row.lojaId, row.itemId);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Erro ao salvar:', error);
      }
    }
    
    setSavingAll(false);
    
    if (errorCount === 0) {
      toast.success(`${successCount} item(ns) salvos com sucesso!`);
    } else {
      toast.warning(`${successCount} salvos, ${errorCount} com erro`);
    }
  };

  // Função para validar valores suspeitos
  const validateSuspiciousValues = (values: any): string[] => {
    const warnings: string[] = [];
    const sobra = parseInt(values?.final_sobra) || 0;
    const pesoKg = values?.peso_total_g ? parseFloat(values.peso_total_g) / 1000 : 0;
    
    if (sobra === 0 && pesoKg === 0) {
      warnings.push("Sobra e Peso estão zerados. Tem certeza que deseja salvar?");
    } else {
      if (sobra === 0) {
        warnings.push("A Sobra está zerada (0 unidades).");
      }
      if (pesoKg === 0) {
        warnings.push("O Peso está zerado (0 kg).");
      }
    }
    
    if (sobra > 499) {
      warnings.push(`Sobra muito alta: ${sobra} unidades. Verifique se está correto.`);
    }
    if (pesoKg > 499) {
      warnings.push(`Peso muito alto: ${pesoKg.toFixed(2)} kg. Verifique se está correto.`);
    }
    
    return warnings;
  };

  const handleSave = async (lojaId: string, itemId: string) => {
    const key = `${lojaId}-${itemId}`;
    const values = editingValues[key];
    
    const warnings = validateSuspiciousValues(values);
    if (warnings.length > 0) {
      setConfirmDialog({ open: true, lojaId, itemId, warnings });
      return;
    }
    
    await executeSave(lojaId, itemId);
  };

  // Sistema de retry com backoff exponencial
  const saveWithRetry = async (
    dataToSave: any, 
    maxRetries = 3
  ): Promise<{ success: boolean; error?: string }> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { error } = await supabase
          .from('contagem_porcionados')
          .upsert(dataToSave, {
            onConflict: 'loja_id,item_porcionado_id,dia_operacional',
          });

        if (!error) return { success: true };
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          toast.warning(`Tentativa ${attempt} falhou. Aguardando ${waitTime/1000}s para nova tentativa...`);
          await new Promise(r => setTimeout(r, waitTime));
        } else {
          return { success: false, error: error.message };
        }
      } catch (e: any) {
        if (attempt === maxRetries) {
          return { success: false, error: e.message || 'Erro desconhecido' };
        }
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }
    return { success: false, error: 'Falha após todas as tentativas' };
  };

  const executeSave = async (lojaId: string, itemId: string) => {
    const key = `${lojaId}-${itemId}`;
    const values = editingValues[key];
    const toastId = `save-${key}`;
    
    setSavingKeys(prev => new Set([...prev, key]));
    toast.loading('Salvando contagem...', { id: toastId });

    if (!user) {
      toast.error('Sessão expirada. Por favor, faça login novamente.', { id: toastId });
      setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }

    if (!organizationId) {
      toast.error('Erro de configuração. Organização não identificada.', { id: toastId });
      setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }

    const finalSobra = parseInt(values?.final_sobra);
    if (isNaN(finalSobra) || finalSobra < 0) {
      toast.error('Valor de Sobra inválido. Insira um número válido (≥ 0).', { id: toastId });
      setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }

    let idealAmanha = 0;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
      }

      const estoqueKey = `${lojaId}-${itemId}`;
      const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
      if (estoqueSemanal) {
        const currentDay = getCurrentDayKey();
        idealAmanha = estoqueSemanal[currentDay] || 0;
      }
      
      const aProduzir = Math.max(0, idealAmanha - finalSobra);

      // Obter o dia operacional (data de hoje no timezone de São Paulo)
      const today = new Date();
      const diaOperacional = today.toISOString().split('T')[0]; // formato YYYY-MM-DD

      const dataToSave = {
        loja_id: lojaId,
        item_porcionado_id: itemId,
        final_sobra: finalSobra,
        peso_total_g: values?.peso_total_g ? parseFloat(values.peso_total_g) : null,
        ideal_amanha: idealAmanha,
        usuario_id: user.id,
        usuario_nome: profile?.nome || user.email || 'Usuário',
        organization_id: organizationId,
        dia_operacional: diaOperacional,
      };

      const saveResult = await saveWithRetry(dataToSave);

      if (!saveResult.success) {
        toast.error(`Falha ao salvar: ${saveResult.error}`, { id: toastId, duration: 8000 });
        setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }

      // Disparar recálculo da produção em tempo real
      const { error: rpcError } = await supabase.rpc('criar_ou_atualizar_producao_registro', {
        p_item_id: itemId,
        p_organization_id: organizationId,
        p_usuario_id: user.id,
        p_usuario_nome: dataToSave.usuario_nome,
      });

      if (rpcError) {
        console.error('Erro ao atualizar produção em tempo real:', rpcError);
        // Não bloquear o fluxo - contagem já foi salva com sucesso
      }

      toast.success(`Contagem salva! Sobra: ${finalSobra} | Ideal: ${idealAmanha} | A Produzir: ${aProduzir}`, { 
        id: toastId,
        duration: 3000 
      });

      const newTimestamp = new Date().toISOString();
      const newPesoTotal = values?.peso_total_g ? parseFloat(values.peso_total_g) : null;

      setOriginalValues(prev => ({
        ...prev,
        [key]: {
          final_sobra: finalSobra,
          peso_total_g: newPesoTotal,
        }
      }));

      // Atualizar contagens com os novos valores e timestamp para exibição imediata
      // Atualizar contagens com os novos valores e timestamp para exibição imediata
      setContagens(prev => {
        const updated = { ...prev };
        const lojaContagens = [...(updated[lojaId] || [])];
        
        const existingIndex = lojaContagens.findIndex(c => c.item_porcionado_id === itemId);
        const itemInfo = itens.find(i => i.id === itemId);
        
        const updatedContagem = {
          loja_id: lojaId,
          item_porcionado_id: itemId,
          final_sobra: finalSobra,
          peso_total_g: newPesoTotal,
          updated_at: newTimestamp,
          item_nome: itemInfo?.nome || 'Item desconhecido',
        };
        
        if (existingIndex >= 0) {
          lojaContagens[existingIndex] = {
            ...lojaContagens[existingIndex],
            ...updatedContagem,
          };
        } else {
          lojaContagens.push(updatedContagem as any);
        }
        
        updated[lojaId] = lojaContagens;
        return updated;
      });
      
      setEditingValues(prev => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
      
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      
      let errorMsg = 'Erro desconhecido ao salvar';
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMsg = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message?.includes('permission') || error.message?.includes('policy') || error.message?.includes('403')) {
        errorMsg = 'Sem permissão para salvar. Contate o administrador.';
      } else if (error.message) {
        errorMsg = `Erro: ${error.message}`;
      }
      
      toast.error(errorMsg, { id: toastId, duration: 8000 });
    } finally {
      setSavingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const getCurrentDayKey = (baseDate?: string): keyof EstoqueIdeal => {
    const base = baseDate ? new Date(baseDate + 'T12:00:00') : new Date();
    const dayIndex = base.getDay();
    
    const days: (keyof EstoqueIdeal)[] = [
      'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'
    ];
    
    return days[dayIndex];
  };

  const getEditingValue = (lojaId: string, itemId: string, field: string, defaultValue: any) => {
    const key = `${lojaId}-${itemId}`;
    
    if (editingValues[key]?.[field] !== undefined) {
      return editingValues[key][field];
    }
    
    if (field === 'ideal_amanha') {
      const estoqueKey = `${lojaId}-${itemId}`;
      const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
      
      if (estoqueSemanal) {
        const currentDay = getCurrentDayKey();
        const idealValue = estoqueSemanal[currentDay];
        if (idealValue > 0) {
          return idealValue;
        }
      }
    }
    
    return defaultValue;
  };

  const openEstoquesDialog = async (lojaId: string, itemId: string, itemNome: string) => {
    const operationId = `${Date.now()}-${Math.random()}`;
    currentOperationId.current = operationId;
    
    setSavingDialog(false);
    setSelectedItem({ lojaId, itemId, itemNome });
    setEstoquesIdeais({
      segunda: 200,
      terca: 200,
      quarta: 200,
      quinta: 200,
      sexta: 200,
      sabado: 200,
      domingo: 200,
    });
    
    setDialogOpen(true);
    
    try {
      const { data, error } = await supabase
        .from('estoques_ideais_semanais')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('item_porcionado_id', itemId)
        .maybeSingle();
      
      if (currentOperationId.current !== operationId) {
        return;
      }
      
      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar estoques ideais:', error);
        return;
      }
      
      if (data) {
        setEstoquesIdeais({
          segunda: data.segunda,
          terca: data.terca,
          quarta: data.quarta,
          quinta: data.quinta,
          sexta: data.sexta,
          sabado: data.sabado,
          domingo: data.domingo,
        });
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
    }
  };

  const handleSaveEstoquesIdeais = async () => {
    if (!selectedItem) {
      toast.error('Nenhum item selecionado. Feche e reabra o dialog.');
      return;
    }

    if (!organizationId) {
      toast.error('Organização não identificada. Faça login novamente.');
      return;
    }

    const operationId = currentOperationId.current;
    const currentItem = { ...selectedItem };
    const currentEstoques = { ...estoquesIdeais };

    setSavingDialog(true);

    try {
      const { error } = await supabase
        .from('estoques_ideais_semanais')
        .upsert({
          loja_id: currentItem.lojaId,
          item_porcionado_id: currentItem.itemId,
          segunda: currentEstoques.segunda,
          terca: currentEstoques.terca,
          quarta: currentEstoques.quarta,
          quinta: currentEstoques.quinta,
          sexta: currentEstoques.sexta,
          sabado: currentEstoques.sabado,
          domingo: currentEstoques.domingo,
          organization_id: organizationId,
        }, {
          onConflict: 'loja_id,item_porcionado_id',
        });

      const key = `${currentItem.lojaId}-${currentItem.itemId}`;
      setEstoquesIdeaisMap(prev => ({
        ...prev,
        [key]: { ...currentEstoques },
      }));

      if (error) {
        console.error('Erro Supabase:', error);
        throw error;
      }

      if (currentOperationId.current !== operationId) {
        return;
      }

      toast.success('Estoques ideais salvos com sucesso');
      setDialogOpen(false);
      setSelectedItem(null);
      setSavingDialog(false);
    } catch (error: any) {
      if (currentOperationId.current !== operationId) {
        return;
      }
      
      console.error('Erro ao salvar:', error);
      if (error?.code === '42501' || error?.message?.includes('policy')) {
        toast.error('Você não tem permissão para editar este item.');
      } else if (error?.code === 'PGRST301') {
        toast.error('Conexão perdida. Verifique sua internet.');
      } else {
        toast.error('Erro ao salvar estoques ideais. Tente novamente.');
      }
      setSavingDialog(false);
    }
  };

  // Abrir modal de produção extra
  const handleOpenProducaoExtra = async (lojaId: string, item: { id: string; nome: string }) => {
    const loja = lojas.find(l => l.id === lojaId);
    if (!loja || !organizationId) return;

    // Buscar demanda atual (contagem) e produção programada
    const estoqueKey = `${lojaId}-${item.id}`;
    const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
    const currentDay = getCurrentDayKey();
    const idealFromConfig = estoqueSemanal?.[currentDay] ?? 0;
    
    const contagem = contagens[lojaId]?.find(c => c.item_porcionado_id === item.id);
    const finalSobra = contagem?.final_sobra ?? 0;
    const demandaAtual = Math.max(0, idealFromConfig - finalSobra);

    // Buscar produção programada
    const { data: producaoData } = await supabase
      .from('producao_registros')
      .select('unidades_programadas')
      .eq('item_id', item.id)
      .eq('organization_id', organizationId)
      .in('status', ['a_produzir', 'em_preparo', 'em_porcionamento', 'finalizado']);

    const producaoAtual = producaoData?.reduce((sum, p) => sum + (p.unidades_programadas || 0), 0) || 0;

    setProducaoExtraModal({
      open: true,
      item: { id: item.id, nome: item.nome },
      loja: { id: loja.id, nome: loja.nome },
      demandaAtual,
      producaoAtual,
    });
  };

  // Calcular estatísticas para os cards de resumo
  const summaryStats = useMemo(() => {
    const activeLojaId = lojaAtualId;
    if (!activeLojaId) return { totalItens: 0, pesoTotalG: 0, itensPendentes: 0, ultimaAtualizacao: undefined };
    
    const contagensLoja = contagens[activeLojaId] || [];
    let pesoTotal = 0;
    let ultimaData: Date | undefined;
    
    contagensLoja.forEach(c => {
      pesoTotal += c.peso_total_g || 0;
      const d = new Date(c.updated_at);
      if (!ultimaData || d > ultimaData) ultimaData = d;
    });
    
    // Itens não preenchidos = sem contagem salva
    const itensComContagem = new Set(contagensLoja.map(c => c.item_porcionado_id));
    const itensPendentes = itens.filter(i => !itensComContagem.has(i.id)).length;
    
    return {
      totalItens: itens.length,
      pesoTotalG: pesoTotal,
      itensPendentes,
      ultimaAtualizacao: ultimaData,
    };
  }, [lojaAtualId, contagens, itens]);

  const isAdminUser = roles.includes('Admin') || roles.includes('SuperAdmin');
  const showAdminCols = isAdminUser && showDetails;

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const currentDay = getCurrentDayKey();

  return (
    <Layout>
      <div className="space-y-6 pb-28">
        {/* Header da Página */}
        <ContagemPageHeader
          showDetails={showDetails}
          isAdmin={isAdminUser}
          loading={loading}
          onToggleDetails={() => setShowDetails(!showDetails)}
          onRefresh={loadData}
        />

        {/* Cards de Resumo */}
        {lojaAtualId && (
          <ContagemSummaryCards
            totalItens={summaryStats.totalItens}
            pesoTotalG={summaryStats.pesoTotalG}
            itensPendentes={summaryStats.itensPendentes}
            ultimaAtualizacao={summaryStats.ultimaAtualizacao}
          />
        )}

        {/* Lista de Lojas */}
        <div className="space-y-4">
          {lojas.map((loja) => {
            const contagensLoja = contagens[loja.id] || [];
            const isOpen = openLojas.has(loja.id);
            
            return (
              <Collapsible
                key={loja.id}
                open={isOpen}
                onOpenChange={() => toggleLoja(loja.id)}
                className="bg-card rounded-xl border-2 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-lg text-foreground">{loja.nome}</span>
                      <span className="text-sm text-muted-foreground">({loja.responsavel})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t-2 p-4 space-y-3">
                    {/* Itens da Loja */}
                    {itens.map((item) => {
                      const contagem = contagensLoja.find(c => c.item_porcionado_id === item.id);
                      const finalSobraRaw = getEditingValue(loja.id, item.id, 'final_sobra', contagem?.final_sobra ?? '');
                      const finalSobra = finalSobraRaw === '' ? 0 : Number(finalSobraRaw);
                      const pesoTotal = getEditingValue(loja.id, item.id, 'peso_total_g', contagem?.peso_total_g ?? '');
                      
                      const estoqueKey = `${loja.id}-${item.id}`;
                      const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
                      const idealFromConfig = estoqueSemanal?.[currentDay] ?? 0;
                      const aProduzir = Math.max(0, idealFromConfig - finalSobra);
                      const isDirty = isRowDirty(loja.id, item.id);
                      
                      return (
                        <ContagemItemCard
                          key={item.id}
                          item={item}
                          finalSobra={finalSobra}
                          pesoTotal={pesoTotal}
                          idealFromConfig={idealFromConfig}
                          aProduzir={aProduzir}
                          campoTocado={true}
                          isDirty={isDirty}
                          isItemNaoPreenchido={false}
                          sessaoAtiva={true}
                          isAdmin={isAdminUser}
                          showAdminCols={showAdminCols}
                          lastUpdate={contagem?.updated_at}
                          onIncrementSobra={() => handleValueChange(loja.id, item.id, 'final_sobra', String(finalSobra + 10))}
                          onDecrementSobra={() => finalSobra > 0 && handleValueChange(loja.id, item.id, 'final_sobra', String(finalSobra - 1))}
                          onPesoChange={(val) => handleValueChange(loja.id, item.id, 'peso_total_g', val)}
                          currentDayLabel={diasSemanaLabels[currentDay]}
                          showProducaoExtra={isAdminUser}
                          onSolicitarProducaoExtra={() => handleOpenProducaoExtra(loja.id, item)}
                        />
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Footer Fixo */}
        <ContagemFixedFooter
          isSessaoAtiva={false}
          podeEncerrar={false}
          savingAll={savingAll}
          hasChanges={hasAnyChanges()}
          itensPendentes={summaryStats.itensPendentes}
          changesCount={getDirtyRows().length}
          onEncerrar={() => {}}
          onSaveAll={handleSaveAll}
        />

        {/* Dialog para Estoques Ideais */}
        <Dialog 
          open={dialogOpen} 
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedItem(null);
              setSavingDialog(false);
              currentOperationId.current = null;
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Definir Estoques Ideais para {selectedItem?.itemNome}
              </DialogTitle>
              <DialogDescription>
                Defina a meta de estoque para o início de cada dia da semana.
                (Unidade: unidade)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="segunda">Segunda</Label>
                  <Input
                    id="segunda"
                    type="number"
                    value={estoquesIdeais.segunda}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, segunda: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terca">Terça</Label>
                  <Input
                    id="terca"
                    type="number"
                    value={estoquesIdeais.terca}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, terca: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quarta">Quarta</Label>
                  <Input
                    id="quarta"
                    type="number"
                    value={estoquesIdeais.quarta}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, quarta: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quinta">Quinta</Label>
                  <Input
                    id="quinta"
                    type="number"
                    value={estoquesIdeais.quinta}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, quinta: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sexta">Sexta</Label>
                  <Input
                    id="sexta"
                    type="number"
                    value={estoquesIdeais.sexta}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, sexta: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sabado">Sábado</Label>
                  <Input
                    id="sabado"
                    type="number"
                    value={estoquesIdeais.sabado}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, sabado: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="domingo">Domingo</Label>
                  <Input
                    id="domingo"
                    type="number"
                    value={estoquesIdeais.domingo}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, domingo: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEstoquesIdeais} disabled={savingDialog}>
                {savingDialog ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Estoques Ideais'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AlertDialog de Confirmação para Valores Suspeitos */}
        <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                Atenção: Valores Suspeitos Detectados
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="font-medium text-foreground">Os seguintes alertas foram identificados:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {confirmDialog?.warnings.map((w, i) => (
                      <li key={i} className="text-orange-600">{w}</li>
                    ))}
                  </ul>
                  <p className="mt-4 font-medium text-foreground">
                    Deseja continuar salvando mesmo assim?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDialog(null)}>
                Cancelar e Revisar
              </AlertDialogCancel>
              <AlertDialogAction 
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => {
                  if (confirmDialog) {
                    executeSave(confirmDialog.lojaId, confirmDialog.itemId);
                  }
                  setConfirmDialog(null);
                }}
              >
                Confirmar e Salvar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal de Produção Extra */}
        {producaoExtraModal && user && organizationId && (
          <SolicitarProducaoExtraModal
            open={producaoExtraModal.open}
            onOpenChange={(open) => !open && setProducaoExtraModal(null)}
            item={producaoExtraModal.item}
            loja={producaoExtraModal.loja}
            diaOperacional={new Date().toISOString().split('T')[0]}
            demandaAtual={producaoExtraModal.demandaAtual}
            producaoAtual={producaoExtraModal.producaoAtual}
            organizationId={organizationId}
            userId={user.id}
            onSuccess={loadData}
          />
        )}
      </div>
    </Layout>
  );
};

export default ContagemPorcionados;
