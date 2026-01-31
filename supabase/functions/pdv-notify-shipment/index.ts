import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShipmentItem {
  ingredient_id?: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
}

interface ShipmentPayload {
  romaneio_id: string;
  external_id: string;
  items: ShipmentItem[];
  notes?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = membership.organization_id;

    // Get PDV integration configuration
    const { data: integrationConfig, error: configError } = await supabase
      .from('integracoes_pdv')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (configError || !integrationConfig) {
      return new Response(
        JSON.stringify({ 
          error: 'PDV integration not configured', 
          message: 'Configure a integração com o PDV nas configurações',
          skipped: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integrationConfig.ativo || !integrationConfig.notificar_romaneio) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Notificação de romaneio desabilitada',
          skipped: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let payload: ShipmentPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.external_id || !payload.items || payload.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload', message: 'external_id e items são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    let pdvResponse: Response | null = null;
    let pdvData: any;
    let success = false;
    let errorMessage: string | null = null;

    // Build webhook payload for PDV
    const webhookPayload = {
      event: 'SHIPMENT_CREATED',
      shipment: {
        external_id: payload.external_id,
        items: payload.items.map(item => ({
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          quantity: item.quantity,
          unit: item.unit,
        })),
        shipped_at: new Date().toISOString(),
        notes: payload.notes || null,
      },
    };

    try {
      // Make request to external PDV webhook
      const pdvUrl = `${integrationConfig.api_url}/production-webhook`;
      
      console.log(`Posting to PDV webhook: ${pdvUrl}`);
      console.log('Payload:', JSON.stringify(webhookPayload));
      
      pdvResponse = await fetch(pdvUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': integrationConfig.api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      pdvData = await pdvResponse.json();
      success = pdvResponse.ok;
      
      if (!pdvResponse.ok) {
        errorMessage = pdvData.error || `HTTP ${pdvResponse.status}`;
      }
    } catch (fetchError: any) {
      console.error('Error posting to PDV webhook:', fetchError);
      errorMessage = fetchError.message || 'Network error';
      pdvData = { error: errorMessage };
    }

    const duration = Date.now() - startTime;

    // Log the request
    await supabase.from('integracoes_pdv_log').insert({
      organization_id: organizationId,
      direcao: 'push',
      endpoint: '/production-webhook',
      metodo: 'POST',
      payload: webhookPayload,
      resposta: pdvData,
      status_code: pdvResponse?.status || 0,
      sucesso: success,
      erro: errorMessage,
      duracao_ms: duration,
    });

    if (!success) {
      // Don't fail the whole operation, just report the error
      console.error('PDV webhook failed:', errorMessage);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PDV notification failed',
          message: errorMessage,
          details: pdvData,
          romaneio_id: payload.romaneio_id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PDV notificado com sucesso',
        external_id: payload.external_id,
        romaneio_id: payload.romaneio_id,
        pdv_response: pdvData,
        notified_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in pdv-notify-shipment:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
