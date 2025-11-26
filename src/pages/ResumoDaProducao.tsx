import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KanbanCard } from '@/components/kanban/KanbanCard';
import { ConcluirPreparoModal } from '@/components/modals/ConcluirPreparoModal';
import { FinalizarProducaoModal } from '@/components/modals/FinalizarProducaoModal';

interface ProducaoRegistro {
  id: string;
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

  useEffect(() => {
    loadProducaoRegistros();

    // Configurar realtime para atualizações automáticas
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
          loadProducaoRegistros();
        }
      )
      .subscribe();

    return () => {
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

      // Organizar registros por status
      const organizedColumns: KanbanColumns = {
        a_produzir: [],
        em_preparo: [],
        em_porcionamento: [],
        finalizado: [],
      };

      data?.forEach((registro) => {
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
        
        organizedColumns[targetColumn].push(registro);
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
      // Transição direta para EM PREPARO
      await transitionToPreparo(registro.id);
    } else if (columnId === 'em_preparo') {
      // Abrir modal de preparo
      setModalPreparo(true);
    } else if (columnId === 'em_porcionamento') {
      // Abrir modal de finalização
      setModalFinalizar(true);
    }
  };

  const transitionToPreparo = async (registroId: string) => {
    try {
      const { error } = await supabase
        .from('producao_registros')
        .update({
          status: 'em_preparo',
          data_inicio_preparo: new Date().toISOString(),
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
    if (!selectedRegistro) return;

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

      toast.success('Produção finalizada com sucesso!');
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
        <div>
          <h1 className="text-3xl font-bold">Resumo da Produção</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie o fluxo de produção através do Kanban
          </p>
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
