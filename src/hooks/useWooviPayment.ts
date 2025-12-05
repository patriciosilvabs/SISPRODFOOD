import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WooviChargeRequest, WooviChargeResponse, PaymentState, PlanoAssinatura, PLANOS_CONFIG } from '@/types/payment';

export const useWooviPayment = () => {
  const [state, setState] = useState<PaymentState>({
    isLoading: false,
    error: null,
    charge: null,
  });

  const createCharge = useCallback(async (
    organizationId: string,
    plano: PlanoAssinatura,
    customerInfo?: {
      name?: string;
      email?: string;
      taxID?: string;
    }
  ): Promise<WooviChargeResponse | null> => {
    setState({ isLoading: true, error: null, charge: null });

    try {
      const planoConfig = PLANOS_CONFIG[plano];
      if (!planoConfig) {
        throw new Error('Plano inválido');
      }

      const request: WooviChargeRequest = {
        organizationId,
        plano,
        valor: planoConfig.preco,
        customerName: customerInfo?.name,
        customerEmail: customerInfo?.email,
        customerTaxID: customerInfo?.taxID,
      };

      const { data, error } = await supabase.functions.invoke('woovi-pix', {
        body: request,
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro ao criar cobrança');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const charge = data as WooviChargeResponse;
      setState({ isLoading: false, error: null, charge });
      return charge;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Payment error:', errorMessage);
      setState({ isLoading: false, error: errorMessage, charge: null });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, charge: null });
  }, []);

  return {
    ...state,
    createCharge,
    reset,
  };
};
