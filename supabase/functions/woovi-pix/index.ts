import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema de validação com Zod
const ChargeRequestSchema = z.object({
  organizationId: z.string().uuid("organizationId deve ser um UUID válido"),
  plano: z.enum(['basico', 'profissional', 'enterprise'], {
    errorMap: () => ({ message: "Plano deve ser: basico, profissional ou enterprise" })
  }),
  valor: z.number()
    .int("Valor deve ser inteiro (centavos)")
    .min(100, "Valor mínimo é R$ 1,00 (100 centavos)")
    .max(100000000, "Valor máximo é R$ 1.000.000,00"),
  customerName: z.string().max(100, "Nome deve ter no máximo 100 caracteres").optional(),
  customerEmail: z.string().email("Email inválido").max(255, "Email deve ter no máximo 255 caracteres").optional(),
  customerTaxID: z.string()
    .regex(/^(\d{11}|\d{14})$/, "CPF (11 dígitos) ou CNPJ (14 dígitos) inválido")
    .optional(),
});

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

    // Parse e validar input com Zod
    const rawBody = await req.json();
    const parseResult = ChargeRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: 'Dados inválidos', 
          details: parseResult.error.flatten().fieldErrors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const body = parseResult.data;
    console.log('Received charge request:', { 
      organizationId: body.organizationId, 
      plano: body.plano, 
      valor: body.valor,
      customerEmail: body.customerEmail ? '***' : undefined,
      customerTaxID: body.customerTaxID ? '***' : undefined
    });

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
