import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckStatusRequest {
  correlationID: string;
  organizationId: string;
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

    const body: CheckStatusRequest = await req.json();
    console.log('Checking payment status:', body.correlationID);

    if (!body.correlationID || !body.organizationId) {
      throw new Error('Campos obrigatórios: correlationID, organizationId');
    }

    // Consultar status da cobrança na Woovi
    const wooviResponse = await fetch(
      `https://api.openpix.com.br/api/v1/charge/${body.correlationID}`,
      {
        method: 'GET',
        headers: {
          'Authorization': wooviApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const responseText = await wooviResponse.text();
    console.log('Woovi status response:', wooviResponse.status);

    if (!wooviResponse.ok) {
      console.error('Woovi API error:', responseText);
      throw new Error(`Erro ao consultar cobrança: ${wooviResponse.status}`);
    }

    const wooviData = JSON.parse(responseText);
    const charge = wooviData.charge;

    if (!charge) {
      throw new Error('Cobrança não encontrada');
    }

    console.log('Charge status:', { 
      correlationID: charge.correlationID, 
      status: charge.status,
      paidAt: charge.paidAt 
    });

    // Se o pagamento foi confirmado, atualizar a organização
    if (charge.status === 'COMPLETED') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Extrair plano do comentário
      const planoMatch = charge.comment?.match(/plano (\w+)/i);
      const planoSlug = planoMatch ? planoMatch[1].toLowerCase() : 'basico';

      // Buscar informações do plano
      const { data: planoData } = await supabase
        .from('planos_assinatura')
        .select('intervalo, nome')
        .eq('slug', planoSlug)
        .single();

      // Calcular data de expiração
      const now = new Date();
      let expiresAt = new Date(now);
      
      if (planoData?.intervalo === 'anual') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      // Verificar se já foi processado
      const { data: org } = await supabase
        .from('organizations')
        .select('subscription_status, woovi_subscription_id')
        .eq('id', body.organizationId)
        .single();

      // Só atualiza se ainda não foi processado
      if (org?.woovi_subscription_id !== charge.correlationID || org?.subscription_status !== 'active') {
        const { error: updateError } = await supabase
          .from('organizations')
          .update({
            subscription_status: 'active',
            subscription_plan: planoSlug,
            subscription_expires_at: expiresAt.toISOString(),
            woovi_subscription_id: charge.correlationID,
          })
          .eq('id', body.organizationId);

        if (updateError) {
          console.error('Error updating organization:', updateError);
        } else {
          console.log('Organization updated via polling:', body.organizationId);

          // Registrar no histórico
          await supabase.from('subscription_history').insert({
            organization_id: body.organizationId,
            event_type: 'payment_confirmed',
            amount_cents: charge.value,
            payment_method: 'pix',
            woovi_charge_id: charge.correlationID,
            woovi_correlation_id: charge.correlationID,
            metadata: {
              plano: planoSlug,
              plano_nome: planoData?.nome,
              paidAt: charge.paidAt,
              source: 'polling',
            }
          });
        }
      }
    }

    return new Response(JSON.stringify({
      correlationID: charge.correlationID,
      status: charge.status,
      paidAt: charge.paidAt,
      value: charge.value,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error checking status:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao verificar status' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
