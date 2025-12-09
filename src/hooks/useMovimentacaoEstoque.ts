import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

// Tipos de movimentação padronizados
export type TipoMovimentacao = 
  | 'compra'
  | 'producao'
  | 'transferencia_entrada'
  | 'transferencia_saida'
  | 'ajuste_positivo'
  | 'ajuste_negativo'
  | 'perda'
  | 'cancelamento_preparo'
  | 'romaneio_envio'
  | 'romaneio_recebimento'
  | 'consumo_producao';

// Tipos de entidade
export type TipoEntidade = 'insumo' | 'produto' | 'porcionado';

// Cores visuais por tipo de movimentação
export const CORES_MOVIMENTACAO: Record<TipoMovimentacao, { bg: string; text: string; label: string }> = {
  compra: { bg: 'bg-green-100', text: 'text-green-800', label: 'Compra' },
  producao: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Produção' },
  transferencia_entrada: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Transferência (Entrada)' },
  transferencia_saida: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Transferência (Saída)' },
  ajuste_positivo: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Ajuste (+)' },
  ajuste_negativo: { bg: 'bg-red-100', text: 'text-red-800', label: 'Ajuste (-)' },
  perda: { bg: 'bg-red-200', text: 'text-red-900', label: 'Perda' },
  cancelamento_preparo: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Cancelamento de Preparo' },
  romaneio_envio: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Romaneio (Envio)' },
  romaneio_recebimento: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Romaneio (Recebimento)' },
  consumo_producao: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Consumo Produção' },
};

// Tipos que requerem observação obrigatória
const TIPOS_REQUEREM_OBSERVACAO: TipoMovimentacao[] = [
  'ajuste_positivo',
  'ajuste_negativo',
  'perda',
  'cancelamento_preparo'
];

interface RegistrarMovimentacaoParams {
  entidadeTipo: TipoEntidade;
  entidadeId: string;
  entidadeNome: string;
  tipoMovimentacao: TipoMovimentacao;
  quantidade: number;
  unidadeOrigem: string;
  unidadeDestino?: string;
  observacao?: string;
  referenciaId?: string;
  referenciaTipo?: string;
}

interface MovimentacaoResult {
  success: boolean;
  estoqueAnterior?: number;
  estoqueResultante?: number;
  tipoMovimentacao?: string;
  quantidade?: number;
  error?: string;
}

export const useMovimentacaoEstoque = () => {
  const { user, profile } = useAuth();
  const { organizationId } = useOrganization();
  const [isProcessing, setIsProcessing] = useState(false);

  // Validação client-side
  const validarMovimentacao = useCallback((params: RegistrarMovimentacaoParams): string | null => {
    if (!params.quantidade || params.quantidade <= 0) {
      return 'Quantidade deve ser maior que zero';
    }

    if (!params.entidadeId) {
      return 'ID do item é obrigatório';
    }

    if (!params.entidadeNome) {
      return 'Nome do item é obrigatório';
    }

    if (!params.unidadeOrigem) {
      return 'Unidade de origem é obrigatória';
    }

    // Validar observação obrigatória
    if (TIPOS_REQUEREM_OBSERVACAO.includes(params.tipoMovimentacao)) {
      if (!params.observacao || params.observacao.trim() === '') {
        return 'Observação é obrigatória para este tipo de movimentação';
      }
    }

    return null;
  }, []);

  // Função principal de registro
  const registrarMovimentacao = useCallback(async (
    params: RegistrarMovimentacaoParams
  ): Promise<MovimentacaoResult> => {
    // Prevenir duplo clique
    if (isProcessing) {
      return { success: false, error: 'Operação em andamento' };
    }

    // Validações client-side
    const erroValidacao = validarMovimentacao(params);
    if (erroValidacao) {
      toast.error(erroValidacao);
      return { success: false, error: erroValidacao };
    }

    if (!user?.id || !organizationId) {
      toast.error('Usuário não autenticado');
      return { success: false, error: 'Usuário não autenticado' };
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc('registrar_movimentacao_estoque', {
        p_entidade_tipo: params.entidadeTipo,
        p_entidade_id: params.entidadeId,
        p_entidade_nome: params.entidadeNome,
        p_tipo_movimentacao: params.tipoMovimentacao,
        p_quantidade: params.quantidade,
        p_usuario_id: user.id,
        p_usuario_nome: profile?.nome || user.email || 'Usuário',
        p_unidade_origem: params.unidadeOrigem,
        p_unidade_destino: params.unidadeDestino || null,
        p_observacao: params.observacao || null,
        p_referencia_id: params.referenciaId || null,
        p_referencia_tipo: params.referenciaTipo || null,
        p_organization_id: organizationId,
      });

      if (error) {
        console.error('Erro ao registrar movimentação:', error);
        toast.error(`Erro ao registrar movimentação: ${error.message}`);
        return { success: false, error: error.message };
      }

      const result = data as unknown as MovimentacaoResult;

      if (!result.success) {
        toast.error(result.error || 'Erro ao registrar movimentação');
        return result;
      }

      // Toast de sucesso com cor apropriada
      const corConfig = CORES_MOVIMENTACAO[params.tipoMovimentacao];
      toast.success(
        `${corConfig.label} registrada: ${params.entidadeNome} (${params.quantidade})`,
        {
          description: `Estoque: ${result.estoqueAnterior} → ${result.estoqueResultante}`
        }
      );

      return result;

    } catch (error) {
      console.error('Erro inesperado:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, user, profile, organizationId, validarMovimentacao]);

  // Verificar se tipo requer observação
  const requerObservacao = useCallback((tipo: TipoMovimentacao): boolean => {
    return TIPOS_REQUEREM_OBSERVACAO.includes(tipo);
  }, []);

  return {
    registrarMovimentacao,
    isProcessing,
    requerObservacao,
    CORES_MOVIMENTACAO,
  };
};
