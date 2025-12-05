import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WooviChargeRequest, WooviChargeResponse, PaymentState } from '@/types/payment';

export interface PaymentStatusResponse {
  correlationID: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  paidAt?: string;
  value: number;
}

export const useWooviPayment = () => {
  const [state, setState] = useState<PaymentState>({
    isLoading: false,
    error: null,
    charge: null,
  });
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'expired'>('pending');

  const createCharge = useCallback(async (
    organizationId: string,
    planoSlug: string,
    valorCentavos: number,
    customerInfo?: {
      name?: string;
      email?: string;
      taxID?: string;
    }
  ): Promise<WooviChargeResponse | null> => {
    setState({ isLoading: true, error: null, charge: null });
    setPaymentStatus('pending');

    try {
      const request: WooviChargeRequest = {
        organizationId,
        plano: planoSlug,
        valor: valorCentavos,
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

  const checkStatus = useCallback(async (
    correlationID: string,
    organizationId: string
  ): Promise<PaymentStatusResponse | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('woovi-check-status', {
        body: { correlationID, organizationId },
      });

      if (error) {
        console.error('Error checking status:', error);
        return null;
      }

      if (data?.error) {
        console.error('Status check error:', data.error);
        return null;
      }

      const statusResponse = data as PaymentStatusResponse;
      
      // Atualizar status local
      if (statusResponse.status === 'COMPLETED') {
        setPaymentStatus('paid');
      } else if (statusResponse.status === 'EXPIRED') {
        setPaymentStatus('expired');
      }

      return statusResponse;

    } catch (error) {
      console.error('Error checking payment status:', error);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, charge: null });
    setPaymentStatus('pending');
  }, []);

  return {
    ...state,
    paymentStatus,
    createCharge,
    checkStatus,
    reset,
  };
};
