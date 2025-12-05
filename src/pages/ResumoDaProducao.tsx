import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { KanbanCard } from '@/components/kanban/KanbanCard';
import { ConcluirPreparoModal } from '@/components/modals/ConcluirPreparoModal';
import { FinalizarProducaoModal } from '@/components/modals/FinalizarProducaoModal';
import { useAuth } from '@/contexts/AuthContext';
import { useAlarmSound } from '@/hooks/useAlarmSound';
import { Volume2, VolumeX } from 'lucide-react';

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
  const { playAlarm, stopAlarm } = useAlarmSound();
  const [columns, setColumns] = useState<KanbanColumns>({
    a_produzir: [],
    em_preparo: [],
    em_porcionamento: [],
    finalizado: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedRegistro, setSelectedRegistro] = useState<ProducaoRegistro | null>(null);
  const [modalPreparo, setModalPreparo] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);
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
      .select('insumo_vinculado_id, baixar_producao_inicio, peso_unitario_g, nome, unidade_medida, equivalencia_traco, consumo_por_traco_g')
      .eq('id', itemId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar dados do item:', error);
      return null;
    }
    return data;
  };

  // Função para movimentar estoque de insumo
  const movimentarEstoqueInsumo = async (
    insumoId: string,
    quantidade: number,
    itemNome: string,
    tipo: 'entrada' | 'saida'
  ) => {
    try {
      // 1. Buscar insumo e estoque atual
      const { data: insumo, error: insumoError } = await supabase
        .from('insumos')
        .select('nome, quantidade_em_estoque')
        .eq('id', insumoId)
        .single();

      if (insumoError) throw insumoError;

      // 2. Calcular novo estoque
      const estoqueAtual = insumo.quantidade_em_estoque || 0;
      const novoEstoque = tipo === 'saida' 
        ? estoqueAtual - quantidade 
        : estoqueAtual + quantidade;

      // 3. Atualizar estoque do insumo
      const { error: updateError } = await supabase
        .from('insumos')
        .update({ 
          quantidade_em_estoque: novoEstoque,
          data_ultima_movimentacao: new Date().toISOString()
        })
        .eq('id', insumoId);

      if (updateError) throw updateError;

      // 4. Registrar no log
      const { error: logError } = await supabase
        .from('insumos_log')
        .insert({
          insumo_id: insumoId,
          insumo_nome: insumo.nome,
          quantidade: tipo === 'saida' ? -quantidade : quantidade,
          tipo: tipo,
          usuario_id: user?.id || '',
          usuario_nome: profile?.nome || 'Sistema',
          organization_id: organizationId,
        });

      if (logError) throw logError;

      // 5. Toast de sucesso
      toast.success(
        `✅ Estoque de ${insumo.nome} atualizado: ${tipo === 'saida' ? '-' : '+'}${quantidade} kg`
      );
    } catch (error) {
      console.error('Erro ao movimentar estoque:', error);
      toast.error('Erro ao atualizar estoque do insumo');
      throw error;
    }
  };

  useEffect(() => {
    loadProducaoRegistros();

    // Debounce timeout ref
    let reloadTimeout: NodeJS.Timeout | null = null;

    // Configurar realtime para atualizações automáticas com debounce
    const channel = supabase
      .channel('producao-registros-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'producao_registros'
        },
        () => {
          // Debounce de 500ms para evitar múltiplas chamadas
          if (reloadTimeout) clearTimeout(reloadTimeout);
          reloadTimeout = setTimeout(() => {
            loadProducaoRegistros();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (reloadTimeout) clearTimeout(reloadTimeout);
      supabase.removeChannel(channel);
    };
  }, []);

  const loadProducaoRegistros = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('producao_registros')
        .select('*')
        .order('data_inicio', { ascending: false });

      if (error) throw error;

      // Buscar dados dos itens (unidade_medida, equivalencia_traco, insumo_vinculado, timer_ativo, tempo_timer_minutos)
      const itemIds = [...new Set(data?.map(r => r.item_id) || [])];
      const { data: itensData } = await supabase
        .from('itens_porcionados')
        .select('id, unidade_medida, equivalencia_traco, insumo_vinculado_id, timer_ativo, tempo_timer_minutos')
        .in('id', itemIds);

      const itensMap = new Map(itensData?.map(i => [i.id, i]) || []);

      // Buscar insumos extras para todos os itens
      const { data: insumosExtrasData } = await supabase
        .from('insumos_extras')
        .select('*, insumos!inner(nome, quantidade_em_estoque, unidade_medida)')
        .in('item_porcionado_id', itemIds);

      // Buscar estoque dos insumos principais
      const insumoIds = [...new Set(itensData?.map(i => i.insumo_vinculado_id).filter(Boolean) || [])];
      const { data: insumosData } = await supabase
        .from('insumos')
        .select('id, nome, quantidade_em_estoque')
        .in('id', insumoIds);

      const insumosMap = new Map(insumosData?.map(i => [i.id, i]) || []);

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
        
        // Buscar insumo principal
        const insumo = itemInfo?.insumo_vinculado_id ? insumosMap.get(itemInfo.insumo_vinculado_id) : null;
        
        // Calcular insumos extras necessários (apenas para "a_produzir")
        let insumosExtras: InsumoExtraComEstoque[] | undefined;
        if (targetColumn === 'a_produzir' && registro.unidades_programadas) {
          const extrasDoItem = insumosExtrasData?.filter(e => e.item_porcionado_id === registro.item_id) || [];
          
          insumosExtras = extrasDoItem.map(extra => {
            let quantidadeNecessaria = 0;
            
            // Calcular quantidade baseado em traços ou unidades
            if (itemInfo?.unidade_medida === 'traco' && itemInfo.equivalencia_traco) {
              const tracos = Math.ceil((registro.unidades_programadas || 0) / itemInfo.equivalencia_traco);
              quantidadeNecessaria = tracos * extra.quantidade;
            } else {
              quantidadeNecessaria = (registro.unidades_programadas || 0) * extra.quantidade;
            }
            
            return {
              nome: extra.nome,
              quantidade_necessaria: quantidadeNecessaria,
              unidade: extra.unidade,
              estoque_disponivel: extra.insumos.quantidade_em_estoque || 0,
              estoque_suficiente: quantidadeNecessaria <= (extra.insumos.quantidade_em_estoque || 0)
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
        const registroTyped: ProducaoRegistro = {
          ...registro,
          detalhes_lojas: Array.isArray(registro.detalhes_lojas) 
            ? (registro.detalhes_lojas as unknown as DetalheLojaProducao[])
            : undefined,
          unidade_medida: itemInfo?.unidade_medida,
          equivalencia_traco: itemInfo?.equivalencia_traco,
          insumo_principal_nome: insumo?.nome,
          insumo_principal_estoque_kg: insumo?.quantidade_em_estoque,
          insumosExtras: insumosExtras,
          timer_ativo: itemInfo?.timer_ativo,
          tempo_timer_minutos: itemInfo?.tempo_timer_minutos,
          total_tracos_lote: totalTracosLote,
        };
        
        organizedColumns[targetColumn].push(registroTyped);
      });

      setColumns(organizedColumns);
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      toast.error('Erro ao carregar registros de produção');
    } finally {
      setLoading(false);
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

      const { error } = await supabase
        .from('producao_registros')
        .update({
          status: 'em_preparo',
          data_inicio_preparo: new Date().toISOString(),
          timer_status: timerStatus,
        })
        .eq('id', registroId);

      if (error) throw error;

      toast.success('Item movido para Em Preparo');
      loadProducaoRegistros();
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
    if (!selectedRegistro) {
      console.error('❌ selectedRegistro está null!');
      toast.error('Erro: registro não selecionado. Tente novamente.');
      return;
    }

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

      if (error) throw error;

      toast.success('Etapa de preparo concluída');
      loadProducaoRegistros();
      setModalPreparo(false);
      setSelectedRegistro(null);
    } catch (error) {
      console.error('Erro ao concluir preparo:', error);
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
      // Buscar dados do item para verificar se deve baixar estoque no fim
      const itemData = await getItemInsumoData(selectedRegistro.item_id);
      
      // Se baixar_producao_inicio = false e tem insumo vinculado, deduzir estoque principal
      if (itemData && !itemData.baixar_producao_inicio && itemData.insumo_vinculado_id) {
        let quantidadeKg = 0;
        
        // Calcular quantidade baseado em traços ou unidades
        if (itemData.unidade_medida === 'traco' && itemData.consumo_por_traco_g && itemData.equivalencia_traco) {
          const tracos = data.unidades_reais / itemData.equivalencia_traco;
          quantidadeKg = (tracos * itemData.consumo_por_traco_g) / 1000; // converter g para kg
        } else {
          quantidadeKg = data.peso_final_kg || (data.unidades_reais * (itemData.peso_unitario_g / 1000));
        }
        
        await movimentarEstoqueInsumo(
          itemData.insumo_vinculado_id,
          quantidadeKg,
          selectedRegistro.item_nome,
          'saida'
        );
      }

      // Buscar e debitar insumos extras
      const { data: insumosExtras, error: extrasError } = await supabase
        .from('insumos_extras')
        .select('*')
        .eq('item_porcionado_id', selectedRegistro.item_id);

      if (extrasError) {
        console.error('Erro ao buscar insumos extras:', extrasError);
      } else if (insumosExtras && insumosExtras.length > 0) {
        // Debitar cada insumo extra
        for (const extra of insumosExtras) {
          let quantidadeTotal = 0;
          
          // Calcular quantidade baseado em traços ou unidades
          if (itemData?.unidade_medida === 'traco' && itemData.equivalencia_traco) {
            const tracos = data.unidades_reais / itemData.equivalencia_traco;
            quantidadeTotal = tracos * extra.quantidade;
          } else {
            quantidadeTotal = data.unidades_reais * extra.quantidade;
          }
          
          // Converter para kg se necessário
          let quantidadeKg = quantidadeTotal;
          if (extra.unidade === 'g') {
            quantidadeKg = quantidadeTotal / 1000;
          } else if (extra.unidade === 'l') {
            quantidadeKg = quantidadeTotal; // manter em litros
          } else if (extra.unidade === 'ml') {
            quantidadeKg = quantidadeTotal / 1000;
          }
          
          try {
            await movimentarEstoqueInsumo(
              extra.insumo_id,
              quantidadeKg,
              `${selectedRegistro.item_nome} (extra)`,
              'saida'
            );

            // Registrar no histórico de consumo (consumo extra)
            await supabase.from('consumo_historico').insert({
              producao_registro_id: selectedRegistro.id,
              item_id: selectedRegistro.item_id,
              item_nome: selectedRegistro.item_nome,
              insumo_id: extra.insumo_id,
              insumo_nome: extra.nome,
              tipo_insumo: 'extra',
              consumo_programado: selectedRegistro.peso_programado_kg || 0,
              consumo_real: quantidadeKg,
              unidade: extra.unidade,
              usuario_id: user?.id || '',
              usuario_nome: profile?.nome || 'Sistema',
              organization_id: organizationId,
            });
          } catch (error) {
            console.error(`Erro ao debitar insumo extra ${extra.nome}:`, error);
            toast.error(`Erro ao debitar ${extra.nome}`);
          }
        }
      }

      // Registrar consumo do insumo principal no histórico
      if (itemData?.insumo_vinculado_id) {
        let consumoProgramado = selectedRegistro.peso_programado_kg || 0;
        let consumoReal = 0;
        
        if (itemData.unidade_medida === 'traco' && itemData.consumo_por_traco_g && itemData.equivalencia_traco) {
          const tracos = data.unidades_reais / itemData.equivalencia_traco;
          consumoReal = (tracos * itemData.consumo_por_traco_g) / 1000;
        } else {
          consumoReal = data.peso_final_kg || (data.unidades_reais * (itemData.peso_unitario_g / 1000));
        }

        await supabase.from('consumo_historico').insert({
          producao_registro_id: selectedRegistro.id,
          item_id: selectedRegistro.item_id,
          item_nome: selectedRegistro.item_nome,
          insumo_id: itemData.insumo_vinculado_id,
          insumo_nome: itemData.nome,
          tipo_insumo: 'principal',
          consumo_programado: consumoProgramado,
          consumo_real: consumoReal,
          unidade: 'kg',
          usuario_id: user?.id || '',
          usuario_nome: profile?.nome || 'Sistema',
          organization_id: organizationId,
        });
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

      // Incrementar estoque CPD com unidades produzidas
      const { error: estoqueError } = await supabase.rpc('incrementar_estoque_cpd', {
        p_item_id: selectedRegistro.item_id,
        p_quantidade: data.unidades_reais
      });

      if (estoqueError) {
        console.error('Erro ao atualizar estoque CPD:', estoqueError);
        toast.error('Produção finalizada, mas erro ao atualizar estoque');
      } else {
        toast.success('Produção finalizada com sucesso!');
      }

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
      
      loadProducaoRegistros();
      setModalFinalizar(false);
      setSelectedRegistro(null);
    } catch (error) {
      console.error('Erro ao finalizar produção:', error);
      toast.error('Erro ao finalizar produção');
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
            <h1 className="text-3xl font-bold">Resumo da Produção</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o fluxo de produção através do Kanban
            </p>
          </div>
          {alarmPlaying && (
            <Button
              onClick={handleStopAlarm}
              variant="destructive"
              size="lg"
              className="animate-pulse"
            >
              <VolumeX className="h-5 w-5 mr-2" />
              Parar Alarme
            </Button>
          )}
        </div>

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
                  {columns[columnId].map((registro) => (
                    <KanbanCard
                      key={registro.id}
                      registro={registro}
                      columnId={columnId}
                      onAction={() => handleCardAction(registro, columnId)}
                      onTimerFinished={handleTimerFinished}
                    />
                  ))}
                  
                  {columns[columnId].length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum item nesta coluna
                    </div>
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
          />
        </>
      )}
    </Layout>
  );
};

export default ResumoDaProducao;
