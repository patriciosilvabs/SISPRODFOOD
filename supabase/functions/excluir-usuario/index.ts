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
    // Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Cliente com service_role para operações administrativas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Cliente com token do usuário para verificar permissões
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    // Obter usuário autenticado
    const { data: { user: callerUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !callerUser) {
      console.error('[excluir-usuario] Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter dados do request
    const { userId, organizationId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[excluir-usuario] Iniciando exclusão do usuário ${userId} por ${callerUser.id}`);

    // Impedir auto-exclusão
    if (userId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: 'Você não pode excluir sua própria conta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se quem está excluindo é Admin da organização
    const { data: callerMember, error: callerMemberError } = await supabaseAdmin
      .from('organization_members')
      .select('is_admin')
      .eq('user_id', callerUser.id)
      .eq('organization_id', organizationId)
      .single();

    if (callerMemberError || !callerMember?.is_admin) {
      // Verificar se é SuperAdmin
      const { data: superAdminRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerUser.id)
        .eq('role', 'SuperAdmin')
        .single();

      if (!superAdminRole) {
        console.error('[excluir-usuario] Usuário não é Admin:', callerMemberError);
        return new Response(
          JSON.stringify({ error: 'Apenas administradores podem excluir usuários' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar dados do usuário a ser excluído para audit log
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, nome')
      .eq('id', userId)
      .single();

    const targetEmail = targetProfile?.email || 'email_desconhecido';
    const targetName = targetProfile?.nome || 'Nome desconhecido';

    console.log(`[excluir-usuario] Excluindo usuário: ${targetEmail}`);

    // ============================================
    // EXCLUSÃO EM CASCATA - TODAS AS TABELAS
    // ============================================
    
    const deletionResults: Record<string, { success: boolean; count?: number; error?: string }> = {};

    // 1. audit_logs - Remover logs do usuário (opcional, pode manter para histórico)
    // Comentado para manter histórico de auditoria
    // const { error: auditError, count: auditCount } = await supabaseAdmin
    //   .from('audit_logs')
    //   .delete({ count: 'exact' })
    //   .eq('user_id', userId);
    // deletionResults['audit_logs'] = { success: !auditError, count: auditCount || 0, error: auditError?.message };

    // 2. consumo_historico
    const { error: consumoError, count: consumoCount } = await supabaseAdmin
      .from('consumo_historico')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['consumo_historico'] = { success: !consumoError, count: consumoCount || 0, error: consumoError?.message };

    // 3. contagem_porcionados
    const { error: contagemError, count: contagemCount } = await supabaseAdmin
      .from('contagem_porcionados')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['contagem_porcionados'] = { success: !contagemError, count: contagemCount || 0, error: contagemError?.message };

    // 4. erros_devolucoes
    const { error: errosError, count: errosCount } = await supabaseAdmin
      .from('erros_devolucoes')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['erros_devolucoes'] = { success: !errosError, count: errosCount || 0, error: errosError?.message };

    // 5. estoque_loja_produtos
    const { error: estoqueLojaProdError, count: estoqueLojaProdCount } = await supabaseAdmin
      .from('estoque_loja_produtos')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['estoque_loja_produtos'] = { success: !estoqueLojaProdError, count: estoqueLojaProdCount || 0, error: estoqueLojaProdError?.message };

    // 6. insumos_log
    const { error: insumosLogError, count: insumosLogCount } = await supabaseAdmin
      .from('insumos_log')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['insumos_log'] = { success: !insumosLogError, count: insumosLogCount || 0, error: insumosLogError?.message };

    // 7. lojas_acesso
    const { error: lojasAcessoError, count: lojasAcessoCount } = await supabaseAdmin
      .from('lojas_acesso')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletionResults['lojas_acesso'] = { success: !lojasAcessoError, count: lojasAcessoCount || 0, error: lojasAcessoError?.message };

    // 8. movimentacoes_cpd_produtos
    const { error: movCpdError, count: movCpdCount } = await supabaseAdmin
      .from('movimentacoes_cpd_produtos')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['movimentacoes_cpd_produtos'] = { success: !movCpdError, count: movCpdCount || 0, error: movCpdError?.message };

    // 9. movimentacoes_estoque_log
    const { error: movEstoqueError, count: movEstoqueCount } = await supabaseAdmin
      .from('movimentacoes_estoque_log')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['movimentacoes_estoque_log'] = { success: !movEstoqueError, count: movEstoqueCount || 0, error: movEstoqueError?.message };

    // 10. organization_members
    const { error: orgMemberError, count: orgMemberCount } = await supabaseAdmin
      .from('organization_members')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletionResults['organization_members'] = { success: !orgMemberError, count: orgMemberCount || 0, error: orgMemberError?.message };

    // 11. password_reset_tokens
    const { error: pwdResetError, count: pwdResetCount } = await supabaseAdmin
      .from('password_reset_tokens')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletionResults['password_reset_tokens'] = { success: !pwdResetError, count: pwdResetCount || 0, error: pwdResetError?.message };

    // 12. pedidos_compra
    const { error: pedidosError, count: pedidosCount } = await supabaseAdmin
      .from('pedidos_compra')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['pedidos_compra'] = { success: !pedidosError, count: pedidosCount || 0, error: pedidosError?.message };

    // 13. perdas_producao
    const { error: perdasError, count: perdasCount } = await supabaseAdmin
      .from('perdas_producao')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['perdas_producao'] = { success: !perdasError, count: perdasCount || 0, error: perdasError?.message };

    // 14. producao_lotes
    const { error: prodLotesError, count: prodLotesCount } = await supabaseAdmin
      .from('producao_lotes')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['producao_lotes'] = { success: !prodLotesError, count: prodLotesCount || 0, error: prodLotesError?.message };

    // 15. producao_massa_historico
    const { error: prodMassaError, count: prodMassaCount } = await supabaseAdmin
      .from('producao_massa_historico')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['producao_massa_historico'] = { success: !prodMassaError, count: prodMassaCount || 0, error: prodMassaError?.message };

    // 16. producao_registros
    const { error: prodRegError, count: prodRegCount } = await supabaseAdmin
      .from('producao_registros')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['producao_registros'] = { success: !prodRegError, count: prodRegCount || 0, error: prodRegError?.message };

    // 17. romaneios (usuario_id)
    const { error: romaneiosError, count: romaneiosCount } = await supabaseAdmin
      .from('romaneios')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['romaneios'] = { success: !romaneiosError, count: romaneiosCount || 0, error: romaneiosError?.message };

    // 18. romaneios_produtos
    const { error: romaneioProdError, count: romaneioProdCount } = await supabaseAdmin
      .from('romaneios_produtos')
      .delete({ count: 'exact' })
      .eq('usuario_id', userId);
    deletionResults['romaneios_produtos'] = { success: !romaneioProdError, count: romaneioProdCount || 0, error: romaneioProdError?.message };

    // 19. romaneios_avulsos
    const { error: romaneioAvulsoError, count: romaneioAvulsoCount } = await supabaseAdmin
      .from('romaneios_avulsos')
      .delete({ count: 'exact' })
      .eq('usuario_criacao_id', userId);
    deletionResults['romaneios_avulsos'] = { success: !romaneioAvulsoError, count: romaneioAvulsoCount || 0, error: romaneioAvulsoError?.message };

    // 20. user_page_access
    const { error: userPageError, count: userPageCount } = await supabaseAdmin
      .from('user_page_access')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletionResults['user_page_access'] = { success: !userPageError, count: userPageCount || 0, error: userPageError?.message };

    // 21. user_roles
    const { error: userRolesError, count: userRolesCount } = await supabaseAdmin
      .from('user_roles')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletionResults['user_roles'] = { success: !userRolesError, count: userRolesCount || 0, error: userRolesError?.message };

    // 22. convites_pendentes - por email
    if (targetEmail && targetEmail !== 'email_desconhecido') {
      const { error: convitesError, count: convitesCount } = await supabaseAdmin
        .from('convites_pendentes')
        .delete({ count: 'exact' })
        .eq('email', targetEmail.toLowerCase());
      deletionResults['convites_pendentes'] = { success: !convitesError, count: convitesCount || 0, error: convitesError?.message };
    }

    // 23. profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);
    deletionResults['profiles'] = { success: !profileError, error: profileError?.message };

    // 24. ÚLTIMO: auth.users
    console.log(`[excluir-usuario] Excluindo de auth.users: ${userId}`);
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    deletionResults['auth.users'] = { success: !authDeleteError, error: authDeleteError?.message };

    if (authDeleteError) {
      console.error('[excluir-usuario] Erro ao excluir de auth.users:', authDeleteError);
    }

    // Registrar no audit log (usando o admin)
    await supabaseAdmin.from('audit_logs').insert({
      user_id: callerUser.id,
      user_email: callerUser.email || '',
      action: 'user.delete.complete',
      entity_type: 'user',
      entity_id: userId,
      organization_id: organizationId,
      details: {
        target_email: targetEmail,
        target_name: targetName,
        deletion_results: deletionResults,
        deleted_by: callerUser.email
      }
    });

    // Verificar se houve erros críticos
    const criticalErrors = Object.entries(deletionResults)
      .filter(([key, result]) => !result.success && ['profiles', 'auth.users', 'organization_members'].includes(key));

    if (criticalErrors.length > 0) {
      console.error('[excluir-usuario] Erros críticos na exclusão:', criticalErrors);
      return new Response(
        JSON.stringify({ 
          error: 'Erros ao excluir usuário de tabelas críticas',
          details: criticalErrors
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[excluir-usuario] Usuário ${targetEmail} excluído completamente`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Usuário ${targetEmail} excluído permanentemente do sistema`,
        deletionResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[excluir-usuario] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao excluir usuário';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
