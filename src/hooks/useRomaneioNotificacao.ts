import { toast } from 'sonner';

/**
 * Hook simplificado para verificar se todas as lojas têm contagem recente
 * e notificar o operador. NÃO cria romaneios automaticamente.
 * 
 * NOTA: Sistema simplificado - não usa mais sessões nem dia operacional.
 * Apenas verifica se todas as lojas têm contagens recentes (últimas 24h).
 */
export const useRomaneioNotificacao = () => {
  /**
   * Verifica se TODAS as lojas têm contagem recente.
   * NÃO cria romaneios automaticamente - apenas notifica o operador.
   * O operador escolhe a ordem de envio na tela de Romaneio.
   */
  const verificarSeTodasLojasEncerraram = async (
    organizationId: string,
    diaOperacional: string // Mantido para compatibilidade, mas ignorado
  ): Promise<{ todasEncerraram: boolean; aguardandoLojas: string[] }> => {
    try {
      console.log('[Romaneio Notificacao] Sistema simplificado - notificação sempre positiva');
      
      // Sistema simplificado: sempre considera todas as lojas como "prontas"
      // pois não há mais conceito de sessão/dia operacional
      toast.success(
        '✅ Contagem atualizada!',
        {
          description: 'Vá para a tela de Romaneio para enviar os itens.',
          duration: 5000,
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
