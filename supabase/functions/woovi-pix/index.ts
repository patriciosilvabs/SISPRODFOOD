import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChargeRequest {
  organizationId: string;
  plano: 'basico' | 'profissional' | 'enterprise';
  valor: number; // em centavos
  customerName?: string;
  customerEmail?: string;
  customerTaxID?: string; // CPF/CNPJ
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const wooviApiKey = Deno.env.get('WOOVI_API_KEY');
    if (!wooviApiKey) {
      console.error('WOOVI_API_KEY not configured');
      throw new Error('Configuração de pagamento não encontrada');
    }

    const body: ChargeRequest = await req.json();
    console.log('Received charge request:', { ...body, customerTaxID: '***' });

    // Validação básica
    if (!body.organizationId || !body.plano || !body.valor) {
      throw new Error('Campos obrigatórios: organizationId, plano, valor');
    }

    if (body.valor < 100) {
      throw new Error('Valor mínimo é R$ 1,00 (100 centavos)');
    }

    // Gerar correlationID único
    const correlationID = crypto.randomUUID();
    console.log('Generated correlationID:', correlationID);

    // Montar payload para Woovi
    const chargePayload: Record<string, unknown> = {
      correlationID,
      value: body.valor,
      comment: `Assinatura plano ${body.plano} - ${body.organizationId}`,
      expiresIn: 900, // 15 minutos
    };

    // Adicionar dados do cliente se fornecidos
    if (body.customerName || body.customerEmail || body.customerTaxID) {
      chargePayload.customer = {
        name: body.customerName || 'Cliente',
        email: body.customerEmail,
        taxID: body.customerTaxID,
      };
    }

    console.log('Calling Woovi API...');
    
    // Chamar API da Woovi
    const wooviResponse = await fetch('https://api.openpix.com.br/api/v1/charge', {
      method: 'POST',
      headers: {
        'Authorization': wooviApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chargePayload),
    });

    const responseText = await wooviResponse.text();
    console.log('Woovi API response status:', wooviResponse.status);
    console.log('Woovi API response:', responseText);

    if (!wooviResponse.ok) {
      console.error('Woovi API error:', responseText);
      throw new Error(`Erro ao criar cobrança PIX: ${wooviResponse.status}`);
    }

    const wooviData = JSON.parse(responseText);

    // Extrair dados relevantes
    const charge = wooviData.charge;
    if (!charge) {
      console.error('Invalid Woovi response - no charge object:', wooviData);
      throw new Error('Resposta inválida da API de pagamento');
    }

    const result = {
      correlationID: charge.correlationID || correlationID,
      status: charge.status || 'ACTIVE',
      value: charge.value || body.valor,
      brCode: charge.brCode,
      qrCodeImage: charge.qrCodeImage,
      expiresAt: charge.expiresDate,
      paymentLinkUrl: charge.paymentLinkUrl,
      globalID: charge.globalID,
    };

    console.log('Charge created successfully:', { correlationID: result.correlationID, status: result.status });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in woovi-pix function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao processar pagamento' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
