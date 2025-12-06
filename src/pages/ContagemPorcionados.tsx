import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUIPermissions } from '@/hooks/useUIPermissions';
import { Sparkles, Eye, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react';
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
  const { isColunaActive, isAcaoActive, loading: uiLoading } = useUIPermissions('contagem_porcionados');
  
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

  // Verificar se usuário é apenas Loja (sem Admin ou Produção)
  const isLojaUser = hasRole('Loja') && !isAdmin() && !hasRole('Produção');

  // Colunas visíveis baseadas nas permissões
  const showSobra = isColunaActive('sobra');
  const showPeso = isColunaActive('peso');
  const showIdeal = isColunaActive('ideal');
  const showAProduzir = isColunaActive('a_produzir');
  const showAcao = isColunaActive('acao');

  // Calcular grid dinâmico baseado nas colunas visíveis
  const gridConfig = useMemo(() => {
    const cols = [
      { id: 'item', visible: true, span: 3 },
      { id: 'sobra', visible: showSobra, span: 2 },
      { id: 'peso', visible: showPeso, span: 2 },
      { id: 'ideal', visible: showIdeal, span: 2 },
      { id: 'a_produzir', visible: showAProduzir, span: 2 },
      { id: 'acao', visible: showAcao, span: 1 },
    ];
    const visibleCols = cols.filter(c => c.visible);
    const totalSpan = visibleCols.reduce((sum, c) => sum + c.span, 0);
    return { cols: visibleCols, totalSpan };
  }, [showSobra, showPeso, showIdeal, showAProduzir, showAcao]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      // Carregar lojas baseado no role do usuário
      let lojasData: Loja[] = [];
      
      if (isLojaUser && user) {
        // Usuário Loja: buscar apenas lojas vinculadas via lojas_acesso
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

      // Carregar contagens
      const { data: contagensData, error: contagensError } = await supabase
        .from('contagem_porcionados')
        .select('*')
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

  const handleSave = async (lojaId: string, itemId: string) => {
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
        final_sobra: finalSobra,
        peso_total_g: values?.peso_total_g ? parseFloat(values.peso_total_g) : null,
        ideal_amanha: idealAmanha,
        usuario_id: user.id,
        usuario_nome: profile?.nome || user.email || 'Usuário',
        organization_id: organizationId,
      };

      const { error } = await supabase
        .from('contagem_porcionados')
        .upsert(dataToSave, {
          onConflict: 'loja_id,item_porcionado_id',
        });

      if (error) throw error;

      // Atualizar registro de produção agregando TODAS as lojas
      if (itemData) {
        // 1. Buscar TODAS as contagens de TODAS as lojas para este item (apenas do dia atual)
        const hoje = new Date().toISOString().split('T')[0];
        const { data: todasContagens } = await supabase
          .from('contagem_porcionados')
          .select('loja_id, a_produzir, ideal_amanha, final_sobra')
          .eq('item_porcionado_id', itemId)
          .gt('a_produzir', 0)
          .gte('updated_at', `${hoje}T00:00:00`)
          .lte('updated_at', `${hoje}T23:59:59`);

        if (todasContagens && todasContagens.length > 0) {
          // 2. Calcular demanda total das lojas
          const demandaLojas = todasContagens.reduce((sum, c) => {
            const aProduzir = Math.max(0, (c.ideal_amanha || 0) - (c.final_sobra || 0));
            return sum + aProduzir;
          }, 0);

          // 3. Buscar reserva configurada para o dia
          const diaAtual = getTomorrowDayKey();
          const { data: reservaData } = await supabase
            .from('itens_reserva_diaria')
            .select('*')
            .eq('item_porcionado_id', itemId)
            .maybeSingle();

          const reservaDia = reservaData?.[diaAtual] || 0;

          // 4. Calcular necessidade total (demanda + reserva)
          const necessidadeTotal = demandaLojas + reservaDia;

          // 5. Buscar nomes das lojas
          const lojasIds = todasContagens.map(c => c.loja_id);
          const { data: lojasData } = await supabase
            .from('lojas')
            .select('id, nome')
            .in('id', lojasIds);

          // 6. Construir detalhes por loja (apenas demanda real das lojas)
          const detalhesLojas = todasContagens.map(c => {
            const aProduzir = Math.max(0, (c.ideal_amanha || 0) - (c.final_sobra || 0));
            return {
              loja_id: c.loja_id,
              loja_nome: lojasData?.find(l => l.id === c.loja_id)?.nome || 'Loja',
              quantidade: aProduzir,
            };
          });

          // 7. Calcular unidades_programadas com arredondamento para traços
          let unidadesProgramadas = necessidadeTotal;
          let pesoProgramadoTotal = 0;
          let sobraReserva = 0;

          if (itemData.unidade_medida === 'traco' && itemData.equivalencia_traco && itemData.consumo_por_traco_g) {
            // Para itens em traço: arredondar para traços inteiros
            const tracos = Math.ceil(necessidadeTotal / itemData.equivalencia_traco);
            unidadesProgramadas = tracos * itemData.equivalencia_traco;
            sobraReserva = unidadesProgramadas - necessidadeTotal;
            pesoProgramadoTotal = (tracos * itemData.consumo_por_traco_g) / 1000; // g para kg
          } else {
            // Para itens normais: usar peso unitário
            const pesoUnitarioKg = (itemData.peso_unitario_g || 0) / 1000;
            pesoProgramadoTotal = unidadesProgramadas * pesoUnitarioKg;
          }

          // 8. Verificar se já existe registro "a_produzir" para este item (SEM lote_producao_id)
          // Se usa_traco_massa, deletar registros antigos e recriar
          // Se não usa_traco_massa, usar lógica de upsert existente
          const usaTracoMassa = itemData.usa_traco_massa && itemData.unidade_medida === 'traco';
          
          if (usaTracoMassa && itemData.equivalencia_traco && itemData.consumo_por_traco_g) {
            // FILA DE TRAÇOS: Criar N registros separados
            const tracosNecessarios = Math.ceil(necessidadeTotal / itemData.equivalencia_traco);
            const loteId = crypto.randomUUID();
            const dataReferencia = new Date().toISOString().split('T')[0];
            
            // Deletar registros existentes "a_produzir" deste item (lote antigo)
            await supabase
              .from('producao_registros')
              .delete()
              .eq('item_id', itemId)
              .eq('status', 'a_produzir');
            
            // Criar N registros (um por traço)
            for (let seq = 1; seq <= tracosNecessarios; seq++) {
              const unidadesPorTraco = itemData.equivalencia_traco;
              const pesoPorTraco = itemData.consumo_por_traco_g / 1000; // g para kg
              
              const producaoTracoData = {
                item_id: itemId,
                item_nome: itemData.nome,
                status: 'a_produzir',
                unidades_programadas: unidadesPorTraco,
                peso_programado_kg: pesoPorTraco,
                demanda_lojas: seq === 1 ? demandaLojas : null, // Só no primeiro
                reserva_configurada: seq === 1 ? reservaDia : null, // Só no primeiro
                sobra_reserva: seq === tracosNecessarios ? sobraReserva : 0, // Só no último
                detalhes_lojas: seq === 1 ? detalhesLojas : [], // Só no primeiro
                usuario_id: user.id,
                usuario_nome: profile?.nome || user.email || 'Usuário',
                organization_id: organizationId,
                // Campos da fila de traços
                sequencia_traco: seq,
                lote_producao_id: loteId,
                bloqueado_por_traco_anterior: seq > 1, // Primeiro desbloqueado, demais bloqueados
                timer_status: 'aguardando',
                data_referencia: dataReferencia,
              };
              
              const { error: insertError } = await supabase
                .from('producao_registros')
                .insert(producaoTracoData);
              
              if (insertError) {
                console.error(`Erro ao criar traço ${seq}:`, insertError);
              }
            }
          } else {
            // LÓGICA ORIGINAL: Um único registro de produção
            const { data: registroExistente } = await supabase
              .from('producao_registros')
              .select('id')
              .eq('item_id', itemId)
              .eq('status', 'a_produzir')
              .is('lote_producao_id', null)
              .maybeSingle();

            const producaoData = {
              item_id: itemId,
              item_nome: itemData.nome,
              status: 'a_produzir',
              unidades_programadas: unidadesProgramadas,
              peso_programado_kg: pesoProgramadoTotal,
              demanda_lojas: demandaLojas,
              reserva_configurada: reservaDia,
              sobra_reserva: sobraReserva,
              detalhes_lojas: detalhesLojas,
              usuario_id: user.id,
              usuario_nome: profile?.nome || user.email || 'Usuário',
              organization_id: organizationId,
            };

            if (registroExistente) {
              // Atualizar registro existente
              const { error: updateError } = await supabase
                .from('producao_registros')
                .update(producaoData)
                .eq('id', registroExistente.id);

              if (updateError) {
                console.error('Erro ao atualizar registro de produção:', updateError);
              }
            } else {
              // Criar novo registro
              const { error: insertError } = await supabase
                .from('producao_registros')
                .insert(producaoData);

              if (insertError) {
                console.error('Erro ao criar registro de produção:', insertError);
              }
            }
          }
        }
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
    setSelectedItem({ lojaId, itemId, itemNome });
    
    // Carregar estoques ideais existentes
    const { data, error } = await supabase
      .from('estoques_ideais_semanais')
      .select('*')
      .eq('loja_id', lojaId)
      .eq('item_porcionado_id', itemId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao carregar estoques ideais:', error);
      toast.error('Erro ao carregar estoques ideais');
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
    } else {
      // Valores padrão
      setEstoquesIdeais({
        segunda: 200,
        terca: 200,
        quarta: 200,
        quinta: 200,
        sexta: 200,
        sabado: 200,
        domingo: 200,
      });
    }
    
    setDialogOpen(true);
  };

  const handleSaveEstoquesIdeais = async () => {
    if (!selectedItem) return;

    if (!organizationId) {
      toast.error('Organização não identificada. Faça login novamente.');
      return;
    }

    try {
      const { error } = await supabase
        .from('estoques_ideais_semanais')
        .upsert({
          loja_id: selectedItem.lojaId,
          item_porcionado_id: selectedItem.itemId,
          ...estoquesIdeais,
          organization_id: organizationId,
        }, {
          onConflict: 'loja_id,item_porcionado_id',
        });

      if (error) throw error;

      toast.success('Estoques ideais salvos com sucesso');
      setDialogOpen(false);
      loadData(); // Recarregar dados para atualizar os ideais
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar estoques ideais');
    }
  };

  if (loading || uiLoading) {
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
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
            <Sparkles className="mr-2 h-4 w-4" />
            Otimizar com IA
          </Button>
        </div>

        <div className="space-y-3">
          {lojas.map((loja) => {
            const contagensLoja = contagens[loja.id] || [];
            const isOpen = openLojas.has(loja.id);

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
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="font-semibold">{loja.nome}</span>
                      <span className="text-xs text-muted-foreground">({loja.responsavel})</span>
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
                    {/* Cabeçalho dinâmico */}
                    <div className={`grid gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground`} 
                         style={{ gridTemplateColumns: `repeat(${gridConfig.totalSpan}, minmax(0, 1fr))` }}>
                      <div className="col-span-3">Item</div>
                      {showSobra && <div className="col-span-2 text-center">Sobra</div>}
                      {showPeso && <div className="col-span-2 text-center">Peso</div>}
                      {showIdeal && <div className="col-span-2 text-center">Ideal</div>}
                      {showAProduzir && <div className="col-span-2 text-center">A Produzir</div>}
                      {showAcao && <div className="col-span-1 text-center">Ação</div>}
                    </div>

                    {/* Itens */}
                    {itens.map((item) => {
                      const contagem = contagensLoja.find(c => c.item_porcionado_id === item.id);
                      const finalSobraRaw = getEditingValue(loja.id, item.id, 'final_sobra', contagem?.final_sobra ?? '');
                      const finalSobra = finalSobraRaw === '' ? '' : finalSobraRaw;
                      const pesoTotal = getEditingValue(loja.id, item.id, 'peso_total_g', contagem?.peso_total_g ?? '');
                      const idealAmanhaRaw = getEditingValue(loja.id, item.id, 'ideal_amanha', '');
                      const idealAmanha = idealAmanhaRaw === '' ? '' : idealAmanhaRaw;
                      const aProduzir = Math.max(0, Number(idealAmanha || 0) - Number(finalSobra || 0));

                      return (
                        <div key={item.id} 
                             className="grid gap-2 px-4 py-3 items-center border-b last:border-b-0 hover:bg-accent/20"
                             style={{ gridTemplateColumns: `repeat(${gridConfig.totalSpan}, minmax(0, 1fr))` }}>
                          <div className="col-span-3">
                            <span className="font-medium text-sm">{item.nome}</span>
                            {contagem && (
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(contagem.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>

                          {showSobra && (
                            <div className="col-span-2">
                              <Input
                                type="number"
                                value={finalSobra}
                                onChange={(e) => handleValueChange(loja.id, item.id, 'final_sobra', e.target.value)}
                                className="h-8 text-center text-sm"
                                placeholder="0"
                              />
                            </div>
                          )}

                          {showPeso && (
                            <div className="col-span-2">
                              <WeightInputInline
                                value={pesoTotal}
                                onChange={(val) => handleValueChange(loja.id, item.id, 'peso_total_g', val)}
                                placeholder="0"
                              />
                            </div>
                          )}

                          {showIdeal && (
                            <div className="col-span-2">
                              <Input
                                type="number"
                                value={idealAmanha}
                                onChange={(e) => handleValueChange(loja.id, item.id, 'ideal_amanha', e.target.value)}
                                className="h-8 text-center text-sm"
                                placeholder="0"
                              />
                            </div>
                          )}

                          {showAProduzir && (
                            <div className="col-span-2">
                              <div className={`text-center font-bold text-sm py-1.5 rounded ${aProduzir > 0 ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                {aProduzir} un
                              </div>
                            </div>
                          )}

                          {showAcao && (
                            <div className="col-span-1 flex gap-1 justify-center">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEstoquesDialog(loja.id, item.id, item.nome)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <SaveButton
                                isDirty={isRowDirty(loja.id, item.id)}
                                isSaving={savingKeys.has(`${loja.id}-${item.id}`)}
                                onClick={() => handleSave(loja.id, item.id)}
                                className="h-8 px-2 text-xs"
                              />
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

        {/* Dialog de Estoques Ideais */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
              <Button onClick={handleSaveEstoquesIdeais}>
                Salvar Estoques Ideais
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ContagemPorcionados;
