import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

interface WooviWebhookPayload {
  event: string;
  charge?: {
    correlationID: string;
    status: string;
    value: number;
    comment?: string;
    paidAt?: string;
    customer?: {
      name?: string;
      email?: string;
      taxID?: string;
    };
  };
  pix?: {
    value: number;
    time: string;
    endToEndId: string;
  };
}

// Verify webhook signature using HMAC-SHA256
async function verifyWebhookSignature(payload: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) {
    console.error('Missing webhook signature header');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Compare signatures (case-insensitive)
    const isValid = computedSignature.toLowerCase() === signature.toLowerCase();
    
    if (!isValid) {
      console.error('Webhook signature mismatch');
      console.log('Computed:', computedSignature.substring(0, 16) + '...');
      console.log('Received:', signature.substring(0, 16) + '...');
    }

    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('WOOVI_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      console.error('WOOVI_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the raw body for signature verification
    const rawBody = await req.text();
    
    // Verify webhook signature
    const signature = req.headers.get('x-webhook-signature');
    const isValidSignature = await verifyWebhookSignature(rawBody, signature, webhookSecret);
    
    if (!isValidSignature) {
      console.error('Invalid webhook signature - rejecting request');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Webhook signature verified successfully');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WooviWebhookPayload = JSON.parse(rawBody);
    console.log('Received Woovi webhook:', JSON.stringify(payload));

    // Verificar se é um evento de pagamento confirmado
    if (payload.event === 'OPENPIX:CHARGE_COMPLETED' && payload.charge) {
      const { correlationID, status, value, comment, paidAt } = payload.charge;
      
      console.log('Payment completed:', { correlationID, status, value });

      // Extrair organizationId do comentário (formato: "Assinatura plano X - {orgId}")
      const orgIdMatch = comment?.match(/- ([a-f0-9-]{36})$/);
      const organizationId = orgIdMatch ? orgIdMatch[1] : null;

      if (!organizationId) {
        console.error('Could not extract organizationId from comment:', comment);
        return new Response(JSON.stringify({ error: 'Invalid comment format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Extrair nome do plano do comentário
      const planoMatch = comment?.match(/plano (\w+)/i);
      const planoSlug = planoMatch ? planoMatch[1].toLowerCase() : 'basico';

      // Buscar informações do plano para definir duração da assinatura
      const { data: planoData } = await supabase
        .from('planos_assinatura')
        .select('intervalo, nome')
        .eq('slug', planoSlug)
        .single();

      // Calcular data de expiração (30 dias para mensal, 365 para anual)
      const now = new Date();
      let expiresAt = new Date(now);
      
      if (planoData?.intervalo === 'anual') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      // Atualizar organização com status de assinatura ativa
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          subscription_status: 'active',
          subscription_plan: planoSlug,
          subscription_expires_at: expiresAt.toISOString(),
          woovi_subscription_id: correlationID,
        })
        .eq('id', organizationId);

      if (updateError) {
        console.error('Error updating organization:', updateError);
        throw updateError;
      }

      console.log('Organization updated successfully:', organizationId);

      // Registrar no histórico de assinaturas
      const { error: historyError } = await supabase
        .from('subscription_history')
        .insert({
          organization_id: organizationId,
          event_type: 'payment_confirmed',
          amount_cents: value,
          payment_method: 'pix',
          woovi_charge_id: correlationID,
          woovi_correlation_id: correlationID,
          metadata: {
            plano: planoSlug,
            plano_nome: planoData?.nome,
            paidAt: paidAt,
            endToEndId: payload.pix?.endToEndId,
          }
        });

      if (historyError) {
        console.error('Error recording subscription history:', historyError);
        // Não falha a requisição, apenas loga o erro
      }

      console.log('Payment processed successfully for organization:', organizationId);

      return new Response(JSON.stringify({ 
        success: true,
        organizationId,
        status: 'active',
        expiresAt: expiresAt.toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Outros eventos (como CHARGE_CREATED, CHARGE_EXPIRED, etc.)
    console.log('Received non-payment event:', payload.event);
    
    return new Response(JSON.stringify({ received: true, event: payload.event }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao processar webhook' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
