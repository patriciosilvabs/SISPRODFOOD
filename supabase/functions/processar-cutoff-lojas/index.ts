import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[processar-cutoff-lojas] Iniciando verificação de cutoffs...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Chamar a função SQL que verifica e congela cutoffs
    const { data, error } = await supabase.rpc('verificar_e_congelar_cutoffs');
    
    if (error) {
      console.error('[processar-cutoff-lojas] Erro ao executar verificação:', error);
      
      // Registrar erro no log
      await supabase.from('cron_execucao_log').insert({
        funcao: 'processar-cutoff-lojas',
        erro: error.message,
        resultado: { error: true, message: error.message }
      });
      
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('[processar-cutoff-lojas] Resultado:', JSON.stringify(data));
    
    // Registrar sucesso no log geral (sem org específica)
    if (data?.organizacoes_processadas === 0) {
      console.log('[processar-cutoff-lojas] Nenhuma organização no horário de cutoff');
    } else {
      console.log(`[processar-cutoff-lojas] ${data?.organizacoes_processadas} organização(ões) processada(s)`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[processar-cutoff-lojas] Erro não tratado:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
