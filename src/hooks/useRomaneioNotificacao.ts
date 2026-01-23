import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDay } from 'date-fns';

/**
 * Hook simplificado para verificar se todas as lojas encerraram a contagem
 * e notificar o operador. NÃO cria romaneios automaticamente.
 */
export const useRomaneioNotificacao = () => {
  /**
   * Verifica se TODAS as lojas com janela ativa encerraram a contagem.
   * NÃO cria romaneios automaticamente - apenas notifica o operador.
   * O operador escolhe a ordem de envio na tela de Romaneio.
   */
  const verificarSeTodasLojasEncerraram = async (
    organizationId: string,
    diaOperacional: string
  ): Promise<{ todasEncerraram: boolean; aguardandoLojas: string[] }> => {
    try {
      console.log('[Romaneio Notificacao] Verificando se todas as lojas encerraram...', { diaOperacional });

      const hoje = new Date();
      const diaSemanaAtual = getDay(hoje); // 0-6 (domingo-sábado)

      // 1. Buscar lojas NÃO-CPD com janela ATIVA para o dia da semana atual
      const { data: lojasData } = await supabase
        .from('lojas')
        .select('id, nome, tipo')
        .eq('organization_id', organizationId)
        .neq('tipo', 'cpd');

      if (!lojasData || lojasData.length === 0) {
        console.log('[Romaneio Notificacao] Nenhuma loja não-CPD encontrada');
        return { todasEncerraram: true, aguardandoLojas: [] };
      }

      // 2. Verificar janelas ativas por dia da semana
      const { data: janelasAtivas } = await supabase
        .from('janelas_contagem_por_dia')
        .select('loja_id')
        .eq('dia_semana', diaSemanaAtual)
        .eq('ativo', true)
        .in('loja_id', lojasData.map(l => l.id));

      // Se há janelas configuradas, usar apenas lojas com janela ativa
      // Se não há janelas configuradas, usar todas as lojas
      const lojasParaVerificar = janelasAtivas && janelasAtivas.length > 0
        ? lojasData.filter(l => janelasAtivas.some(j => j.loja_id === l.id))
        : lojasData;

      if (lojasParaVerificar.length === 0) {
        console.log('[Romaneio Notificacao] Nenhuma loja com janela ativa hoje');
        return { todasEncerraram: true, aguardandoLojas: [] };
      }

      console.log(`[Romaneio Notificacao] Lojas a verificar: ${lojasParaVerificar.map(l => l.nome).join(', ')}`);

      // 3. Verificar sessões ENCERRADAS do dia operacional
      const { data: sessoesEncerradas } = await supabase
        .from('sessoes_contagem')
        .select('loja_id')
        .eq('organization_id', organizationId)
        .eq('dia_operacional', diaOperacional)
        .eq('status', 'encerrada')
        .in('loja_id', lojasParaVerificar.map(l => l.id));

      const lojasEncerradas = new Set(sessoesEncerradas?.map(s => s.loja_id) || []);

      // 4. Verificar se TODAS as lojas ativas encerraram
      const lojasFaltando = lojasParaVerificar.filter(l => !lojasEncerradas.has(l.id));
      
      if (lojasFaltando.length > 0) {
        console.log(`[Romaneio Notificacao] Aguardando ${lojasFaltando.length} loja(s): ${lojasFaltando.map(l => l.nome).join(', ')}`);
        return { todasEncerraram: false, aguardandoLojas: lojasFaltando.map(l => l.nome) };
      }

      // ✅ TODAS as lojas encerraram - notificar o operador
      console.log('[Romaneio Notificacao] ✅ TODAS as lojas encerraram!');
      
      toast.success(
        '✅ Todas as lojas encerraram a contagem!',
        {
          description: 'Vá para a tela de Romaneio para enviar os itens. Escolha a ordem de entrega das lojas.',
          duration: 8000,
        }
      );

      return { todasEncerraram: true, aguardandoLojas: [] };
    } catch (error) {
      console.error('[Romaneio Notificacao] Erro inesperado:', error);
      return { todasEncerraram: false, aguardandoLojas: [] };
    }
  };

  return {
    verificarSeTodasLojasEncerraram
  };
};
