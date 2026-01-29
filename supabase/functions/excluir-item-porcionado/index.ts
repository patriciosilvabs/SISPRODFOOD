import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user: callerUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !callerUser) {
      console.error('[excluir-item-porcionado] Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { item_id } = await req.json();
    
    if (!item_id) {
      return new Response(
        JSON.stringify({ error: 'item_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[excluir-item-porcionado] Iniciando exclusão do item ${item_id} por ${callerUser.id}`);

    // Buscar organization_id do item
    const { data: item, error: itemError } = await supabaseAdmin
      .from('itens_porcionados')
      .select('id, nome, organization_id')
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      console.error('[excluir-item-porcionado] Item não encontrado:', itemError);
      return new Response(
        JSON.stringify({ error: 'Item não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = item.organization_id;

    // Verificar se é Admin ou SuperAdmin
    const { data: callerMember } = await supabaseAdmin
      .from('organization_members')
      .select('is_admin')
      .eq('user_id', callerUser.id)
      .eq('organization_id', organizationId)
      .single();

    if (!callerMember?.is_admin) {
      const { data: superAdminRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerUser.id)
        .eq('role', 'SuperAdmin')
        .single();

      if (!superAdminRole) {
        console.error('[excluir-item-porcionado] Usuário não é Admin');
        return new Response(
          JSON.stringify({ error: 'Apenas administradores podem excluir itens' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[excluir-item-porcionado] Excluindo item: ${item.nome}`);

    const deletionResults: Record<string, { success: boolean; count?: number; error?: string }> = {};

    // 1. contagem_porcionados_audit
    const { error: auditError, count: auditCount } = await supabaseAdmin
      .from('contagem_porcionados_audit')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['contagem_porcionados_audit'] = { success: !auditError, count: auditCount || 0, error: auditError?.message };

    // 2. perdas_producao
    const { error: perdasError, count: perdasCount } = await supabaseAdmin
      .from('perdas_producao')
      .delete({ count: 'exact' })
      .eq('item_id', item_id);
    deletionResults['perdas_producao'] = { success: !perdasError, count: perdasCount || 0, error: perdasError?.message };

    // 3. consumo_historico
    const { error: consumoError, count: consumoCount } = await supabaseAdmin
      .from('consumo_historico')
      .delete({ count: 'exact' })
      .eq('item_id', item_id);
    deletionResults['consumo_historico'] = { success: !consumoError, count: consumoCount || 0, error: consumoError?.message };

    // 4. producao_massa_historico
    const { error: massaHistError, count: massaHistCount } = await supabaseAdmin
      .from('producao_massa_historico')
      .delete({ count: 'exact' })
      .eq('item_id', item_id);
    deletionResults['producao_massa_historico'] = { success: !massaHistError, count: massaHistCount || 0, error: massaHistError?.message };

    // 5. romaneio_itens
    const { error: romaneioItensError, count: romaneioItensCount } = await supabaseAdmin
      .from('romaneio_itens')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['romaneio_itens'] = { success: !romaneioItensError, count: romaneioItensCount || 0, error: romaneioItensError?.message };

    // 6. romaneios_avulsos_itens
    const { error: romAvulsosError, count: romAvulsosCount } = await supabaseAdmin
      .from('romaneios_avulsos_itens')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['romaneios_avulsos_itens'] = { success: !romAvulsosError, count: romAvulsosCount || 0, error: romAvulsosError?.message };

    // 7. producao_registros
    const { error: prodRegError, count: prodRegCount } = await supabaseAdmin
      .from('producao_registros')
      .delete({ count: 'exact' })
      .eq('item_id', item_id);
    deletionResults['producao_registros'] = { success: !prodRegError, count: prodRegCount || 0, error: prodRegError?.message };

    // 8. producao_lotes
    const { error: prodLotesError, count: prodLotesCount } = await supabaseAdmin
      .from('producao_lotes')
      .delete({ count: 'exact' })
      .eq('item_id', item_id);
    deletionResults['producao_lotes'] = { success: !prodLotesError, count: prodLotesCount || 0, error: prodLotesError?.message };

    // 9. incrementos_producao
    const { error: incError, count: incCount } = await supabaseAdmin
      .from('incrementos_producao')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['incrementos_producao'] = { success: !incError, count: incCount || 0, error: incError?.message };

    // 10. backlog_producao
    const { error: backlogError, count: backlogCount } = await supabaseAdmin
      .from('backlog_producao')
      .delete({ count: 'exact' })
      .eq('item_id', item_id);
    deletionResults['backlog_producao'] = { success: !backlogError, count: backlogCount || 0, error: backlogError?.message };

    // 11. contagem_porcionados
    const { error: contagemError, count: contagemCount } = await supabaseAdmin
      .from('contagem_porcionados')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['contagem_porcionados'] = { success: !contagemError, count: contagemCount || 0, error: contagemError?.message };

    // 12. estoque_loja_itens
    const { error: estoqueLojaError, count: estoqueLojaCount } = await supabaseAdmin
      .from('estoque_loja_itens')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['estoque_loja_itens'] = { success: !estoqueLojaError, count: estoqueLojaCount || 0, error: estoqueLojaError?.message };

    // 13. estoques_ideais_semanais
    const { error: ideaisError, count: ideaisCount } = await supabaseAdmin
      .from('estoques_ideais_semanais')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['estoques_ideais_semanais'] = { success: !ideaisError, count: ideaisCount || 0, error: ideaisError?.message };

    // 14. itens_reserva_diaria
    const { error: reservaError, count: reservaCount } = await supabaseAdmin
      .from('itens_reserva_diaria')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['itens_reserva_diaria'] = { success: !reservaError, count: reservaCount || 0, error: reservaError?.message };

    // 15. estoque_cpd
    const { error: estoqueCpdError, count: estoqueCpdCount } = await supabaseAdmin
      .from('estoque_cpd')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['estoque_cpd'] = { success: !estoqueCpdError, count: estoqueCpdCount || 0, error: estoqueCpdError?.message };

    // 16. insumos_extras
    const { error: insumosError, count: insumosCount } = await supabaseAdmin
      .from('insumos_extras')
      .delete({ count: 'exact' })
      .eq('item_porcionado_id', item_id);
    deletionResults['insumos_extras'] = { success: !insumosError, count: insumosCount || 0, error: insumosError?.message };

    // 17. ÚLTIMO: itens_porcionados
    const { error: itemDeleteError } = await supabaseAdmin
      .from('itens_porcionados')
      .delete()
      .eq('id', item_id);
    deletionResults['itens_porcionados'] = { success: !itemDeleteError, error: itemDeleteError?.message };

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: callerUser.id,
      user_email: callerUser.email || '',
      action: 'item_porcionado.delete.complete',
      entity_type: 'item_porcionado',
      entity_id: item_id,
      organization_id: organizationId,
      details: {
        item_nome: item.nome,
        deletion_results: deletionResults,
        deleted_by: callerUser.email
      }
    });

    // Verificar erros críticos
    if (!deletionResults['itens_porcionados'].success) {
      console.error('[excluir-item-porcionado] Erro ao excluir item principal:', deletionResults['itens_porcionados'].error);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao excluir item principal',
          details: deletionResults
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[excluir-item-porcionado] Item ${item.nome} excluído completamente`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Item "${item.nome}" excluído permanentemente do sistema`,
        deletionResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[excluir-item-porcionado] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao excluir item';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
