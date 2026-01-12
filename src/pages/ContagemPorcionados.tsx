import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Sparkles, Settings, ChevronDown, ChevronUp, X, Loader2, RefreshCw, AlertTriangle, Plus, Minus, Eye, EyeOff } from 'lucide-react';
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
import { numberToWords } from '@/lib/numberToWords';
import { WeightInputInline } from '@/components/ui/weight-input';
import { parsePesoProgressivo } from '@/lib/weightUtils';
import { SaveButton } from '@/components/ui/save-button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  dia_operacional: string;
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
  const { user, roles, isAdmin, hasRole } = useAuth();
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
  const [diasOperacionaisPorLoja, setDiasOperacionaisPorLoja] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    lojaId: string;
    itemId: string;
    warnings: string[];
  } | null>(null);
  const [savingDialog, setSavingDialog] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  
  // Ref para rastrear a operação atual e evitar race conditions
  const currentOperationId = useRef<string | null>(null);

  // Verificar se usuário é restrito (não-admin e não-produção) - inclui funcionários de Loja e CPD
  const isRestrictedUser = !isAdmin() && !hasRole('Produção');

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
        // Usuário restrito (Loja ou CPD): buscar apenas lojas vinculadas via lojas_acesso
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

      // Carregar contagens do dia operacional atual de cada loja
      // Buscar todas contagens recentes e filtrar por dia operacional específico de cada loja
      const contagensPromises = lojasData.map(async (loja) => {
        // Calcular dia operacional específico da loja
        const { data: diaOp } = await supabase
          .rpc('calcular_dia_operacional', { p_loja_id: loja.id });
        
        const diaOperacionalLoja = diaOp || new Date().toISOString().split('T')[0];
        
        const { data: contagens, error } = await supabase
          .from('contagem_porcionados')
          .select('*')
          .eq('loja_id', loja.id)
          .eq('dia_operacional', diaOperacionalLoja)
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        return { lojaId: loja.id, diaOperacional: diaOperacionalLoja, contagens: contagens || [] };
      });
      
      const contagensResults = await Promise.all(contagensPromises);
      const contagensData = contagensResults.flatMap(r => r.contagens);
      
      // Armazenar dias operacionais por loja
      const diasOpMap: Record<string, string> = {};
      contagensResults.forEach(r => {
        diasOpMap[r.lojaId] = r.diaOperacional;
      });
      setDiasOperacionaisPorLoja(diasOpMap);

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
          final_sobra: contagem.final_sobra,
          peso_total_g: contagem.peso_total_g,
          ideal_amanha: contagem.ideal_amanha,
        };
      });

      setContagens(contagensPorLoja);
      setOriginalValues(originals);
      
      // Abrir todas as lojas por padrão
      setOpenLojas(new Set(lojasData?.map(l => l.id) || []));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleLoja = (lojaId: string) => {
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

  // Função para detectar se uma linha está "dirty" (com mudanças não salvas)
  const isRowDirty = (lojaId: string, itemId: string): boolean => {
    const key = `${lojaId}-${itemId}`;
    const current = editingValues[key];
    const original = originalValues[key];
    
    if (!current) return false; // Nenhuma edição ainda
    
    // Comparar campo a campo (ideal_amanha removido - não é mais editável)
    const fields = ['final_sobra', 'peso_total_g'];
    for (const field of fields) {
      if (current[field] !== undefined) {
        const currentVal = String(current[field] ?? '');
        const originalVal = String(original?.[field] ?? '');
        if (currentVal !== originalVal) return true;
      }
    }
    
    return false;
  };

  // Verificar se há qualquer alteração pendente
  const hasAnyChanges = (): boolean => {
    return Object.keys(editingValues).some(key => {
      const [lojaId, itemId] = key.split('-');
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
    
    // Verificar se ambos são zero
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
    
    // Verificar valores maiores que 499
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
    
    // Verificar valores suspeitos (inclui zero e valores altos)
    const warnings = validateSuspiciousValues(values);
    if (warnings.length > 0) {
      setConfirmDialog({ open: true, lojaId, itemId, warnings });
      return;
    }
    
    // Se não há alertas, salvar normalmente
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
        
        // Se erro de rede ou timeout, tentar novamente
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

  // Função de log de auditoria
  const logAudit = async (
    lojaId: string,
    itemId: string,
    diaOperacional: string,
    sobraEnviada: number,
    idealEnviado: number,
    aProduzir: number,
    status: 'SUCESSO' | 'ERRO' | 'VERIFICADO',
    contagemId?: string,
    mensagemErro?: string,
    dadosEnviados?: any,
    dadosVerificados?: any
  ) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user!.id)
        .single();
        
      await supabase.from('contagem_porcionados_audit').insert({
        contagem_id: contagemId || null,
        loja_id: lojaId,
        item_porcionado_id: itemId,
        dia_operacional: diaOperacional,
        valor_sobra_enviado: sobraEnviada,
        valor_ideal_enviado: idealEnviado,
        valor_a_produzir: aProduzir,
        usuario_id: user!.id,
        usuario_nome: profile?.nome || user!.email || 'Desconhecido',
        organization_id: organizationId,
        operacao: contagemId ? 'UPDATE' : 'INSERT',
        status,
        mensagem_erro: mensagemErro || null,
        dados_enviados: dadosEnviados || null,
        dados_verificados: dadosVerificados || null,
      });
    } catch (e) {
      console.error('Erro ao registrar auditoria (não crítico):', e);
    }
  };

  const executeSave = async (lojaId: string, itemId: string) => {
    const key = `${lojaId}-${itemId}`;
    const values = editingValues[key];
    const toastId = `save-${key}`;
    
    // Marcar como salvando
    setSavingKeys(prev => new Set([...prev, key]));
    
    // Mostrar indicador de progresso
    toast.loading('Salvando contagem...', { id: toastId });

    // ========== VALIDAÇÃO 1: Usuário autenticado ==========
    if (!user) {
      toast.error('Sessão expirada. Por favor, faça login novamente.', { id: toastId });
      setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }

    // ========== VALIDAÇÃO 2: Organization ID ==========
    if (!organizationId) {
      toast.error('Erro de configuração. Organização não identificada.', { id: toastId });
      setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }

    // ========== VALIDAÇÃO 3: Valor de sobra válido ==========
    const finalSobra = parseInt(values?.final_sobra);
    if (isNaN(finalSobra) || finalSobra < 0) {
      toast.error('Valor de Sobra inválido. Insira um número válido (≥ 0).', { id: toastId });
      setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }

    let diaOperacional: string = '';
    let idealAmanha = 0;
    let aProduzir = 0;
    let dataToSave: any = null;

    try {
      // Buscar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
      }

      // Buscar informações do item
      const { data: itemData, error: itemError } = await supabase
        .from('itens_porcionados')
        .select('nome, peso_unitario_g, unidade_medida, equivalencia_traco, consumo_por_traco_g, usa_traco_massa')
        .eq('id', itemId)
        .single();

      if (itemError || !itemData) {
        toast.error('Item não encontrado. Recarregue a página.', { id: toastId });
        await logAudit(lojaId, itemId, '', finalSobra, 0, 0, 'ERRO', undefined, 'Item não encontrado');
        setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }

      // CALCULAR DIA OPERACIONAL DA LOJA
      const { data: diaOpData, error: diaOpError } = await supabase
        .rpc('calcular_dia_operacional', { p_loja_id: lojaId });
      
      if (diaOpError || !diaOpData) {
        toast.error('Erro ao calcular dia operacional. Tente novamente.', { id: toastId });
        await logAudit(lojaId, itemId, '', finalSobra, 0, 0, 'ERRO', undefined, 'Falha ao calcular dia operacional');
        setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }
      
      diaOperacional = diaOpData;

      // Calcular ideal diretamente da configuração semanal (não é mais editável pelo usuário)
      const estoqueKey = `${lojaId}-${itemId}`;
      const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
      if (estoqueSemanal) {
        const currentDay = getCurrentDayKey(diaOperacional);
        idealAmanha = estoqueSemanal[currentDay] || 0;
      }
      
      aProduzir = Math.max(0, idealAmanha - finalSobra);

      dataToSave = {
        loja_id: lojaId,
        item_porcionado_id: itemId,
        dia_operacional: diaOperacional,
        final_sobra: finalSobra,
        peso_total_g: values?.peso_total_g ? parseFloat(values.peso_total_g) : null,
        ideal_amanha: idealAmanha,
        // a_produzir é uma coluna GENERATED - calculada automaticamente pelo banco
        usuario_id: user.id,
        usuario_nome: profile?.nome || user.email || 'Usuário',
        organization_id: organizationId,
      };

      // ========== SALVAMENTO COM RETRY ==========
      const saveResult = await saveWithRetry(dataToSave);

      if (!saveResult.success) {
        toast.error(`Falha ao salvar: ${saveResult.error}`, { id: toastId, duration: 8000 });
        await logAudit(lojaId, itemId, diaOperacional, finalSobra, idealAmanha, aProduzir, 'ERRO', undefined, saveResult.error, dataToSave);
        // NÃO limpar valores editados em caso de erro - preservar dados do usuário
        setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }

      // ========== VERIFICAÇÃO CRÍTICA: Confirmar dados salvos ==========
      const { data: savedData, error: verifyError } = await supabase
        .from('contagem_porcionados')
        .select('id, final_sobra, ideal_amanha, a_produzir, updated_at')
        .eq('loja_id', lojaId)
        .eq('item_porcionado_id', itemId)
        .eq('dia_operacional', diaOperacional)
        .single();

      if (verifyError || !savedData) {
        toast.error('CRÍTICO: Salvamento não confirmado no banco de dados! Contate o suporte.', { id: toastId, duration: 15000 });
        await logAudit(lojaId, itemId, diaOperacional, finalSobra, idealAmanha, aProduzir, 'ERRO', undefined, 'Verificação falhou: dado não encontrado após upsert', dataToSave);
        setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }

      // Verificar se os valores salvos correspondem aos enviados
      if (savedData.final_sobra !== finalSobra) {
        toast.error(`INCONSISTÊNCIA: Sobra enviada (${finalSobra}) ≠ salva (${savedData.final_sobra}). Contate o suporte.`, { id: toastId, duration: 15000 });
        await logAudit(lojaId, itemId, diaOperacional, finalSobra, idealAmanha, aProduzir, 'ERRO', savedData.id, `Inconsistência: enviado=${finalSobra}, salvo=${savedData.final_sobra}`, dataToSave, savedData);
        setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }

      // ========== SUCESSO VERIFICADO ==========
      await logAudit(lojaId, itemId, diaOperacional, finalSobra, idealAmanha, aProduzir, 'VERIFICADO', savedData.id, undefined, dataToSave, savedData);

      // Chamar função para criar/atualizar registro de produção
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('criar_ou_atualizar_producao_registro', {
          p_item_id: itemId,
          p_organization_id: organizationId,
          p_usuario_id: user.id,
          p_usuario_nome: profile?.nome || user.email || 'Usuário',
          p_dia_operacional: diaOperacional,
        });

      if (rpcError) {
        console.error('Erro ao criar registro de produção:', rpcError);
        // Não falhar a operação principal por causa disto
        toast.warning('Contagem salva, mas houve um problema ao atualizar produção.', { id: toastId, duration: 5000 });
      } else {
        toast.success(`Contagem salva e verificada! Sobra: ${finalSobra} | Ideal: ${idealAmanha} | A Produzir: ${aProduzir}`, { 
          id: toastId,
          duration: 5000 
        });
      }

      // Atualizar valores originais após salvar (ideal_amanha não é mais rastreado aqui)
      setOriginalValues(prev => ({
        ...prev,
        [key]: {
          final_sobra: finalSobra,
          peso_total_g: values?.peso_total_g ? parseFloat(values.peso_total_g) : null,
        }
      }));
      
      // Limpar valores editados APENAS após sucesso
      setEditingValues(prev => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
      
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      
      // Mensagens específicas baseadas no tipo de erro
      let errorMsg = 'Erro desconhecido ao salvar';
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMsg = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message?.includes('permission') || error.message?.includes('policy') || error.message?.includes('403')) {
        errorMsg = 'Sem permissão para salvar. Contate o administrador.';
      } else if (error.message?.includes('CRÍTICO')) {
        errorMsg = error.message;
      } else if (error.message) {
        errorMsg = `Erro: ${error.message}`;
      }
      
      toast.error(errorMsg, { id: toastId, duration: 8000 });
      await logAudit(lojaId, itemId, diaOperacional || '', finalSobra, idealAmanha, aProduzir, 'ERRO', undefined, errorMsg, dataToSave);
      
      // NÃO limpar valores editados em caso de erro - preservar dados do usuário
    } finally {
      // Remover do estado de salvando
      setSavingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // Obter o dia da semana do DIA ATUAL (dia operacional) em português
  // Aceita uma data base opcional (formato YYYY-MM-DD) para calcular o dia
  const getCurrentDayKey = (baseDate?: string): keyof EstoqueIdeal => {
    // Se baseDate for fornecido (dia operacional da loja), usar como base
    // Caso contrário, usar data atual do navegador
    const base = baseDate ? new Date(baseDate + 'T12:00:00') : new Date();
    const dayIndex = base.getDay(); // 0 = Domingo, 1 = Segunda, etc. (DIA ATUAL, não amanhã)
    
    const days: (keyof EstoqueIdeal)[] = [
      'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'
    ];
    
    return days[dayIndex];
  };

  const getEditingValue = (lojaId: string, itemId: string, field: string, defaultValue: any) => {
    const key = `${lojaId}-${itemId}`;
    
    // Se há valor editado manualmente, use-o
    if (editingValues[key]?.[field] !== undefined) {
      return editingValues[key][field];
    }
    
    // Para ideal_amanha, SEMPRE buscar dos estoques ideais semanais primeiro
    // NOTA: Apesar do nome "ideal_amanha", agora usamos o ideal do DIA ATUAL
    if (field === 'ideal_amanha') {
      const estoqueKey = `${lojaId}-${itemId}`;
      const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
      
      if (estoqueSemanal) {
        // USAR DIA OPERACIONAL ATUAL DA LOJA (não amanhã!)
        const diaOperacional = diasOperacionaisPorLoja[lojaId];
        const currentDay = getCurrentDayKey(diaOperacional);
        const idealValue = estoqueSemanal[currentDay];
        // Se o valor do estoque ideal é válido (> 0), use-o
        if (idealValue > 0) {
          return idealValue;
        }
      }
    }
    
    return defaultValue;
  };

  const openEstoquesDialog = async (lojaId: string, itemId: string, itemNome: string) => {
    // Gerar ID único para esta operação
    const operationId = `${Date.now()}-${Math.random()}`;
    currentOperationId.current = operationId;
    
    // Resetar estado de salvamento
    setSavingDialog(false);
    
    // Setar item e valores padrão
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
    
    // Abrir o dialog
    setDialogOpen(true);
    
    // Carregar dados existentes
    try {
      const { data, error } = await supabase
        .from('estoques_ideais_semanais')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('item_porcionado_id', itemId)
        .maybeSingle();
      
      // Verificar se ainda é a mesma operação
      if (currentOperationId.current !== operationId) {
        return; // Operação cancelada - dialog foi aberto para outro item
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

    // Capturar o ID da operação atual
    const operationId = currentOperationId.current;
    
    // Capturar valores no momento do clique
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

      // Atualizar mapa local independentemente (dados foram salvos)
      const key = `${currentItem.lojaId}-${currentItem.itemId}`;
      setEstoquesIdeaisMap(prev => ({
        ...prev,
        [key]: { ...currentEstoques },
      }));

      if (error) {
        console.error('Erro Supabase:', error);
        throw error;
      }

      // Verificar se ainda é a mesma operação antes de modificar UI
      if (currentOperationId.current !== operationId) {
        return; // Outro item foi aberto, não interferir
      }

      toast.success('Estoques ideais salvos com sucesso');
      setDialogOpen(false);
      setSelectedItem(null);
      setSavingDialog(false);
    } catch (error: any) {
      // Verificar se ainda é a mesma operação
      if (currentOperationId.current !== operationId) {
        return; // Ignorar erro de operação antiga
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

  return (
    <Layout>
      <div className="space-y-4 pb-24">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold">Contagem de Porcionados</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {(roles.includes('Admin') || roles.includes('SuperAdmin')) && (
              <Button 
                size="sm" 
                variant={showDetails ? "default" : "outline"}
                onClick={() => setShowDetails(!showDetails)}
                className="h-8"
              >
                {showDetails ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {showDetails ? 'Ocultar' : 'Detalhes'}
              </Button>
            )}
            <Button size="sm" onClick={() => loadData()} disabled={loading} variant="outline" className="h-8">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {lojas.map((loja) => {
            const contagensLoja = contagens[loja.id] || [];
            const isOpen = openLojas.has(loja.id);
            
            // Verificar se a loja tem lançamento válido hoje
            const temLancamentoHoje = contagensLoja.length > 0;

            return (
              <Collapsible
                key={loja.id}
                open={isOpen}
                onOpenChange={() => toggleLoja(loja.id)}
                className="bg-card rounded-lg border"
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${temLancamentoHoje ? 'bg-green-500' : 'bg-orange-400'}`} />
                      <span className="font-semibold">{loja.nome}</span>
                      <span className="text-xs text-muted-foreground">({loja.responsavel})</span>
                      {!temLancamentoHoje && (
                        <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-300">
                          ⚠️ Sem lançamento hoje
                        </span>
                      )}
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t">
                    {/* Cabeçalho Simplificado */}
                    {(() => {
                      const isAdminUser = roles.includes('Admin') || roles.includes('SuperAdmin');
                      const showAdminCols = isAdminUser && showDetails;
                      return (
                        <div className={`grid ${showAdminCols ? 'grid-cols-12' : 'grid-cols-8'} gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 text-xs font-semibold text-blue-700 dark:text-blue-300 border-b`}>
                          <div className={showAdminCols ? 'col-span-3' : 'col-span-3'}>Item</div>
                          <div className={showAdminCols ? 'col-span-3' : 'col-span-3'} >Sobra</div>
                          <div className={showAdminCols ? 'col-span-2' : 'col-span-2'} >Peso (g)</div>
                          {showAdminCols && <div className="col-span-2 text-center">Ideal ({diasSemanaLabels[getCurrentDayKey()]})</div>}
                          {showAdminCols && <div className="col-span-2 text-center">A Produzir</div>}
                        </div>
                      );
                    })()}

                    {/* Itens - Layout Simplificado */}
                    {itens.map((item) => {
                      const contagem = contagensLoja.find(c => c.item_porcionado_id === item.id);
                      const finalSobraRaw = getEditingValue(loja.id, item.id, 'final_sobra', contagem?.final_sobra ?? '');
                      const finalSobra = finalSobraRaw === '' ? 0 : Number(finalSobraRaw);
                      const pesoTotal = getEditingValue(loja.id, item.id, 'peso_total_g', contagem?.peso_total_g ?? '');
                      
                      // Buscar ideal diretamente da configuração semanal
                      const estoqueKey = `${loja.id}-${item.id}`;
                      const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
                      const diaOperacional = diasOperacionaisPorLoja[loja.id];
                      const currentDay = getCurrentDayKey(diaOperacional);
                      const idealFromConfig = estoqueSemanal?.[currentDay] ?? 0;
                      
                      const aProduzir = Math.max(0, idealFromConfig - finalSobra);
                      const isAdminUser = roles.includes('Admin') || roles.includes('SuperAdmin');
                      const showAdminCols = isAdminUser && showDetails;
                      const isDirty = isRowDirty(loja.id, item.id);
                      
                      // Funções de incremento/decremento
                      const incrementSobra = () => {
                        handleValueChange(loja.id, item.id, 'final_sobra', String(finalSobra + 10));
                      };
                      const decrementSobra = () => {
                        if (finalSobra > 0) {
                          handleValueChange(loja.id, item.id, 'final_sobra', String(finalSobra - 1));
                        }
                      };
                      
                      return (
                        <div 
                          key={item.id} 
                          className={`grid ${showAdminCols ? 'grid-cols-12' : 'grid-cols-8'} gap-2 px-3 py-2 items-center border-b last:border-b-0 ${isDirty ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'hover:bg-accent/10'}`}
                        >
                          {/* Nome do Item */}
                          <div className={showAdminCols ? 'col-span-3' : 'col-span-3'}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{item.nome}</span>
                              {isAdminUser && (
                                <Button 
                                  variant="outline" 
                                  size="icon"
                                  className="h-8 w-8 shrink-0 border-blue-500 bg-blue-50 hover:bg-blue-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEstoquesDialog(loja.id, item.id, item.nome);
                                  }}
                                  title="Configurar estoques ideais por dia"
                                >
                                  <Settings className="h-5 w-5 text-blue-600" />
                                </Button>
                              )}
                            </div>
                            {contagem && (
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(contagem.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>

                          {/* Sobra com Botões +/- (Stepper) */}
                          <div className={showAdminCols ? 'col-span-3' : 'col-span-3'}>
                            <div className="flex items-center justify-center">
                              <Button 
                                type="button"
                                variant="default" 
                                size="icon" 
                                className="h-12 w-12 rounded-r-none bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold shrink-0"
                                onClick={decrementSobra}
                              >
                                <Minus className="h-5 w-5" />
                              </Button>
                              <div className="h-12 w-14 flex items-center justify-center bg-white text-blue-600 text-xl font-bold border-y-2 border-blue-500">
                                {finalSobra}
                              </div>
                              <Button 
                                type="button"
                                variant="default" 
                                size="icon" 
                                className="h-12 w-12 rounded-l-none bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold shrink-0"
                                onClick={incrementSobra}
                              >
                                <Plus className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>

                          {/* Peso */}
                          <div className={showAdminCols ? 'col-span-2' : 'col-span-2'}>
                            <div className="relative">
                              <WeightInputInline
                                value={pesoTotal}
                                onChange={(val) => handleValueChange(loja.id, item.id, 'peso_total_g', val)}
                                placeholder="0"
                              />
                              {(!pesoTotal || pesoTotal === '0' || pesoTotal === '') && (
                                <span className="absolute -bottom-3.5 left-0 right-0 text-center text-[9px] text-destructive">
                                  Inserir peso
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Colunas Admin (se visível) */}
                          {showAdminCols && (
                            <div className="col-span-2">
                              <div className={`h-12 flex flex-col items-center justify-center rounded border text-sm ${
                                idealFromConfig === 0 
                                  ? 'bg-orange-50 border-orange-300 text-orange-600 dark:bg-orange-950/30' 
                                  : 'bg-muted border-input'
                              }`}>
                                {idealFromConfig === 0 ? (
                                  <span className="text-[10px] flex items-center gap-0.5">
                                    <AlertTriangle className="h-3 w-3" />
                                    Não config.
                                  </span>
                                ) : (
                                  <span className="text-base font-semibold">{idealFromConfig}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {showAdminCols && (
                            <div className="col-span-2">
                              <div className={`h-12 flex items-center justify-center text-base font-bold rounded ${aProduzir > 0 ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                {aProduzir}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Botão Fixo - Salvar Tudo */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t shadow-lg z-50">
          <div className="max-w-4xl mx-auto">
            <Button 
              onClick={handleSaveAll}
              disabled={!hasAnyChanges() || savingAll}
              className="w-full h-14 text-lg font-bold bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
            >
              {savingAll ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  SALVAR TUDO E FINALIZAR
                  {hasAnyChanges() && (
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-sm">
                      {getDirtyRows().length} alteração(ões)
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>

        <Dialog 
          open={dialogOpen} 
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedItem(null);
              setSavingDialog(false);
              currentOperationId.current = null; // Limpar operação
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
      </div>
    </Layout>
  );
};

export default ContagemPorcionados;
