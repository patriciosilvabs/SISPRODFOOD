import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GripVertical, Package } from 'lucide-react';

interface ProducaoRegistro {
  id: string;
  item_nome: string;
  status: string;
  unidades_programadas: number | null;
  unidades_reais: number | null;
  peso_programado_kg: number | null;
  peso_final_kg: number | null;
  data_inicio: string | null;
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

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Se não há destino ou se o item foi solto no mesmo lugar
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return;
    }

    const sourceColumn = source.droppableId as StatusColumn;
    const destColumn = destination.droppableId as StatusColumn;

    // Criar cópias das colunas
    const newColumns = { ...columns };
    const sourceItems = [...newColumns[sourceColumn]];
    const destItems = sourceColumn === destColumn ? sourceItems : [...newColumns[destColumn]];

    // Remover do source
    const [movedItem] = sourceItems.splice(source.index, 1);

    // Adicionar ao destination
    destItems.splice(destination.index, 0, movedItem);

    // Atualizar estado local
    newColumns[sourceColumn] = sourceItems;
    newColumns[destColumn] = destItems;
    setColumns(newColumns);

    // Atualizar no banco de dados
    try {
      const { error } = await supabase
        .from('producao_registros')
        .update({ status: destColumn })
        .eq('id', draggableId);

      if (error) throw error;

      toast.success('Status atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
      // Reverter mudança em caso de erro
      loadProducaoRegistros();
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

        <DragDropContext onDragEnd={onDragEnd}>
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
                  <Droppable droppableId={columnId}>
                    {(provided, snapshot) => (
                      <CardContent
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-2 min-h-[500px] ${
                          snapshot.isDraggingOver ? 'bg-accent/50' : ''
                        }`}
                      >
                        {columns[columnId].map((registro, index) => (
                          <Draggable
                            key={registro.id}
                            draggableId={registro.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-move hover:shadow-md transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg opacity-90' : ''
                                }`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Package className="h-4 w-4 text-primary flex-shrink-0" />
                                        <h4 className="font-semibold text-sm truncate">
                                          {registro.item_nome}
                                        </h4>
                                      </div>
                                      
                                      <div className="space-y-1 text-xs text-muted-foreground">
                                        {registro.unidades_programadas && (
                                          <p>
                                            📦 Programadas: {registro.unidades_programadas} un
                                          </p>
                                        )}
                                        {registro.unidades_reais && (
                                          <p>
                                            ✅ Reais: {registro.unidades_reais} un
                                          </p>
                                        )}
                                        {registro.peso_programado_kg && (
                                          <p>
                                            ⚖️ Peso prog.: {registro.peso_programado_kg} kg
                                          </p>
                                        )}
                                        {registro.data_inicio && (
                                          <p className="mt-2 pt-2 border-t">
                                            🕐 {format(new Date(registro.data_inicio), 'dd/MM HH:mm', { locale: ptBR })}
                                          </p>
                                        )}
                                        <p className="text-xs font-medium">
                                          👤 {registro.usuario_nome}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {columns[columnId].length === 0 && (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            Nenhum item nesta coluna
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Droppable>
                </Card>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </Layout>
  );
};

export default ResumoDaProducao;
