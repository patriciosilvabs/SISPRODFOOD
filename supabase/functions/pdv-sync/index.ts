import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PDVDemandItem {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  current_stock: number;
  target_stock: number;
  to_produce: number;
  status: 'critical' | 'low' | 'needed' | 'ok';
}

interface PDVIngredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
}

interface PDVTarget {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  daily_targets: {
    sunday: number;
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
        JSON.stringify({ error: 'PDV integration not configured', message: 'Configure a integração com o PDV nas configurações' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integrationConfig.ativo) {
      return new Response(
        JSON.stringify({ error: 'PDV integration disabled', message: 'A integração com o PDV está desativada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'demand';

    if (!['demand', 'ingredients', 'targets'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action', message: 'Ações válidas: demand, ingredients, targets' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    let pdvResponse: Response | null = null;
    let pdvData: any = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      // Make request to external PDV API
      const pdvUrl = `${integrationConfig.api_url}/production-api?action=${action}`;
      
      console.log(`Fetching PDV API: ${pdvUrl}`);
      
      pdvResponse = await fetch(pdvUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': integrationConfig.api_key,
          'Content-Type': 'application/json',
        },
      });

      pdvData = await pdvResponse.json();
      success = pdvResponse.ok;
      
      if (!pdvResponse.ok) {
        errorMessage = pdvData.error || `HTTP ${pdvResponse.status}`;
      }
    } catch (fetchError: any) {
      console.error('Error fetching PDV API:', fetchError);
      errorMessage = fetchError.message || 'Network error';
      pdvData = { error: errorMessage };
    }

    const duration = Date.now() - startTime;

    // Log the request
    await supabase.from('integracoes_pdv_log').insert({
      organization_id: organizationId,
      direcao: 'pull',
      endpoint: `/production-api?action=${action}`,
      metodo: 'GET',
      payload: null,
      resposta: pdvData,
      status_code: pdvResponse?.status || 0,
      sucesso: success,
      erro: errorMessage,
      duracao_ms: duration,
    });

    // Update last sync time if successful
    if (success) {
      await supabase
        .from('integracoes_pdv')
        .update({ ultima_sincronizacao: new Date().toISOString() })
        .eq('id', integrationConfig.id);
    }

    if (!success) {
      return new Response(
        JSON.stringify({ 
          error: 'PDV API error', 
          message: errorMessage,
          details: pdvData 
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        data: pdvData,
        synced_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in pdv-sync:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
