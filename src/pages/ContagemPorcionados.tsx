import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { 
  Settings, ChevronDown, ChevronUp, Loader2, RefreshCw, AlertTriangle, 
  Plus, Minus, Eye, EyeOff, PlayCircle, CheckCircle, Clock, AlertCircle 
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
import { WeightInputInline } from '@/components/ui/weight-input';
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
import { useSessaoContagem } from '@/hooks/useSessaoContagem';

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
  const [reiniciarDialog, setReiniciarDialog] = useState<{
    open: boolean;
    lojaId: string;
    aposCutoff: boolean;
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [lojaAtualId, setLojaAtualId] = useState<string | null>(null);
  
  // Ref para rastrear a operação atual e evitar race conditions
  const currentOperationId = useRef<string | null>(null);

  // Hook de sessão de contagem
  const {
    sessoes,
    loadSessoes,
    iniciarSessao,
    encerrarSessao,
    marcarCampoTocado,
    isCampoTocado,
    todosItensPreenchidos,
    contarItensPendentes,
    limparCamposTocados,
    verificarCutoff,
  } = useSessaoContagem({
    organizationId,
    userId: user?.id,
    diasOperacionaisPorLoja,
  });

  // Verificar se usuário é restrito (não-admin e não-produção) - inclui funcionários de Loja e CPD
  const isRestrictedUser = !isAdmin() && !hasRole('Produção');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Carregar sessões quando lojas e dias operacionais estiverem prontos
  useEffect(() => {
    if (lojas.length > 0 && Object.keys(diasOperacionaisPorLoja).length > 0) {
      loadSessoes(lojas.map(l => l.id));
    }
  }, [lojas, diasOperacionaisPorLoja, loadSessoes]);

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
    
    // Marcar campo como tocado na sessão
    marcarCampoTocado(lojaId, itemId, field);
    
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
    
    if (!current) return false;
    
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

  // Handler para iniciar sessão
  const handleIniciarSessao = async (lojaId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', user!.id)
      .single();

    // Limpar valores editados desta loja
    setEditingValues(prev => {
      const newValues = { ...prev };
      Object.keys(newValues).forEach(key => {
        if (key.startsWith(lojaId)) delete newValues[key];
      });
      return newValues;
    });

    await iniciarSessao(lojaId, profile?.nome || user?.email || 'Usuário');
  };

  // Handler para solicitar reinício de sessão
  const handleSolicitarReinicio = async (lojaId: string) => {
    const cutoffInfo = await verificarCutoff(lojaId);
    setReiniciarDialog({
      open: true,
      lojaId,
      aposCutoff: cutoffInfo?.passou_cutoff ?? false,
    });
  };

  // Handler para confirmar reinício de sessão
  const handleConfirmarReinicio = async () => {
    if (!reiniciarDialog) return;
    
    const { lojaId } = reiniciarDialog;
    setReiniciarDialog(null);
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', user!.id)
      .single();

    // Limpar valores editados desta loja
    setEditingValues(prev => {
      const newValues = { ...prev };
      Object.keys(newValues).forEach(key => {
        if (key.startsWith(lojaId)) delete newValues[key];
      });
      return newValues;
    });

    // Limpar valores originais para não mostrar como dirty
    setOriginalValues(prev => {
      const newValues = { ...prev };
      Object.keys(newValues).forEach(key => {
        if (key.startsWith(lojaId)) delete newValues[key];
      });
      return newValues;
    });

    const result = await iniciarSessao(lojaId, profile?.nome || user?.email || 'Usuário');
    
    if (result.success) {
      // Expandir a loja se não estiver aberta
      if (!openLojas.has(lojaId)) {
        setOpenLojas(prev => new Set([...prev, lojaId]));
      }
      toast.success('Contagem reiniciada! Preencha os itens novamente.');
    }
  };

  // Handler para encerrar sessão com verificação
  const handleEncerrarSessao = async (lojaId: string) => {
    const itemIds = itens.map(i => i.id);
    
    if (!todosItensPreenchidos(lojaId, itemIds)) {
      const pendentes = contarItensPendentes(lojaId, itemIds);
      toast.error(`Preencha todos os itens antes de encerrar. ${pendentes} item(ns) pendente(s).`);
      return;
    }

    setSavingAll(true);

    try {
      // 1. Salvar todos os itens desta loja com verificação
      const dirtyRowsLoja = getDirtyRows().filter(r => r.lojaId === lojaId);
      
      for (const row of dirtyRowsLoja) {
        await executeSave(row.lojaId, row.itemId);
      }

      // 2. Verificar se todos foram salvos corretamente
      const diaOperacional = diasOperacionaisPorLoja[lojaId];
      const { data: verificacao, error: verifyError } = await supabase
        .from('contagem_porcionados')
        .select('id, item_porcionado_id, final_sobra, peso_total_g')
        .eq('loja_id', lojaId)
        .eq('dia_operacional', diaOperacional);

      if (verifyError) {
        toast.error('Falha na verificação dos dados salvos.');
        setSavingAll(false);
        return;
      }

      // 3. Verificar consistência
      for (const item of itens) {
        const saved = verificacao?.find(v => v.item_porcionado_id === item.id);
        const key = `${lojaId}-${item.id}`;
        const expected = editingValues[key];
        
        if (expected && saved) {
          const expectedSobra = parseInt(expected.final_sobra || '0');
          if (saved.final_sobra !== expectedSobra) {
            toast.error(`Inconsistência detectada para ${item.nome}. Verifique e tente novamente.`);
            setSavingAll(false);
            return;
          }
        }
      }

      // 4. Encerrar sessão
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user!.id)
        .single();

      const success = await encerrarSessao(lojaId, profile?.nome || user?.email || 'Usuário');

      if (success) {
        // 5. Disparar atualização de produção
        const sessao = sessoes[lojaId];
        
        for (const item of itens) {
          await supabase.rpc('criar_ou_atualizar_producao_registro', {
            p_item_id: item.id,
            p_organization_id: organizationId,
            p_usuario_id: user!.id,
            p_usuario_nome: profile?.nome || user?.email || 'Usuário',
            p_dia_operacional: diaOperacional,
          });
        }

        toast.success('✅ Contagem encerrada e verificada com sucesso!');
        loadData();
      }
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      toast.error('Erro ao encerrar sessão. Tente novamente.');
    } finally {
      setSavingAll(false);
    }
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

  // Verificar se há produção ativa para um item
  const verificarProducaoAtiva = async (itemId: string, diaOperacional: string): Promise<boolean> => {
    const { data } = await supabase
      .from('producao_registros')
      .select('status')
      .eq('item_id', itemId)
      .eq('data_referencia', diaOperacional)
      .eq('organization_id', organizationId)
      .in('status', ['em_preparo', 'em_porcionamento', 'finalizado'])
      .limit(1);
    
    return (data?.length ?? 0) > 0;
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

    let diaOperacional: string = '';
    let idealAmanha = 0;
    let aProduzir = 0;
    let dataToSave: any = null;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
      }

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

      const { data: diaOpData, error: diaOpError } = await supabase
        .rpc('calcular_dia_operacional', { p_loja_id: lojaId });
      
      if (diaOpError || !diaOpData) {
        toast.error('Erro ao calcular dia operacional. Tente novamente.', { id: toastId });
        await logAudit(lojaId, itemId, '', finalSobra, 0, 0, 'ERRO', undefined, 'Falha ao calcular dia operacional');
        setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }
      
      diaOperacional = diaOpData;

      // Verificar se há produção ativa - exibir aviso se sim
      const producaoAtiva = await verificarProducaoAtiva(itemId, diaOperacional);
      if (producaoAtiva) {
        toast.warning(
          `Produção de ${itemData.nome} em andamento. Sua alteração gerará um lote extra.`,
          { duration: 5000 }
        );
      }

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
        usuario_id: user.id,
        usuario_nome: profile?.nome || user.email || 'Usuário',
        organization_id: organizationId,
        preenchido_na_sessao: true,
      };

      const saveResult = await saveWithRetry(dataToSave);

      if (!saveResult.success) {
        toast.error(`Falha ao salvar: ${saveResult.error}`, { id: toastId, duration: 8000 });
        await logAudit(lojaId, itemId, diaOperacional, finalSobra, idealAmanha, aProduzir, 'ERRO', undefined, saveResult.error, dataToSave);
        setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }

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

      if (savedData.final_sobra !== finalSobra) {
        toast.error(`INCONSISTÊNCIA: Sobra enviada (${finalSobra}) ≠ salva (${savedData.final_sobra}). Contate o suporte.`, { id: toastId, duration: 15000 });
        await logAudit(lojaId, itemId, diaOperacional, finalSobra, idealAmanha, aProduzir, 'ERRO', savedData.id, `Inconsistência: enviado=${finalSobra}, salvo=${savedData.final_sobra}`, dataToSave, savedData);
        setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }

      await logAudit(lojaId, itemId, diaOperacional, finalSobra, idealAmanha, aProduzir, 'VERIFICADO', savedData.id, undefined, dataToSave, savedData);

      toast.success(`Contagem salva! Sobra: ${finalSobra} | Ideal: ${idealAmanha} | A Produzir: ${aProduzir}`, { 
        id: toastId,
        duration: 3000 
      });

      setOriginalValues(prev => ({
        ...prev,
        [key]: {
          final_sobra: finalSobra,
          peso_total_g: values?.peso_total_g ? parseFloat(values.peso_total_g) : null,
        }
      }));
      
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
      } else if (error.message?.includes('CRÍTICO')) {
        errorMsg = error.message;
      } else if (error.message) {
        errorMsg = `Erro: ${error.message}`;
      }
      
      toast.error(errorMsg, { id: toastId, duration: 8000 });
      await logAudit(lojaId, itemId, diaOperacional || '', finalSobra, idealAmanha, aProduzir, 'ERRO', undefined, errorMsg, dataToSave);
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
        const diaOperacional = diasOperacionaisPorLoja[lojaId];
        const currentDay = getCurrentDayKey(diaOperacional);
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

  // Badge de status por loja
  const getStatusBadge = (lojaId: string) => {
    const sessao = sessoes[lojaId];
    
    switch (sessao?.status) {
      case 'encerrada':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs font-medium">
            <CheckCircle className="h-3 w-3" /> Encerrada
          </span>
        );
      case 'em_andamento':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium animate-pulse">
            <Clock className="h-3 w-3" /> Contando...
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs font-medium">
            <AlertCircle className="h-3 w-3" /> Pendente
          </span>
        );
    }
  };

  // Verificar se sessão está ativa para uma loja
  const isSessaoAtiva = (lojaId: string): boolean => {
    return sessoes[lojaId]?.status === 'em_andamento';
  };

  // Verificar se pode encerrar
  const podeEncerrar = (lojaId: string): boolean => {
    const itemIds = itens.map(i => i.id);
    return isSessaoAtiva(lojaId) && todosItensPreenchidos(lojaId, itemIds);
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
            const sessao = sessoes[loja.id];
            const sessaoAtiva = isSessaoAtiva(loja.id);

            return (
              <Collapsible
                key={loja.id}
                open={isOpen}
                onOpenChange={() => toggleLoja(loja.id)}
                className="bg-card rounded-lg border"
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{loja.nome}</span>
                      <span className="text-xs text-muted-foreground">({loja.responsavel})</span>
                      {getStatusBadge(loja.id)}
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
                    {/* Tela de Iniciar Sessão */}
                    {(!sessao || sessao.status === 'pendente') && (
                      <div className="flex flex-col items-center justify-center p-8 bg-orange-50 dark:bg-orange-950/20">
                        <PlayCircle className="h-12 w-12 text-orange-500 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Contagem não iniciada</h3>
                        <p className="text-muted-foreground text-center mb-4 max-w-md">
                          Clique para iniciar a contagem do dia operacional. 
                          Todos os campos deverão ser preenchidos antes de encerrar.
                        </p>
                        <Button 
                          onClick={() => handleIniciarSessao(loja.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          size="lg"
                        >
                          <PlayCircle className="h-5 w-5 mr-2" />
                          Iniciar Contagem de Hoje
                        </Button>
                      </div>
                    )}

                    {/* Sessão Encerrada */}
                    {sessao?.status === 'encerrada' && (
                      <div className="flex flex-col items-center justify-center p-8 bg-green-50 dark:bg-green-950/20">
                        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                        <h3 className="text-lg font-semibold mb-2 text-green-700 dark:text-green-300">
                          Contagem Encerrada
                        </h3>
                        <p className="text-muted-foreground text-center mb-2">
                          Encerrada por: {sessao.encerrado_por_nome}
                        </p>
                        {sessao.encerrado_em && (
                          <p className="text-sm text-muted-foreground mb-4">
                            {format(new Date(sessao.encerrado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                        
                        {/* Botão para reiniciar contagem */}
                        <Button 
                          onClick={() => handleSolicitarReinicio(loja.id)}
                          variant="outline"
                          className="mt-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reiniciar Contagem
                        </Button>
                        
                        {sessao.iniciado_apos_cutoff && (
                          <p className="text-xs text-orange-600 mt-3 text-center">
                            Nota: Esta contagem foi iniciada após o cutoff
                          </p>
                        )}
                      </div>
                    )}

                    {/* Formulário de Contagem (sessão ativa) */}
                    {sessaoAtiva && (
                      <>
                        {/* Cabeçalho */}
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

                        {/* Itens */}
                        {itens.map((item) => {
                          const contagem = contagensLoja.find(c => c.item_porcionado_id === item.id);
                          const finalSobraRaw = getEditingValue(loja.id, item.id, 'final_sobra', contagem?.final_sobra ?? '');
                          const finalSobra = finalSobraRaw === '' ? 0 : Number(finalSobraRaw);
                          const pesoTotal = getEditingValue(loja.id, item.id, 'peso_total_g', contagem?.peso_total_g ?? '');
                          
                          const estoqueKey = `${loja.id}-${item.id}`;
                          const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
                          const diaOperacional = diasOperacionaisPorLoja[loja.id];
                          const currentDay = getCurrentDayKey(diaOperacional);
                          const idealFromConfig = estoqueSemanal?.[currentDay] ?? 0;
                          
                          const aProduzir = Math.max(0, idealFromConfig - finalSobra);
                          const isAdminUser = roles.includes('Admin') || roles.includes('SuperAdmin');
                          const showAdminCols = isAdminUser && showDetails;
                          const isDirty = isRowDirty(loja.id, item.id);
                          
                          // Verificar se campo foi tocado na sessão
                          const campoTocado = isCampoTocado(loja.id, item.id, 'final_sobra');
                          const isItemNaoPreenchido = !campoTocado && sessaoAtiva;
                          
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
                              className={`grid ${showAdminCols ? 'grid-cols-12' : 'grid-cols-8'} gap-2 px-3 py-2 items-center border-b last:border-b-0 transition-all ${
                                isItemNaoPreenchido 
                                  ? 'bg-orange-50 dark:bg-orange-950/20 ring-2 ring-orange-400 ring-inset' 
                                  : isDirty 
                                    ? 'bg-yellow-50 dark:bg-yellow-950/20' 
                                    : campoTocado 
                                      ? 'bg-green-50/50 dark:bg-green-950/10'
                                      : 'hover:bg-accent/10'
                              }`}
                            >
                              {/* Nome do Item */}
                              <div className={showAdminCols ? 'col-span-3' : 'col-span-3'}>
                                <div className="flex items-center gap-2">
                                  {campoTocado && (
                                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                  )}
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
                                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                    {format(new Date(contagem.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                                  </p>
                                )}
                              </div>

                              {/* Sobra com Botões +/- */}
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
                                  <div className={`h-12 w-14 flex items-center justify-center text-xl font-bold border-y-2 ${
                                    isItemNaoPreenchido 
                                      ? 'bg-orange-100 text-orange-700 border-orange-400' 
                                      : 'bg-white text-blue-600 border-blue-500'
                                  }`}>
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

                              {/* Colunas Admin */}
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
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Botão Fixo */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t shadow-lg z-50">
          <div className="max-w-4xl mx-auto">
            {lojaAtualId && isSessaoAtiva(lojaAtualId) ? (
              <Button 
                onClick={() => handleEncerrarSessao(lojaAtualId)}
                disabled={!podeEncerrar(lojaAtualId) || savingAll}
                className={`w-full h-14 text-lg font-bold transition-all ${
                  podeEncerrar(lojaAtualId) 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {savingAll ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Salvando e verificando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    ENCERRAR CONTAGEM
                    {!podeEncerrar(lojaAtualId) && (
                      <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-sm">
                        {contarItensPendentes(lojaAtualId, itens.map(i => i.id))} item(ns) pendente(s)
                      </span>
                    )}
                  </>
                )}
              </Button>
            ) : (
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
            )}
          </div>
        </div>

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

        {/* AlertDialog de Confirmação para Reiniciar Contagem */}
        <AlertDialog open={reiniciarDialog?.open} onOpenChange={(open) => !open && setReiniciarDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-orange-500" />
                Reiniciar Contagem?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  {reiniciarDialog?.aposCutoff ? (
                    <>
                      <p className="font-medium text-orange-600">
                        ⚠️ Atenção: O horário de cutoff já passou!
                      </p>
                      <p>
                        Reiniciar a contagem agora pode gerar demanda adicional para o CPD 
                        caso os novos valores sejam maiores que os anteriores.
                      </p>
                    </>
                  ) : (
                    <p>
                      Isso permitirá preencher todos os itens novamente. 
                      Os dados anteriores serão substituídos pelos novos valores.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setReiniciarDialog(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                className={reiniciarDialog?.aposCutoff ? "bg-orange-500 hover:bg-orange-600" : ""}
                onClick={handleConfirmarReinicio}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reiniciar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default ContagemPorcionados;
