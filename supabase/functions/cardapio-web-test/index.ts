import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Cardápio Web Test Connection ===');
  console.log('Method:', req.method);

  try {
    // Get API key from header
    const apiKey = req.headers.get('X-API-KEY') || req.headers.get('x-api-key');

    if (!apiKey) {
      console.log('Token não fornecido no header X-API-KEY');
      return new Response(
        JSON.stringify({ success: false, error: 'Token não fornecido' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Token recebido:', apiKey.substring(0, 8) + '...');

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token in database
    const { data: integracao, error: queryError } = await supabase
      .from('integracoes_cardapio_web')
      .select('id, loja_id, ambiente, ativo')
      .eq('token', apiKey)
      .single();

    if (queryError || !integracao) {
      console.log('Token inválido - não encontrado no banco');
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get store name
    const { data: loja } = await supabase
      .from('lojas')
      .select('nome')
      .eq('id', integracao.loja_id)
      .single();

    console.log('Integração encontrada:', integracao.id, '- Loja:', loja?.nome);

    if (!integracao.ativo) {
      console.log('Integração está inativa');
      return new Response(
        JSON.stringify({ success: false, error: 'Integração inativa' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Conexão validada com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conexão validada com sucesso!',
        ambiente: integracao.ambiente,
        loja: loja?.nome || null
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
