export type PlanoAssinatura = 'basico' | 'profissional' | 'enterprise';

export interface WooviChargeRequest {
  organizationId: string;
  plano: PlanoAssinatura;
  valor: number; // em centavos
  customerName?: string;
  customerEmail?: string;
  customerTaxID?: string; // CPF/CNPJ
}

export interface WooviChargeResponse {
  correlationID: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  value: number;
  brCode: string;
  qrCodeImage: string;
  expiresAt?: string;
  paymentLinkUrl?: string;
  globalID?: string;
}

export interface PaymentState {
  isLoading: boolean;
  error: string | null;
  charge: WooviChargeResponse | null;
}

export const PLANOS_CONFIG = {
  basico: {
    nome: 'Básico',
    preco: 9900, // R$ 99,00 em centavos
    recursos: [
      'Até 2 lojas',
      'Até 5 usuários',
      'Relatórios básicos',
      'Suporte por email'
    ]
  },
  profissional: {
    nome: 'Profissional',
    preco: 19900, // R$ 199,00 em centavos
    destaque: true,
    recursos: [
      'Até 10 lojas',
      'Usuários ilimitados',
      'Relatórios avançados',
      'Lista de Compras IA',
      'Suporte prioritário'
    ]
  },
  enterprise: {
    nome: 'Enterprise',
    preco: 39900, // R$ 399,00 em centavos
    recursos: [
      'Lojas ilimitadas',
      'Usuários ilimitados',
      'Relatórios customizados',
      'API de integração',
      'Suporte dedicado 24/7'
    ]
  }
} as const;
