import { useMemo } from "react";
import { KanbanCard } from "./KanbanCard";
import { CardStack } from "./CardStack";

interface InsumoExtraComEstoque {
  nome: string;
  quantidade_necessaria: number;
  unidade: string;
  unidade_estoque: string;
  estoque_disponivel: number;
  estoque_suficiente: boolean;
}

interface DetalheLojaProducao {
  loja_id: string;
  loja_nome: string;
  quantidade: number;
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
  data_inicio: string | null;
  data_inicio_preparo?: string | null;
  data_inicio_porcionamento?: string | null;
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
  sequencia_traco?: number;
  lote_producao_id?: string;
  bloqueado_por_traco_anterior?: boolean;
  timer_status?: string;
  total_tracos_lote?: number;
  usa_embalagem_por_porcao?: boolean;
  insumo_embalagem_nome?: string;
  quantidade_embalagem?: number;
  unidade_embalagem?: string;
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
  codigo_lote?: string;
  margem_lote_percentual?: number | null;
}

type StatusColumn = 'a_produzir' | 'em_preparo' | 'em_porcionamento' | 'finalizado';

interface ProductGroup {
  itemId: string;
  itemNome: string;
  registros: ProducaoRegistro[];
  isStack: boolean;
}

interface ProductGroupedStacksProps {
  registros: ProducaoRegistro[];
  columnId: StatusColumn;
  onAction: (registro: ProducaoRegistro) => void;
  onTimerFinished?: (registroId: string) => void;
  onCancelarPreparo?: (registro: ProducaoRegistro) => void;
  onRegistrarPerda?: (registro: ProducaoRegistro) => void;
  lojaFiltradaId?: string | null;
  lojaIniciadaId?: string | null;
}

export function ProductGroupedStacks({
  registros,
  columnId,
  onAction,
  onTimerFinished,
  onCancelarPreparo,
  onRegistrarPerda,
  lojaFiltradaId,
  lojaIniciadaId,
}: ProductGroupedStacksProps) {
  // Filtrar registros pela loja selecionada (controle externo via prop)
  const filteredRegistros = useMemo(() => {
    if (!lojaFiltradaId) return registros;
    return registros.filter(r => r.detalhes_lojas?.[0]?.loja_id === lojaFiltradaId);
  }, [registros, lojaFiltradaId]);

  // Agrupar registros filtrados por item_id (para stacks de lotes)
  const groupedByItem = useMemo((): ProductGroup[] => {
    const groups = new Map<string, ProducaoRegistro[]>();
    
    filteredRegistros.forEach(registro => {
      const key = registro.item_id;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(registro);
    });
    
    // Converter para array e ordenar
    return Array.from(groups.entries())
      .map(([itemId, regs]) => ({
        itemId,
        itemNome: regs[0].item_nome,
        // Ordenar registros por sequencia_traco (1/8, 2/8, 3/8...)
        registros: regs.sort((a, b) => {
          const seqA = a.sequencia_traco ?? 0;
          const seqB = b.sequencia_traco ?? 0;
          return seqA - seqB;
        }),
        isStack: regs.length > 1,
      }))
      .sort((a, b) => b.registros.length - a.registros.length);
  }, [filteredRegistros]);

  if (filteredRegistros.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {lojaFiltradaId ? 'Nenhum item para esta loja' : 'Nenhum item nesta coluna'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groupedByItem.map((group) => {
        // Verificar se a produção está habilitada para este registro
        const registroLojaId = group.registros[0].detalhes_lojas?.[0]?.loja_id;
        const producaoHabilitada = lojaIniciadaId === registroLojaId;
        
        return (
          <div key={`${group.itemId}-${lojaFiltradaId || 'all'}`} className="animate-fade-in">
            {group.isStack ? (
              <CardStack
                registros={group.registros}
                columnId={columnId}
                onAction={onAction}
                onTimerFinished={onTimerFinished}
                onCancelarPreparo={onCancelarPreparo}
                onRegistrarPerda={onRegistrarPerda}
                producaoHabilitada={producaoHabilitada}
              />
            ) : (
              <KanbanCard
                registro={group.registros[0]}
                columnId={columnId}
                onAction={() => onAction(group.registros[0])}
                onTimerFinished={onTimerFinished}
                onCancelarPreparo={() => onCancelarPreparo?.(group.registros[0])}
                onRegistrarPerda={() => onRegistrarPerda?.(group.registros[0])}
                producaoHabilitada={producaoHabilitada}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
