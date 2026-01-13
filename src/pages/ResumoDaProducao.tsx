import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { KanbanCard } from '@/components/kanban/KanbanCard';
import { ProductGroupedStacks } from '@/components/kanban/ProductGroupedStacks';
import { ConcluirPreparoModal } from '@/components/modals/ConcluirPreparoModal';
import { FinalizarProducaoModal } from '@/components/modals/FinalizarProducaoModal';
import { CancelarPreparoModal } from '@/components/modals/CancelarPreparoModal';
import { RegistrarPerdaModal } from '@/components/modals/RegistrarPerdaModal';
import { CutoffStatusPanel } from '@/components/kanban/CutoffStatusPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useAlarmSound } from '@/hooks/useAlarmSound';
import { useCPDLoja } from '@/hooks/useCPDLoja';
import { RefreshCw } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useMovimentacaoEstoque } from '@/hooks/useMovimentacaoEstoque';


interface DetalheLojaProducao {
  loja_id: string;
  loja_nome: string;
  quantidade: number;
}

interface InsumoExtraComEstoque {
  nome: string;
  quantidade_necessaria: number;
  unidade: string;
  estoque_disponivel: number;
  estoque_suficiente: boolean;
}

interface ProducaoRegistro {
  id: string;
  item_id: string;
  item_nome: string;
  status: string;
  unidades_programadas: number | null;
  unidades_reais: number | null;
  peso_programado_kg: number | null;
  peso_final_kg: number | null;
  peso_preparo_kg?: number | null;
  sobra_preparo_kg?: number | null;
  sobra_kg?: number | null;
  observacao_preparo?: string | null;
  observacao_porcionamento?: string | null;
  data_inicio: string | null;
  data_inicio_preparo?: string | null;
  data_fim_preparo?: string | null;
  data_inicio_porcionamento?: string | null;
  data_fim_porcionamento?: string | null;
  data_fim: string | null;
  usuario_nome: string;
  detalhes_lojas?: DetalheLojaProducao[];
  unidade_medida?: string;
  equivalencia_traco?: number | null;
  insumo_principal_nome?: string;
  insumo_principal_estoque_kg?: number;
  insumosExtras?: InsumoExtraComEstoque[];
  demanda_lojas?: number | null;
  reserva_configurada?: number | null;
  sobra_reserva?: number | null;
  timer_ativo?: boolean;
  tempo_timer_minutos?: number | null;
  // Campos da fila de traços
  sequencia_traco?: number;
  lote_producao_id?: string;
  bloqueado_por_traco_anterior?: boolean;
  timer_status?: string;
  data_referencia?: string;
  total_tracos_lote?: number;
  // Campos de embalagem
  usa_embalagem_por_porcao?: boolean;
  insumo_embalagem_nome?: string;
  quantidade_embalagem?: number;
  unidade_embalagem?: string;
  // Campos LOTE_MASSEIRA
  lotes_masseira?: number;
  farinha_consumida_kg?: number;
  massa_total_gerada_kg?: number;
  peso_medio_operacional_bolinha_g?: number;
  peso_minimo_bolinha_g?: number;
  peso_maximo_bolinha_g?: number;
  peso_alvo_bolinha_g?: number;
  unidades_estimadas_masseira?: number;
  peso_medio_real_bolinha_g?: number;
  status_calibracao?: string;
  // Código único do lote para rastreabilidade
  codigo_lote?: string;
  // Campos de demanda congelada vs incremental
  demanda_congelada?: number | null;
  demanda_incremental?: number | null;
  demanda_base?: number | null;
  // Novo: lote incremental gerado após início da produção
  is_incremental?: boolean;
  demanda_base_snapshot?: number | null;
}

type StatusColumn = 'a_produzir' | 'em_preparo' | 'em_porcionamento' | 'finalizado';

interface KanbanColumns {
  a_produzir: ProducaoRegistro[];
  em_preparo: ProducaoRegistro[];
  em_porcionamento: ProducaoRegistro[];
  finalizado: ProducaoRegistro[];
}

const columnConfig: Record<StatusColumn, { title: string; color: string }> = {
  a_produzir: { title: 'A PRODUZIR', color: 'bg-slate-100 dark:bg-slate-800' },
  em_preparo: { title: 'EM PREPARO', color: 'bg-blue-100 dark:bg-blue-900' },
  em_porcionamento: { title: 'EM PORCIONAMENTO', color: 'bg-yellow-100 dark:bg-yellow-900' },
  finalizado: { title: 'FINALIZADO', color: 'bg-green-100 dark:bg-green-900' },
};

const ResumoDaProducao = () => {
  const { user, profile } = useAuth();
  const { organizationId } = useOrganization();
  const { cpdLojaId } = useCPDLoja();
  const { playAlarm, stopAlarm } = useAlarmSound();
  const { log } = useAuditLog();
  const { registrarMovimentacao } = useMovimentacaoEstoque();
  const [columns, setColumns] = useState<KanbanColumns>({
    a_produzir: [],
    em_preparo: [],
    em_porcionamento: [],
    finalizado: [],
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState<ProducaoRegistro | null>(null);
  const [modalPreparo, setModalPreparo] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [modalPerda, setModalPerda] = useState(false);
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  const [finishedTimers, setFinishedTimers] = useState<Set<string>>(new Set());

  const handleStopAlarm = () => {
    stopAlarm();
    setAlarmPlaying(false);
  };

  // Função para notificar quando timer acabar
  const handleTimerFinished = async (registroId: string) => {
    // Early return se já foi processado
    if (finishedTimers.has(registroId)) {
      return;
    }

    // Adicionar ao Set IMEDIATAMENTE para evitar chamadas duplicadas
    setFinishedTimers(prev => new Set(prev).add(registroId));
    
    // Tocar alarme apenas uma vez
    if (!alarmPlaying) {
      playAlarm();
      setAlarmPlaying(true);
    }

    // Atualizar timer_status do registro atual e desbloquear próximo traço
    try {
      // Buscar dados do registro atual
      const { data: registro } = await supabase
        .from('producao_registros')
        .select('lote_producao_id, sequencia_traco')
        .eq('id', registroId)
        .maybeSingle();

      // Atualizar timer_status para concluido
      await supabase
        .from('producao_registros')
        .update({ timer_status: 'concluido' })
        .eq('id', registroId);

      // Desbloquear próximo traço na sequência (se houver)
      if (registro?.lote_producao_id && registro.sequencia_traco) {
        await supabase
          .from('producao_registros')
          .update({ bloqueado_por_traco_anterior: false })
          .eq('lote_producao_id', registro.lote_producao_id)
          .eq('sequencia_traco', registro.sequencia_traco + 1);
      }

      // NÃO chamar loadProducaoRegistros() - realtime listener vai atualizar
    } catch (error) {
      console.error('Erro ao processar timer finalizado:', error);
    }
  };

  // Função para buscar dados do item e insumo vinculado
  const getItemInsumoData = async (itemId: string) => {
    const { data, error } = await supabase
      .from('itens_porcionados')
      .select('insumo_vinculado_id, baixar_producao_inicio, peso_unitario_g, nome, unidade_medida, equivalencia_traco, consumo_por_traco_g, usa_embalagem_por_porcao, insumo_embalagem_id, unidade_embalagem, fator_consumo_embalagem_por_porcao')
      .eq('id', itemId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar dados do item:', error);
      return null;
    }
    return data;
  };

  // Função para movimentar estoque de insumo com auditoria completa
  const movimentarEstoqueInsumo = async (
    insumoId: string,
    quantidade: number,
    itemNome: string,
    tipo: 'entrada' | 'saida',
    referenciaId?: string,
    referenciaTipo?: string
  ) => {
    try {
      // 1. Buscar nome do insumo
      const { data: insumo, error: insumoError } = await supabase
        .from('insumos')
        .select('nome, unidade_medida')
        .eq('id', insumoId)
        .single();

      if (insumoError) throw insumoError;

      // 2. Usar hook centralizado que registra estoque anterior/posterior automaticamente
      const tipoMovimentacao = tipo === 'saida' ? 'consumo_producao' : 'cancelamento_preparo';
      
      const result = await registrarMovimentacao({
        entidadeTipo: 'insumo',
        entidadeId: insumoId,
        entidadeNome: insumo.nome,
        tipoMovimentacao,
        quantidade,
        unidadeOrigem: 'CPD',
        observacao: `Produção: ${itemNome}`,
        referenciaId,
        referenciaTipo,
      });

      if (!result.success) {
        throw new Error(result.error || 'Erro ao movimentar estoque');
      }

      // Toast é exibido automaticamente pelo hook
    } catch (error) {
      console.error('Erro ao movimentar estoque:', error);
      toast.error('Erro ao atualizar estoque do insumo');
      throw error;
    }
  };

  useEffect(() => {
    if (!organizationId) return;
    
    let isMounted = true;
    let reloadTimeout: NodeJS.Timeout | null = null;

    loadProducaoRegistros();

    // Configurar realtime para atualizações automáticas com debounce
    const producaoChannel = supabase
      .channel('producao-registros-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'producao_registros'
        },
        () => {
          if (!isMounted) return;
          // Debounce de 500ms para evitar múltiplas chamadas - atualização silenciosa
          if (reloadTimeout) clearTimeout(reloadTimeout);
          reloadTimeout = setTimeout(() => {
            if (isMounted) loadProducaoRegistros(true); // silent = true
          }, 500);
        }
      )
      .subscribe();

    // Listener realtime para contagem_porcionados - quando lojas inserem contagens
    const contagemChannel = supabase
      .channel('contagem-porcionados-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contagem_porcionados'
        },
        () => {
          if (!isMounted) return;
          console.log('[ResumoDaProducao] Contagem atualizada - recarregando produção');
          // Debounce de 1s para contagens (dá tempo do sistema recalcular)
          if (reloadTimeout) clearTimeout(reloadTimeout);
          reloadTimeout = setTimeout(() => {
            if (isMounted) loadProducaoRegistros(true); // silent = true
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (reloadTimeout) clearTimeout(reloadTimeout);
      producaoChannel.unsubscribe().then(() => supabase.removeChannel(producaoChannel));
      contagemChannel.unsubscribe().then(() => supabase.removeChannel(contagemChannel));
    };
  }, [organizationId]);

  const loadProducaoRegistros = async (silent = false) => {
    try {
      if (!silent) {
        setInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      // REGRA OBRIGATÓRIA: Usar dia operacional do CPD (não data do servidor)
      // Isso sincroniza com ContagemPorcionados e criar_ou_atualizar_producao_registro
      let hoje: string;
      
      // Buscar loja CPD da organização
      const { data: cpdLoja } = await supabase
        .from('lojas')
        .select('id')
        .eq('tipo', 'cpd')
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      if (cpdLoja?.id) {
        // Usar dia operacional do CPD (respeitando timezone e cutoff)
        const { data: diaOp } = await supabase.rpc('calcular_dia_operacional', { p_loja_id: cpdLoja.id });
        hoje = diaOp || new Date().toISOString().split('T')[0];
      } else {
        // Fallback para data do servidor se não houver CPD
        const { data: dataServidor } = await supabase.rpc('get_current_date');
        hoje = dataServidor || new Date().toISOString().split('T')[0];
      }
      
      // Calcular ontem para incluir produções finalizadas recentes
      const ontemDate = new Date(hoje);
      ontemDate.setDate(ontemDate.getDate() - 1);
      const ontemStr = ontemDate.toISOString().split('T')[0];
      
      // Buscar produções do dia atual e ontem OU produções não finalizadas de dias anteriores
      // Isso garante que produções finalizadas recentemente apareçam na coluna FINALIZADO
      const { data, error } = await supabase
        .from('producao_registros')
        .select('*')
        .or(`data_referencia.gte.${ontemStr},status.neq.finalizado`)
        .order('data_inicio', { ascending: false });

      if (error) throw error;

      // Buscar dados dos itens (unidade_medida, equivalencia_traco, insumo_vinculado, timer_ativo, tempo_timer_minutos, campos masseira)
      const itemIds = [...new Set(data?.map(r => r.item_id) || [])];
      const { data: itensData } = await supabase
        .from('itens_porcionados')
        .select(`id, unidade_medida, equivalencia_traco, insumo_vinculado_id, timer_ativo, tempo_timer_minutos, 
          usa_embalagem_por_porcao, insumo_embalagem_id, unidade_embalagem, fator_consumo_embalagem_por_porcao,
          farinha_por_lote_kg, massa_gerada_por_lote_kg, peso_minimo_bolinha_g, peso_maximo_bolinha_g, 
          peso_alvo_bolinha_g, peso_medio_operacional_bolinha_g`)
        .in('id', itemIds);

      const itensMap = new Map(itensData?.map(i => [i.id, i]) || []);
      
      // Buscar nomes dos insumos de embalagem
      const embalagemIds = itensData?.filter(i => i.insumo_embalagem_id).map(i => i.insumo_embalagem_id) || [];
      const { data: embalagemInsumosData } = await supabase
        .from('insumos')
        .select('id, nome')
        .in('id', embalagemIds);
      
      const embalagemInsumosMap = new Map(embalagemInsumosData?.map(i => [i.id, i.nome]) || []);

      // Buscar todos os insumos vinculados (incluindo principal) para todos os itens
      const { data: insumosVinculadosData } = await supabase
        .from('insumos_extras')
        .select('*, insumos!inner(nome, quantidade_em_estoque, unidade_medida)')
        .in('item_porcionado_id', itemIds);

      // Buscar demanda congelada para o dia atual
      const { data: demandasCongeladas } = await supabase
        .from('demanda_congelada')
        .select('item_porcionado_id, demanda_total, detalhes_lojas')
        .eq('organization_id', organizationId)
        .eq('dia_producao', hoje);

      // Mapear demanda congelada por item_id
      const demandaCongeladaMap = new Map<string, { demanda_total: number }>(
        demandasCongeladas?.map(d => [d.item_porcionado_id, { demanda_total: d.demanda_total }]) || []
      );

      // Mapear insumos principais (is_principal = true) por item_porcionado_id
      const insumoPrincipalMap = new Map<string, {
        insumo_id: string;
        nome: string;
        quantidade_em_estoque: number;
        consumo_por_traco_g: number | null;
      }>();
      
      insumosVinculadosData?.forEach(iv => {
        if (iv.is_principal) {
          insumoPrincipalMap.set(iv.item_porcionado_id, {
            insumo_id: iv.insumo_id,
            nome: iv.insumos.nome,
            quantidade_em_estoque: iv.insumos.quantidade_em_estoque || 0,
            consumo_por_traco_g: iv.consumo_por_traco_g,
          });
        }
      });

      // Organizar registros por status
      const organizedColumns: KanbanColumns = {
        a_produzir: [],
        em_preparo: [],
        em_porcionamento: [],
        finalizado: [],
      };

      data?.forEach((registro) => {
        const itemInfo = itensMap.get(registro.item_id);
        let targetColumn: StatusColumn = 'a_produzir';
        const status = registro.status || 'a_produzir';
        
        // Mapear status para as colunas do Kanban
        if (status === 'aguardando_pesagem' || status === 'a_produzir') {
          targetColumn = 'a_produzir';
        } else if (status === 'em_preparo') {
          targetColumn = 'em_preparo';
        } else if (status === 'em_porcionamento') {
          targetColumn = 'em_porcionamento';
        } else if (status === 'finalizado' || status === 'concluido') {
          targetColumn = 'finalizado';
        }
        
        // Buscar insumo principal da tabela unificada
        const insumoPrincipal = insumoPrincipalMap.get(registro.item_id);
        
        // Calcular insumos vinculados necessários (apenas para "a_produzir")
        // Agora todos os insumos (incluindo principal) estão na tabela insumos_extras
        let insumosExtras: InsumoExtraComEstoque[] | undefined;
        if (targetColumn === 'a_produzir' && registro.unidades_programadas) {
          const insumosDoItem = insumosVinculadosData?.filter(e => e.item_porcionado_id === registro.item_id) || [];
          
          insumosExtras = insumosDoItem.map(insumoVinculado => {
            let quantidadeNecessaria = 0;
            const unidadesProgramadas = registro.unidades_programadas || 0;
            const escalaInsumo = (insumoVinculado as any).escala_configuracao || 'por_unidade';
            
            // ===== TRATAMENTO ESPECIAL PARA LOTE_MASSEIRA =====
            if (itemInfo?.unidade_medida === 'lote_masseira' && registro.lotes_masseira) {
              // Para LOTE_MASSEIRA, SEMPRE usar número de lotes, não unidades
              // Todos os insumos são configurados POR LOTE
              quantidadeNecessaria = registro.lotes_masseira * insumoVinculado.quantidade;
            } 
            // ===== DEMAIS TIPOS =====
            else if (escalaInsumo === 'por_lote' || escalaInsumo === 'por_traco') {
              // Insumo configurado para consumir por lote/traço
              if (itemInfo?.equivalencia_traco) {
                const lotes = Math.ceil(unidadesProgramadas / itemInfo.equivalencia_traco);
                quantidadeNecessaria = lotes * insumoVinculado.quantidade;
              } else {
                // Fallback se não há equivalência definida
                quantidadeNecessaria = unidadesProgramadas * insumoVinculado.quantidade;
              }
            } else {
              // por_unidade: cada unidade produzida consome a quantidade configurada
              quantidadeNecessaria = unidadesProgramadas * insumoVinculado.quantidade;
            }
            
            // Estoque disponível (sempre em kg)
            const estoqueDisponivelKg = insumoVinculado.insumos.quantidade_em_estoque || 0;
            const unidadeInsumo = (insumoVinculado.unidade as string)?.toLowerCase() || 'kg';
            
            // Converter quantidade necessária para kg se estiver em gramas
            let quantidadeNecessariaKg = quantidadeNecessaria;
            if (unidadeInsumo === 'g') {
              quantidadeNecessariaKg = quantidadeNecessaria / 1000;
            }
            
            return {
              nome: insumoVinculado.nome,
              quantidade_necessaria: quantidadeNecessaria,
              unidade: insumoVinculado.unidade,
              estoque_disponivel: estoqueDisponivelKg,
              estoque_suficiente: quantidadeNecessariaKg <= estoqueDisponivelKg
            };
          });
        }
        
        // Calcular total de traços no lote (se aplicável)
        let totalTracosLote: number | undefined;
        if (registro.lote_producao_id) {
          const tracosDoLote = data?.filter(r => r.lote_producao_id === registro.lote_producao_id) || [];
          totalTracosLote = tracosDoLote.length;
        }
        
        // Cast detalhes_lojas from Json to array e adicionar dados do item
        // Calcular quantidade de embalagem se aplicável
        let quantidadeEmbalagem: number | undefined;
        let insumoEmbalagemNome: string | undefined;
        if (itemInfo?.usa_embalagem_por_porcao && itemInfo.insumo_embalagem_id && registro.unidades_programadas) {
          const fator = itemInfo.fator_consumo_embalagem_por_porcao || 1;
          
          // Para LOTE_MASSEIRA, usar demanda real das lojas (não unidades arredondadas da masseira)
          if (itemInfo.unidade_medida === 'lote_masseira' && registro.demanda_lojas) {
            quantidadeEmbalagem = registro.demanda_lojas * fator;
          } else {
            quantidadeEmbalagem = registro.unidades_programadas * fator;
          }
          insumoEmbalagemNome = embalagemInsumosMap.get(itemInfo.insumo_embalagem_id);
        }

        // Calcular demanda congelada vs incremental
        const demandaCongeladaItem = demandaCongeladaMap.get(registro.item_id);
        const demandaCongeladaValue = demandaCongeladaItem?.demanda_total ?? null;
        const demandaLojas = registro.demanda_lojas || 0;
        
        // Calcular incremental (apenas se há demanda congelada)
        const demandaIncremental = demandaCongeladaValue !== null
          ? Math.max(0, demandaLojas - demandaCongeladaValue)
          : null;
        
        // Calcular base total
        const demandaBase = demandaCongeladaValue !== null
          ? demandaCongeladaValue + (demandaIncremental || 0)
          : demandaLojas;

        const registroTyped: ProducaoRegistro = {
          ...registro,
          detalhes_lojas: Array.isArray(registro.detalhes_lojas) 
            ? (registro.detalhes_lojas as unknown as DetalheLojaProducao[])
            : undefined,
          unidade_medida: itemInfo?.unidade_medida,
          equivalencia_traco: itemInfo?.equivalencia_traco,
          insumo_principal_nome: insumoPrincipal?.nome,
          insumo_principal_estoque_kg: insumoPrincipal?.quantidade_em_estoque,
          insumosExtras: insumosExtras,
          timer_ativo: itemInfo?.timer_ativo,
          tempo_timer_minutos: itemInfo?.tempo_timer_minutos,
          total_tracos_lote: totalTracosLote,
          // Dados de embalagem
          usa_embalagem_por_porcao: itemInfo?.usa_embalagem_por_porcao,
          insumo_embalagem_nome: insumoEmbalagemNome,
          quantidade_embalagem: quantidadeEmbalagem,
          unidade_embalagem: itemInfo?.unidade_embalagem,
          // Dados LOTE_MASSEIRA
          lotes_masseira: registro.lotes_masseira,
          farinha_consumida_kg: registro.farinha_consumida_kg,
          massa_total_gerada_kg: registro.massa_total_gerada_kg,
          peso_medio_operacional_bolinha_g: itemInfo?.peso_medio_operacional_bolinha_g,
          peso_minimo_bolinha_g: itemInfo?.peso_minimo_bolinha_g,
          peso_maximo_bolinha_g: itemInfo?.peso_maximo_bolinha_g,
          peso_alvo_bolinha_g: itemInfo?.peso_alvo_bolinha_g,
          peso_medio_real_bolinha_g: registro.peso_medio_real_bolinha_g,
          status_calibracao: registro.status_calibracao,
          // Calcular unidades estimadas para LOTE_MASSEIRA
          unidades_estimadas_masseira: (itemInfo?.unidade_medida as string) === 'lote_masseira' && 
            registro.lotes_masseira && 
            itemInfo?.massa_gerada_por_lote_kg && 
            itemInfo?.peso_medio_operacional_bolinha_g
              ? Math.floor(registro.lotes_masseira * itemInfo.massa_gerada_por_lote_kg / (itemInfo.peso_medio_operacional_bolinha_g / 1000))
              : undefined,
          // Dados de demanda congelada vs incremental
          demanda_congelada: demandaCongeladaValue,
          demanda_incremental: demandaIncremental,
          demanda_base: demandaBase,
          // Dados de lote incremental
          is_incremental: registro.is_incremental || false,
          demanda_base_snapshot: registro.demanda_base_snapshot,
        };
        
        organizedColumns[targetColumn].push(registroTyped);
      });

      setColumns(organizedColumns);
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      toast.error('Erro ao carregar registros de produção');
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleCardAction = async (registro: ProducaoRegistro, columnId: StatusColumn) => {
    setSelectedRegistro(registro);

    if (columnId === 'a_produzir') {
      // Verificar se está bloqueado por fila de traços
      if (registro.bloqueado_por_traco_anterior) {
        toast.error('⏳ Aguarde o traço anterior finalizar o timer');
        return;
      }

      // Verificar se há outro traço do mesmo item/dia com timer rodando
      if (registro.lote_producao_id) {
        const { data: tracoEmPreparo } = await supabase
          .from('producao_registros')
          .select('id')
          .eq('lote_producao_id', registro.lote_producao_id)
          .eq('timer_status', 'rodando')
          .neq('id', registro.id)
          .maybeSingle();
          
        if (tracoEmPreparo) {
          toast.error('🔒 Já existe um traço deste lote em preparo com timer ativo');
          return;
        }
      }

      // Transição direta para EM PREPARO (com registro completo)
      await transitionToPreparo(registro.id, registro);
    } else if (columnId === 'em_preparo') {
      // Parar alarme IMEDIATAMENTE ao clicar no botão
      if (alarmPlaying) {
        handleStopAlarm();
      }
      // Remover do set de timers finalizados
      setFinishedTimers(prev => {
        const newSet = new Set(prev);
        newSet.delete(registro.id);
        return newSet;
      });
      
      // Abrir modal de preparo
      setModalPreparo(true);
    } else if (columnId === 'em_porcionamento') {
      // Abrir modal de finalização
      setModalFinalizar(true);
    }
  };

  const transitionToPreparo = async (registroId: string, registro: ProducaoRegistro) => {
    try {
      // Buscar dados do item para verificar se deve baixar estoque no início
      const itemData = await getItemInsumoData(registro.item_id);
      
      // Se baixar_producao_inicio = true e tem insumo vinculado, deduzir estoque
      if (itemData?.baixar_producao_inicio && itemData.insumo_vinculado_id && registro.peso_programado_kg) {
        await movimentarEstoqueInsumo(
          itemData.insumo_vinculado_id,
          registro.peso_programado_kg,
          registro.item_nome,
          'saida'
        );
      }

      // Determinar timer_status baseado se o item tem timer ativo
      const timerStatus = registro.timer_ativo ? 'rodando' : 'concluido';

      // Calcular demanda atual total para snapshot
      const { data: demandaData } = await supabase
        .from('contagem_porcionados')
        .select('ideal_amanha, final_sobra')
        .eq('item_porcionado_id', registro.item_id)
        .eq('organization_id', organizationId)
        .eq('dia_operacional', registro.data_referencia || new Date().toISOString().split('T')[0]);
      
      const demandaAtual = demandaData?.reduce(
        (acc, c) => acc + Math.max(0, (c.ideal_amanha || 0) - (c.final_sobra || 0)), 0
      ) || 0;

      const { error } = await supabase
        .from('producao_registros')
        .update({
          status: 'em_preparo',
          data_inicio_preparo: new Date().toISOString(),
          timer_status: timerStatus,
          demanda_base_snapshot: demandaAtual, // Snapshot da demanda ao iniciar preparo
        })
        .eq('id', registroId);

      if (error) throw error;

      // Atualização otimista: mover card localmente ANTES do realtime
      setColumns(prev => {
        const cardToMove = prev.a_produzir.find(r => r.id === registroId);
        if (!cardToMove) return prev;
        return {
          ...prev,
          a_produzir: prev.a_produzir.filter(r => r.id !== registroId),
          em_preparo: [...prev.em_preparo, { ...cardToMove, status: 'em_preparo', data_inicio_preparo: new Date().toISOString() }],
        };
      });
      toast.success('Item movido para Em Preparo');
      // Realtime listener vai sincronizar dados completos
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleConcluirPreparo = async (data: {
    peso_preparo_kg: number;
    sobra_preparo_kg: number;
    observacao_preparo: string;
  }) => {
    // Parar alarme imediatamente ao avançar para porcionamento
    if (alarmPlaying) {
      handleStopAlarm();
    }
    
    console.log('🔵 handleConcluirPreparo chamado com data:', data);
    console.log('🔵 selectedRegistro:', selectedRegistro?.id, selectedRegistro?.item_nome);
    
    if (!selectedRegistro) {
      console.error('❌ selectedRegistro está null!');
      toast.error('Erro: registro não selecionado. Tente novamente.');
      return;
    }

    console.log('🔵 Fazendo update no Supabase para registro:', selectedRegistro.id);
    
    try {
      const { error } = await supabase
        .from('producao_registros')
        .update({
          status: 'em_porcionamento',
          peso_preparo_kg: data.peso_preparo_kg,
          sobra_preparo_kg: data.sobra_preparo_kg,
          observacao_preparo: data.observacao_preparo,
          data_fim_preparo: new Date().toISOString(),
          data_inicio_porcionamento: new Date().toISOString(),
        })
        .eq('id', selectedRegistro.id);

      if (error) {
        console.error('🔴 Erro do Supabase:', error);
        throw error;
      }

      console.log('🟢 Update no Supabase bem sucedido!');
      
      // Atualização otimista: mover card localmente
      setColumns(prev => {
        const cardToMove = prev.em_preparo.find(r => r.id === selectedRegistro.id);
        if (!cardToMove) return prev;
        return {
          ...prev,
          em_preparo: prev.em_preparo.filter(r => r.id !== selectedRegistro.id),
          em_porcionamento: [...prev.em_porcionamento, { 
            ...cardToMove, 
            status: 'em_porcionamento',
            peso_preparo_kg: data.peso_preparo_kg,
            sobra_preparo_kg: data.sobra_preparo_kg,
            data_inicio_porcionamento: new Date().toISOString() 
          }],
        };
      });
      
      toast.success(`${selectedRegistro.item_nome} avançou para porcionamento`);
      setModalPreparo(false);
      setSelectedRegistro(null);
      // Realtime listener vai sincronizar dados completos
    } catch (error) {
      console.error('🔴 Erro ao concluir preparo:', error);
      toast.error('Erro ao concluir preparo');
      throw error; // Re-throw para o modal saber que falhou
    }
  };

  const handleFinalizarProducao = async (data: {
    unidades_reais: number;
    peso_final_kg: number;
    sobra_kg: number;
    observacao_porcionamento: string;
  }) => {
    if (!selectedRegistro) return;

    try {
      // Buscar dados do item para verificar configurações
      const itemData = await getItemInsumoData(selectedRegistro.item_id);
      
      // Verificar se deve debitar insumos (apenas no primeiro lote da sequência)
      const deveDebitarInsumosEEmbalagem = 
        selectedRegistro.sequencia_traco === 1 || 
        selectedRegistro.sequencia_traco === undefined || 
        selectedRegistro.sequencia_traco === null;

      if (!deveDebitarInsumosEEmbalagem) {
        console.log(`[SKIP DÉBITO] Lote ${selectedRegistro.sequencia_traco} - insumos/embalagem já debitados no Lote 1`);
      }

      // Buscar TODOS os insumos vinculados (agora unificados na tabela insumos_extras)
      const { data: insumosVinculados, error: insumosError } = await supabase
        .from('insumos_extras')
        .select('*')
        .eq('item_porcionado_id', selectedRegistro.item_id);

      if (insumosError) {
        console.error('Erro ao buscar insumos vinculados:', insumosError);
      } else if (deveDebitarInsumosEEmbalagem && insumosVinculados && insumosVinculados.length > 0) {
        // Debitar cada insumo vinculado
        for (const insumoVinculado of insumosVinculados) {
          let quantidadeTotal = 0;
          
          // Detecção de LOTE_MASSEIRA com múltiplas verificações
          const isLoteMasseira = itemData?.unidade_medida === 'lote_masseira';
          const hasLotesMasseira = selectedRegistro.lotes_masseira && selectedRegistro.lotes_masseira > 0;
          
          console.log('[DEBUG INSUMO DÉBITO]', {
            itemId: selectedRegistro.item_id,
            itemNome: selectedRegistro.item_nome,
            unidadeMedida: itemData?.unidade_medida,
            isLoteMasseira,
            lotesMasseira: selectedRegistro.lotes_masseira,
            hasLotesMasseira,
            insumoNome: insumoVinculado.nome,
            insumoQuantidade: insumoVinculado.quantidade,
            unidadesReais: data.unidades_reais
          });
          
          // Calcular quantidade baseado no tipo de item
          if (isLoteMasseira && hasLotesMasseira) {
            // LOTE_MASSEIRA: usar número de lotes, NÃO unidades
            quantidadeTotal = selectedRegistro.lotes_masseira * insumoVinculado.quantidade;
            console.log(`[LOTE_MASSEIRA] ✅ Débito correto: ${selectedRegistro.lotes_masseira} lotes × ${insumoVinculado.quantidade} = ${quantidadeTotal}`);
          } else if (itemData?.unidade_medida === 'traco' && itemData.equivalencia_traco) {
            const tracos = data.unidades_reais / itemData.equivalencia_traco;
            // Para insumo principal, usar consumo_por_traco_g se disponível
            if (insumoVinculado.is_principal && insumoVinculado.consumo_por_traco_g) {
              quantidadeTotal = tracos * insumoVinculado.consumo_por_traco_g;
            } else {
              quantidadeTotal = tracos * insumoVinculado.quantidade;
            }
            console.log(`[TRACO] Débito: ${tracos} traços × ${insumoVinculado.quantidade} = ${quantidadeTotal}`);
          } else {
            // FALLBACK DE SEGURANÇA: Se tem lotes_masseira > 0, usar SEMPRE lotes
            if (hasLotesMasseira) {
              quantidadeTotal = selectedRegistro.lotes_masseira! * insumoVinculado.quantidade;
              console.warn(`[LOTE_MASSEIRA FALLBACK] ⚠️ unidade_medida="${itemData?.unidade_medida}" mas lotes_masseira=${selectedRegistro.lotes_masseira}. Usando lotes: ${quantidadeTotal}`);
            } else {
              quantidadeTotal = data.unidades_reais * insumoVinculado.quantidade;
              console.log(`[UNIDADE SIMPLES] ${data.unidades_reais} × ${insumoVinculado.quantidade} = ${quantidadeTotal}`);
            }
          }
          
          // Converter para kg se necessário
          let quantidadeKg = quantidadeTotal;
          if (insumoVinculado.unidade === 'g') {
            quantidadeKg = quantidadeTotal / 1000;
          } else if (insumoVinculado.unidade === 'ml') {
            quantidadeKg = quantidadeTotal / 1000;
          }
          
          // Só debitar se baixar_producao_inicio = false (para principal) ou sempre (para extras)
          const deveDebitar = insumoVinculado.is_principal 
            ? !itemData?.baixar_producao_inicio 
            : true; // Extras sempre debitam na finalização
          
          if (deveDebitar) {
            try {
              await movimentarEstoqueInsumo(
                insumoVinculado.insumo_id,
                quantidadeKg,
                `${selectedRegistro.item_nome}${insumoVinculado.is_principal ? '' : ' (adicional)'}`,
                'saida'
              );
            } catch (error) {
              console.error(`Erro ao debitar insumo ${insumoVinculado.nome}:`, error);
              toast.error(`Erro ao debitar ${insumoVinculado.nome}`);
            }
          }

          // Registrar no histórico de consumo
          const tipoInsumo = insumoVinculado.is_principal ? 'principal' : 'extra';
          const { error: consumoError } = await supabase.from('consumo_historico').insert({
            producao_registro_id: selectedRegistro.id,
            item_id: selectedRegistro.item_id,
            item_nome: selectedRegistro.item_nome,
            insumo_id: insumoVinculado.insumo_id,
            insumo_nome: insumoVinculado.nome,
            tipo_insumo: tipoInsumo,
            consumo_programado: selectedRegistro.peso_programado_kg || 0,
            consumo_real: quantidadeKg,
            unidade: insumoVinculado.unidade,
            usuario_id: user?.id || '',
            usuario_nome: profile?.nome || 'Sistema',
            organization_id: organizationId,
          });
          if (consumoError) {
            console.warn(`Aviso: falha ao registrar consumo ${tipoInsumo} no histórico:`, consumoError);
          }
        }
      }

      // === DÉBITO DE EMBALAGEM (apenas no Lote 1) ===
      if (deveDebitarInsumosEEmbalagem) {
        console.log('[DEBUG EMBALAGEM]', {
          usaEmbalagem: itemData?.usa_embalagem_por_porcao,
          insumoEmbalagemId: itemData?.insumo_embalagem_id,
          fator: itemData?.fator_consumo_embalagem_por_porcao,
          unidadesReais: data.unidades_reais,
          demandaLojas: selectedRegistro.demanda_lojas,
          hasLotesMasseira: selectedRegistro.lotes_masseira && selectedRegistro.lotes_masseira > 0
        });
      }

      if (deveDebitarInsumosEEmbalagem && itemData?.usa_embalagem_por_porcao && itemData.insumo_embalagem_id) {
        const fator = itemData.fator_consumo_embalagem_por_porcao || 1;
        const hasLotesMasseiraEmb = selectedRegistro.lotes_masseira && selectedRegistro.lotes_masseira > 0;
        
        // Para LOTE_MASSEIRA: usar demanda_lojas (quantidade real a enviar), não unidades_reais
        let quantidadeEmbalagem: number;
        
        if (hasLotesMasseiraEmb && selectedRegistro.demanda_lojas) {
          quantidadeEmbalagem = selectedRegistro.demanda_lojas * fator;
          console.log(`[EMBALAGEM LOTE_MASSEIRA] ✅ ${selectedRegistro.demanda_lojas} demanda × ${fator} fator = ${quantidadeEmbalagem}`);
        } else {
          quantidadeEmbalagem = data.unidades_reais * fator;
          console.log(`[EMBALAGEM PADRÃO] ${data.unidades_reais} unidades × ${fator} fator = ${quantidadeEmbalagem}`);
        }
        
        try {
          await movimentarEstoqueInsumo(
            itemData.insumo_embalagem_id,
            quantidadeEmbalagem,
            `Embalagem para ${selectedRegistro.item_nome}`,
            'saida'
          );
          console.log(`[EMBALAGEM] ✅ Debitado: ${quantidadeEmbalagem} ${itemData.unidade_embalagem || 'unidades'}`);
        } catch (error) {
          console.error('Erro ao debitar embalagem:', error);
          toast.error('Erro ao debitar embalagem do estoque');
        }
        
        // Registrar embalagem no histórico de consumo
        const { error: consumoEmbalagemError } = await supabase.from('consumo_historico').insert({
          producao_registro_id: selectedRegistro.id,
          item_id: selectedRegistro.item_id,
          item_nome: selectedRegistro.item_nome,
          insumo_id: itemData.insumo_embalagem_id,
          insumo_nome: 'Embalagem',
          tipo_insumo: 'embalagem',
          consumo_programado: quantidadeEmbalagem,
          consumo_real: quantidadeEmbalagem,
          unidade: itemData.unidade_embalagem || 'unidade',
          usuario_id: user?.id || '',
          usuario_nome: profile?.nome || 'Sistema',
          organization_id: organizationId,
        });
        
        if (consumoEmbalagemError) {
          console.warn('Aviso: falha ao registrar consumo de embalagem no histórico:', consumoEmbalagemError);
        }
      }

      const { error } = await supabase
        .from('producao_registros')
        .update({
          status: 'finalizado',
          unidades_reais: data.unidades_reais,
          peso_final_kg: data.peso_final_kg,
          sobra_kg: data.sobra_kg,
          observacao_porcionamento: data.observacao_porcionamento,
          data_fim_porcionamento: new Date().toISOString(),
          data_fim: new Date().toISOString(),
        })
        .eq('id', selectedRegistro.id);

      if (error) throw error;

      // Incrementar estoque CPD (tabela estoque_cpd - fonte de verdade para Romaneio)
      const { data: estoqueAtual } = await supabase
        .from('estoque_cpd')
        .select('quantidade')
        .eq('item_porcionado_id', selectedRegistro.item_id)
        .maybeSingle();

      const novaQuantidade = (estoqueAtual?.quantidade || 0) + data.unidades_reais;

      const { error: estoqueError } = await supabase
        .from('estoque_cpd')
        .upsert({
          item_porcionado_id: selectedRegistro.item_id,
          quantidade: novaQuantidade,
          data_ultima_movimentacao: new Date().toISOString(),
          organization_id: organizationId
        }, { 
          onConflict: 'item_porcionado_id'
        });

      if (estoqueError) {
        console.error('Erro ao atualizar estoque CPD:', estoqueError);
        toast.error('Produção finalizada, mas erro ao atualizar estoque');
      } else {
        toast.success('Produção finalizada com sucesso!');
      }

      // Atualização otimista: mover card localmente
      setColumns(prev => {
        const cardToMove = prev.em_porcionamento.find(r => r.id === selectedRegistro.id);
        if (!cardToMove) return prev;
        return {
          ...prev,
          em_porcionamento: prev.em_porcionamento.filter(r => r.id !== selectedRegistro.id),
          finalizado: [...prev.finalizado, { 
            ...cardToMove, 
            status: 'finalizado',
            unidades_reais: data.unidades_reais,
            peso_final_kg: data.peso_final_kg,
            sobra_kg: data.sobra_kg,
            data_fim: new Date().toISOString() 
          }],
        };
      });

      // Resetar a_produzir das contagens relacionadas zerando-as via ideal_amanha = final_sobra
      // (a_produzir é coluna gerada, não pode ser atualizada diretamente)
      const { data: contagensAtuais, error: fetchError } = await supabase
        .from('contagem_porcionados')
        .select('id, final_sobra')
        .eq('item_porcionado_id', selectedRegistro.item_id);

      if (fetchError) {
        console.error('Erro ao buscar contagens para reset:', fetchError);
      } else if (contagensAtuais) {
        for (const contagem of contagensAtuais) {
          await supabase
            .from('contagem_porcionados')
            .update({ ideal_amanha: contagem.final_sobra })
            .eq('id', contagem.id);
        }
      }
      
      setModalFinalizar(false);
      setSelectedRegistro(null);
      // Realtime listener vai sincronizar dados completos
    } catch (error) {
      console.error('Erro ao finalizar produção:', error);
      toast.error('Erro ao finalizar produção');
    }
  };

  // REGRA-MÃE: Cancelar Preparo (Cancelamento Técnico)
  // - Estorna estoque
  // - Retorna item para "A Produzir"
  // - Registra auditoria
  const handleCancelarPreparo = async (data: {
    motivo: string;
    observacao: string;
  }) => {
    if (!selectedRegistro) return;

    try {
      // 1. Buscar dados do item para verificar se houve baixa de estoque
      const itemData = await getItemInsumoData(selectedRegistro.item_id);

      // 2. ESTORNAR estoque se houve baixa no início do preparo
      if (itemData?.baixar_producao_inicio && itemData.insumo_vinculado_id && selectedRegistro.peso_programado_kg) {
        await movimentarEstoqueInsumo(
          itemData.insumo_vinculado_id,
          selectedRegistro.peso_programado_kg,
          `${selectedRegistro.item_nome} (estorno por cancelamento)`,
          'entrada'
        );
      }

      // 3. Atualizar producao_registros para voltar a "a_produzir"
      const { error } = await supabase
        .from('producao_registros')
        .update({
          status: 'a_produzir',
          data_inicio_preparo: null,
          data_fim_preparo: null,
          data_inicio_porcionamento: null,
          peso_preparo_kg: null,
          sobra_preparo_kg: null,
          observacao_preparo: `[CANCELADO] ${data.motivo}: ${data.observacao}`,
          timer_status: 'aguardando',
        })
        .eq('id', selectedRegistro.id);

      if (error) throw error;

      // 4. Desbloquear próximo traço se necessário
      if (selectedRegistro.lote_producao_id && selectedRegistro.sequencia_traco) {
        await supabase
          .from('producao_registros')
          .update({ bloqueado_por_traco_anterior: false })
          .eq('lote_producao_id', selectedRegistro.lote_producao_id)
          .eq('sequencia_traco', selectedRegistro.sequencia_traco + 1);
      }

      // 5. Registrar auditoria
      await log('user.update', 'producao_registro' as any, selectedRegistro.id, {
        action: 'cancelamento_tecnico',
        motivo: data.motivo,
        observacao: data.observacao,
        item_nome: selectedRegistro.item_nome,
        estoque_estornado: itemData?.baixar_producao_inicio ? 'sim' : 'nao',
        quantidade_estornada_kg: selectedRegistro.peso_programado_kg,
      } as any);

      // 6. Atualização otimista: mover card de volta para a_produzir
      const sourceColumn = selectedRegistro.status === 'em_preparo' ? 'em_preparo' : 'em_porcionamento';
      setColumns(prev => {
        const cardToMove = prev[sourceColumn as keyof KanbanColumns].find(r => r.id === selectedRegistro.id);
        if (!cardToMove) return prev;
        return {
          ...prev,
          [sourceColumn]: prev[sourceColumn as keyof KanbanColumns].filter(r => r.id !== selectedRegistro.id),
          a_produzir: [...prev.a_produzir, { ...cardToMove, status: 'a_produzir' }],
        };
      });

      toast.success(`✅ Preparo cancelado. ${selectedRegistro.item_nome} retornou para produção.`);
      setModalCancelar(false);
      setSelectedRegistro(null);

      // Parar alarme se estiver tocando
      if (alarmPlaying) {
        handleStopAlarm();
      }
    } catch (error) {
      console.error('Erro ao cancelar preparo:', error);
      toast.error('Erro ao cancelar preparo');
      throw error;
    }
  };

  // REGRA-MÃE: Registrar Perda (Perda Real)
  // - NÃO estorna estoque
  // - Remove item da fila de produção
  // - Registra prejuízo financeiro
  // - Registra auditoria completa
  const handleRegistrarPerda = async (data: {
    tipo_perda: string;
    quantidade_perdida: number;
    peso_perdido_kg: number | null;
    motivo: string;
  }) => {
    if (!selectedRegistro) return;

    try {
      // 1. Inserir registro de perda (NÃO estorna estoque)
      const { error: perdaError } = await supabase
        .from('perdas_producao')
        .insert({
          producao_registro_id: selectedRegistro.id,
          item_id: selectedRegistro.item_id,
          item_nome: selectedRegistro.item_nome,
          tipo_perda: data.tipo_perda,
          quantidade_perdida: data.quantidade_perdida,
          peso_perdido_kg: data.peso_perdido_kg,
          motivo: data.motivo,
          usuario_id: user?.id || '',
          usuario_nome: profile?.nome || 'Sistema',
          organization_id: organizationId,
        });

      if (perdaError) throw perdaError;

      // 2. Atualizar producao_registros para marcar como perda
      const { error: updateError } = await supabase
        .from('producao_registros')
        .update({
          status: 'finalizado',
          unidades_reais: 0,
          peso_final_kg: 0,
          data_fim: new Date().toISOString(),
          observacao_porcionamento: `[PERDA - ${data.tipo_perda.toUpperCase()}] ${data.motivo}`,
        })
        .eq('id', selectedRegistro.id);

      if (updateError) throw updateError;

      // 3. Desbloquear próximo traço se necessário
      if (selectedRegistro.lote_producao_id && selectedRegistro.sequencia_traco) {
        await supabase
          .from('producao_registros')
          .update({ bloqueado_por_traco_anterior: false })
          .eq('lote_producao_id', selectedRegistro.lote_producao_id)
          .eq('sequencia_traco', selectedRegistro.sequencia_traco + 1);
      }

      // 4. Registrar auditoria
      await log('user.update', 'producao_registro' as any, selectedRegistro.id, {
        action: 'perda_registrada',
        tipo_perda: data.tipo_perda,
        quantidade_perdida: data.quantidade_perdida,
        peso_perdido_kg: data.peso_perdido_kg,
        motivo: data.motivo,
        item_nome: selectedRegistro.item_nome,
        estoque_estornado: 'nao',
        prejuizo_financeiro: 'sim',
      } as any);

      // 5. Atualização otimista: remover card da coluna atual
      const sourceColumn = selectedRegistro.status === 'em_preparo' ? 'em_preparo' : 'em_porcionamento';
      setColumns(prev => ({
        ...prev,
        [sourceColumn]: prev[sourceColumn as keyof KanbanColumns].filter(r => r.id !== selectedRegistro.id),
        finalizado: [...prev.finalizado, { 
          ...selectedRegistro, 
          status: 'finalizado', 
          unidades_reais: 0,
          peso_final_kg: 0,
          data_fim: new Date().toISOString() 
        }],
      }));

      toast.warning(`⚠️ Perda registrada: ${data.quantidade_perdida} un de ${selectedRegistro.item_nome}. Estoque NÃO foi estornado.`);
      setModalPerda(false);
      setSelectedRegistro(null);

      // Parar alarme se estiver tocando
      if (alarmPlaying) {
        handleStopAlarm();
      }
    } catch (error) {
      console.error('Erro ao registrar perda:', error);
      toast.error('Erro ao registrar perda');
      throw error;
    }
  };

  // Handlers para abrir modais de cancelar e perda
  const handleOpenCancelarModal = (registro: ProducaoRegistro) => {
    setSelectedRegistro(registro);
    setModalCancelar(true);
  };

  const handleOpenPerdaModal = (registro: ProducaoRegistro) => {
    setSelectedRegistro(registro);
    setModalPerda(true);
  };

  // Mostrar loading apenas no carregamento inicial E quando não há dados
  const totalCards = columns.a_produzir.length + columns.em_preparo.length + columns.em_porcionamento.length + columns.finalizado.length;
  
  if (initialLoading && totalCards === 0) {
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
            <h1 className="text-3xl font-bold">Resumo da Produção</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o fluxo de produção através do Kanban
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isRefreshing && (
              <Badge variant="outline" className="animate-pulse text-muted-foreground">
                <div className="inline-block h-3 w-3 mr-2 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
                Sincronizando...
              </Badge>
            )}
            <Button size="sm" onClick={() => loadProducaoRegistros()} disabled={isRefreshing} className="!bg-green-600 hover:!bg-green-700 text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Painel de Status do Cutoff */}
        <CutoffStatusPanel />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(columnConfig) as StatusColumn[]).map((columnId) => (
            <div key={columnId} className="flex flex-col">
              <Card className={`${columnConfig[columnId].color} border-2`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span>{columnConfig[columnId].title}</span>
                    <Badge variant="secondary" className="ml-2">
                      {columns[columnId].length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 min-h-[500px]">
                  {/* Coluna A PRODUZIR usa Stack, demais usam lista tradicional */}
                  {columnId === 'a_produzir' ? (
                    <ProductGroupedStacks
                      registros={columns.a_produzir}
                      columnId="a_produzir"
                      onAction={(registro) => handleCardAction(registro, 'a_produzir')}
                      onTimerFinished={handleTimerFinished}
                      onCancelarPreparo={handleOpenCancelarModal}
                      onRegistrarPerda={handleOpenPerdaModal}
                    />
                  ) : (
                    <>
                      {columns[columnId].map((registro) => (
                        <KanbanCard
                          key={registro.id}
                          registro={registro}
                          columnId={columnId}
                          onAction={() => handleCardAction(registro, columnId)}
                          onTimerFinished={handleTimerFinished}
                          onCancelarPreparo={() => handleOpenCancelarModal(registro)}
                          onRegistrarPerda={() => handleOpenPerdaModal(registro)}
                        />
                      ))}
                      
                      {columns[columnId].length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Nenhum item nesta coluna
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Modais */}
      {selectedRegistro && (
        <>
          <ConcluirPreparoModal
            open={modalPreparo}
            onOpenChange={setModalPreparo}
            itemNome={selectedRegistro.item_nome}
            onConfirm={handleConcluirPreparo}
          />
          
          <FinalizarProducaoModal
            open={modalFinalizar}
            onOpenChange={setModalFinalizar}
            itemNome={selectedRegistro.item_nome}
            unidadesProgramadas={selectedRegistro.unidades_programadas}
            onConfirm={handleFinalizarProducao}
            // Props LOTE_MASSEIRA
            itemId={selectedRegistro.item_id}
            producaoRegistroId={selectedRegistro.id}
            unidadeMedida={selectedRegistro.unidade_medida}
            lotesProducidos={selectedRegistro.lotes_masseira}
            pesoMinimoBolinhaG={selectedRegistro.peso_minimo_bolinha_g}
            pesoMaximoBolinhaG={selectedRegistro.peso_maximo_bolinha_g}
            pesoAlvoBolinhaG={selectedRegistro.peso_alvo_bolinha_g}
            farinhaPorLoteKg={selectedRegistro.farinha_consumida_kg}
            massaGeradaPorLoteKg={selectedRegistro.massa_total_gerada_kg}
          />

          <CancelarPreparoModal
            open={modalCancelar}
            onOpenChange={setModalCancelar}
            itemNome={selectedRegistro.item_nome}
            onConfirm={handleCancelarPreparo}
          />

          <RegistrarPerdaModal
            open={modalPerda}
            onOpenChange={setModalPerda}
            itemNome={selectedRegistro.item_nome}
            unidadesProgramadas={selectedRegistro.unidades_programadas}
            pesoProgramadoKg={selectedRegistro.peso_programado_kg}
            onConfirm={handleRegistrarPerda}
          />
        </>
      )}
    </Layout>
  );
};

export default ResumoDaProducao;
