import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Sparkles, Settings, ChevronDown, ChevronUp, X, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
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
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    lojaId: string;
    itemId: string;
    warnings: string[];
  } | null>(null);
  const [savingDialog, setSavingDialog] = useState(false);
  
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
        return { lojaId: loja.id, contagens: contagens || [] };
      });
      
      const contagensResults = await Promise.all(contagensPromises);
      const contagensData = contagensResults.flatMap(r => r.contagens);

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
    
    // Comparar campo a campo
    const fields = ['final_sobra', 'peso_total_g', 'ideal_amanha'];
    for (const field of fields) {
      if (current[field] !== undefined) {
        const currentVal = String(current[field] ?? '');
        const originalVal = String(original?.[field] ?? '');
        if (currentVal !== originalVal) return true;
      }
    }
    
    return false;
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

  const executeSave = async (lojaId: string, itemId: string) => {
    const key = `${lojaId}-${itemId}`;
    const values = editingValues[key];
    
    // Marcar como salvando
    setSavingKeys(prev => new Set([...prev, key]));

    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      // Buscar informações do item
      const { data: itemData } = await supabase
        .from('itens_porcionados')
        .select('nome, peso_unitario_g, unidade_medida, equivalencia_traco, consumo_por_traco_g, usa_traco_massa')
        .eq('id', itemId)
        .single();

      // CALCULAR DIA OPERACIONAL DA LOJA (usando função do banco)
      const { data: diaOperacional, error: diaOpError } = await supabase
        .rpc('calcular_dia_operacional', { p_loja_id: lojaId });
      
      if (diaOpError) {
        console.error('Erro ao calcular dia operacional:', diaOpError);
        throw diaOpError;
      }

      const finalSobra = parseInt(values?.final_sobra) || 0;
      
      // Se o usuário não editou ideal_amanha, buscar dos estoques ideais semanais
      let idealAmanha = 0;
      if (values?.ideal_amanha !== undefined) {
        idealAmanha = parseInt(values.ideal_amanha) || 0;
      } else {
        // Buscar do mapa de estoques ideais
        const estoqueKey = `${lojaId}-${itemId}`;
        const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
        if (estoqueSemanal) {
          const tomorrowDay = getTomorrowDayKey();
          idealAmanha = estoqueSemanal[tomorrowDay] || 0;
        }
      }
      
      const aProduzir = Math.max(0, idealAmanha - finalSobra);

      const dataToSave = {
        loja_id: lojaId,
        item_porcionado_id: itemId,
        dia_operacional: diaOperacional,
        final_sobra: finalSobra,
        peso_total_g: values?.peso_total_g ? parseFloat(values.peso_total_g) : null,
        ideal_amanha: idealAmanha,
        usuario_id: user.id,
        usuario_nome: profile?.nome || user.email || 'Usuário',
        organization_id: organizationId,
      };

      // UPSERT usa nova constraint com dia_operacional
      const { error } = await supabase
        .from('contagem_porcionados')
        .upsert(dataToSave, {
          onConflict: 'loja_id,item_porcionado_id,dia_operacional',
        });

      if (error) throw error;

      // Chamar função SECURITY DEFINER para criar/atualizar registro de produção
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
      } else {
        console.log('Resultado da criação de produção:', rpcResult);
      }

      toast.success('Contagem salva com sucesso');
      
      // Atualizar valores originais após salvar
      const savedFinalSobra = parseInt(values?.final_sobra) || 0;
      const savedIdealAmanha = parseInt(values?.ideal_amanha) || 0;
      setOriginalValues(prev => ({
        ...prev,
        [key]: {
          final_sobra: savedFinalSobra,
          peso_total_g: values?.peso_total_g ? parseFloat(values.peso_total_g) : null,
          ideal_amanha: savedIdealAmanha,
        }
      }));
      
      // Limpar valores editados
      setEditingValues(prev => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
      
      loadData();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar contagem');
    } finally {
      // Remover do estado de salvando
      setSavingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // Obter o dia da semana de amanhã em português
  const getTomorrowDayKey = (): keyof EstoqueIdeal => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayIndex = tomorrow.getDay(); // 0 = Domingo, 1 = Segunda, etc.
    
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
    if (field === 'ideal_amanha') {
      const estoqueKey = `${lojaId}-${itemId}`;
      const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
      
      if (estoqueSemanal) {
        const tomorrowDay = getTomorrowDayKey();
        const idealValue = estoqueSemanal[tomorrowDay];
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Contagem de Porcionados</h1>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => loadData()} disabled={loading} className="!bg-green-600 hover:!bg-green-700 text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
              <Sparkles className="mr-2 h-4 w-4" />
              Otimizar com IA
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
                    {/* Cabeçalho */}
                    {(() => {
                      const isAdminUser = roles.includes('Admin') || roles.includes('SuperAdmin');
                      return (
                        <div className={`grid ${isAdminUser ? 'grid-cols-12' : 'grid-cols-8'} gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground`}>
                          <div className="col-span-3">Item</div>
                          <div className="col-span-2 text-center">Sobra</div>
                          <div className="col-span-2 text-center">Peso</div>
                          {isAdminUser && <div className="col-span-2 text-center">Ideal</div>}
                          {isAdminUser && <div className="col-span-2 text-center">A Produzir</div>}
                          <div className="col-span-1 text-center">Ação</div>
                        </div>
                      );
                    })()}

                    {/* Itens */}
                    {itens.map((item) => {
                      const contagem = contagensLoja.find(c => c.item_porcionado_id === item.id);
                      const finalSobraRaw = getEditingValue(loja.id, item.id, 'final_sobra', contagem?.final_sobra ?? '');
                      const finalSobra = finalSobraRaw === '' ? '' : finalSobraRaw;
                      const pesoTotal = getEditingValue(loja.id, item.id, 'peso_total_g', contagem?.peso_total_g ?? '');
                      const idealAmanhaRaw = getEditingValue(loja.id, item.id, 'ideal_amanha', '');
                      const idealAmanha = idealAmanhaRaw === '' ? '' : idealAmanhaRaw;
                      const aProduzir = Math.max(0, Number(idealAmanha || 0) - Number(finalSobra || 0));

                      const isAdminUser = roles.includes('Admin') || roles.includes('SuperAdmin');
                      
                      return (
                        <div key={item.id} 
                             className={`grid ${isAdminUser ? 'grid-cols-12' : 'grid-cols-8'} gap-2 px-4 py-3 items-center border-b last:border-b-0 hover:bg-accent/20`}>
                          <div className="col-span-3">
                            <span className="font-medium text-sm">{item.nome}</span>
                            {contagem && (
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(contagem.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>

                          <div className="col-span-2">
                            <Input
                              type="number"
                              value={finalSobra}
                              onChange={(e) => handleValueChange(loja.id, item.id, 'final_sobra', e.target.value)}
                              className="h-12 text-center text-base font-medium"
                              placeholder="0"
                            />
                          </div>

                          <div className="col-span-2">
                            <div className={`${(!pesoTotal || pesoTotal === '0') ? '[&_input]:border-destructive [&_input]:ring-destructive' : ''}`}>
                              <WeightInputInline
                                value={pesoTotal}
                                onChange={(val) => handleValueChange(loja.id, item.id, 'peso_total_g', val)}
                                placeholder="0"
                              />
                            </div>
                          </div>

                          {isAdminUser && (
                            <div className="col-span-2">
                              <Input
                                type="number"
                                value={idealAmanha}
                                onChange={(e) => handleValueChange(loja.id, item.id, 'ideal_amanha', e.target.value)}
                                className="h-12 text-center text-base font-medium"
                                placeholder="0"
                              />
                            </div>
                          )}

                          {isAdminUser && (
                            <div className="col-span-2">
                              <div className={`text-center font-bold text-base py-3 rounded ${aProduzir > 0 ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                {aProduzir} un
                              </div>
                            </div>
                          )}

                          <div className="col-span-1 flex gap-1 justify-center">
                            {isAdminUser && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  openEstoquesDialog(loja.id, item.id, item.nome);
                                }}
                              >
                                <Settings className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <SaveButton
                              isDirty={isRowDirty(loja.id, item.id)}
                              isSaving={savingKeys.has(`${loja.id}-${item.id}`)}
                              onClick={() => handleSave(loja.id, item.id)}
                              className="h-8 px-2 text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Dialog de Estoques Ideais */}
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
