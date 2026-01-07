import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify SuperAdmin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "SuperAdmin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas SuperAdmin pode excluir organizações." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get organization ID from request
    const { organizationId } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "ID da organização é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting cascade deletion for organization: ${organizationId}`);

    // Get users that belong ONLY to this organization (will be deleted)
    const { data: orgMembers } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId);

    const userIdsInOrg = orgMembers?.map(m => m.user_id) || [];
    
    // Find users that are ONLY in this organization
    const usersToDelete: string[] = [];
    for (const userId of userIdsInOrg) {
      const { data: otherOrgs } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .neq("organization_id", organizationId);
      
      if (!otherOrgs || otherOrgs.length === 0) {
        usersToDelete.push(userId);
      }
    }

    console.log(`Users to delete (only in this org): ${usersToDelete.length}`);

    // Delete in order respecting foreign keys
    // Tables with dependencies on other tables should be deleted first

    // 1. romaneio_itens (depends on romaneios)
    const { error: e1 } = await supabase
      .from("romaneio_itens")
      .delete()
      .eq("organization_id", organizationId);
    if (e1) console.log("Error deleting romaneio_itens:", e1.message);

    // 2. romaneios
    const { error: e2 } = await supabase
      .from("romaneios")
      .delete()
      .eq("organization_id", organizationId);
    if (e2) console.log("Error deleting romaneios:", e2.message);

    // 3. pedidos_compra_itens (depends on pedidos_compra)
    const { error: e3 } = await supabase
      .from("pedidos_compra_itens")
      .delete()
      .eq("organization_id", organizationId);
    if (e3) console.log("Error deleting pedidos_compra_itens:", e3.message);

    // 4. pedidos_compra
    const { error: e4 } = await supabase
      .from("pedidos_compra")
      .delete()
      .eq("organization_id", organizationId);
    if (e4) console.log("Error deleting pedidos_compra:", e4.message);

    // 5. perdas_producao (depends on producao_registros)
    const { error: e5 } = await supabase
      .from("perdas_producao")
      .delete()
      .eq("organization_id", organizationId);
    if (e5) console.log("Error deleting perdas_producao:", e5.message);

    // 6. consumo_historico (depends on producao_registros)
    const { error: e6 } = await supabase
      .from("consumo_historico")
      .delete()
      .eq("organization_id", organizationId);
    if (e6) console.log("Error deleting consumo_historico:", e6.message);

    // 7. producao_massa_historico (depends on producao_registros)
    const { error: e7 } = await supabase
      .from("producao_massa_historico")
      .delete()
      .eq("organization_id", organizationId);
    if (e7) console.log("Error deleting producao_massa_historico:", e7.message);

    // 8. producao_registros (depends on producao_lotes and itens_porcionados)
    const { error: e8 } = await supabase
      .from("producao_registros")
      .delete()
      .eq("organization_id", organizationId);
    if (e8) console.log("Error deleting producao_registros:", e8.message);

    // 9. producao_lotes
    const { error: e9 } = await supabase
      .from("producao_lotes")
      .delete()
      .eq("organization_id", organizationId);
    if (e9) console.log("Error deleting producao_lotes:", e9.message);

    // 10. contagem_porcionados
    const { error: e10 } = await supabase
      .from("contagem_porcionados")
      .delete()
      .eq("organization_id", organizationId);
    if (e10) console.log("Error deleting contagem_porcionados:", e10.message);

    // 11. estoques_ideais_semanais
    const { error: e11 } = await supabase
      .from("estoques_ideais_semanais")
      .delete()
      .eq("organization_id", organizationId);
    if (e11) console.log("Error deleting estoques_ideais_semanais:", e11.message);

    // 12. estoque_loja_itens
    const { error: e12 } = await supabase
      .from("estoque_loja_itens")
      .delete()
      .eq("organization_id", organizationId);
    if (e12) console.log("Error deleting estoque_loja_itens:", e12.message);

    // 13. estoque_loja_produtos
    const { error: e13 } = await supabase
      .from("estoque_loja_produtos")
      .delete()
      .eq("organization_id", organizationId);
    if (e13) console.log("Error deleting estoque_loja_produtos:", e13.message);

    // 14. produtos_estoque_minimo_semanal
    const { error: e14 } = await supabase
      .from("produtos_estoque_minimo_semanal")
      .delete()
      .eq("organization_id", organizationId);
    if (e14) console.log("Error deleting produtos_estoque_minimo_semanal:", e14.message);

    // 15. estoque_cpd
    const { error: e15 } = await supabase
      .from("estoque_cpd")
      .delete()
      .eq("organization_id", organizationId);
    if (e15) console.log("Error deleting estoque_cpd:", e15.message);

    // 16. estoque_cpd_produtos
    const { error: e16 } = await supabase
      .from("estoque_cpd_produtos")
      .delete()
      .eq("organization_id", organizationId);
    if (e16) console.log("Error deleting estoque_cpd_produtos:", e16.message);

    // 17. movimentacoes_cpd_produtos
    const { error: e17 } = await supabase
      .from("movimentacoes_cpd_produtos")
      .delete()
      .eq("organization_id", organizationId);
    if (e17) console.log("Error deleting movimentacoes_cpd_produtos:", e17.message);

    // 18. movimentacoes_estoque_log
    const { error: e18 } = await supabase
      .from("movimentacoes_estoque_log")
      .delete()
      .eq("organization_id", organizationId);
    if (e18) console.log("Error deleting movimentacoes_estoque_log:", e18.message);

    // 19. insumos_extras (depends on insumos and itens_porcionados)
    const { error: e19 } = await supabase
      .from("insumos_extras")
      .delete()
      .eq("organization_id", organizationId);
    if (e19) console.log("Error deleting insumos_extras:", e19.message);

    // 20. itens_reserva_diaria (depends on itens_porcionados)
    const { error: e20 } = await supabase
      .from("itens_reserva_diaria")
      .delete()
      .eq("organization_id", organizationId);
    if (e20) console.log("Error deleting itens_reserva_diaria:", e20.message);

    // 21. itens_porcionados (after all dependencies)
    const { error: e21 } = await supabase
      .from("itens_porcionados")
      .delete()
      .eq("organization_id", organizationId);
    if (e21) console.log("Error deleting itens_porcionados:", e21.message);

    // 22. insumos_log
    const { error: e22 } = await supabase
      .from("insumos_log")
      .delete()
      .eq("organization_id", organizationId);
    if (e22) console.log("Error deleting insumos_log:", e22.message);

    // 23. insumos_estoque_minimo_semanal
    const { error: e23 } = await supabase
      .from("insumos_estoque_minimo_semanal")
      .delete()
      .eq("organization_id", organizationId);
    if (e23) console.log("Error deleting insumos_estoque_minimo_semanal:", e23.message);

    // 24. insumos
    const { error: e24 } = await supabase
      .from("insumos")
      .delete()
      .eq("organization_id", organizationId);
    if (e24) console.log("Error deleting insumos:", e24.message);

    // 25. produtos
    const { error: e25 } = await supabase
      .from("produtos")
      .delete()
      .eq("organization_id", organizationId);
    if (e25) console.log("Error deleting produtos:", e25.message);

    // 26. lojas_acesso (depends on lojas)
    const { error: e26 } = await supabase
      .from("lojas_acesso")
      .delete()
      .eq("organization_id", organizationId);
    if (e26) console.log("Error deleting lojas_acesso:", e26.message);

    // 27. erros_devolucoes (depends on lojas)
    const { error: e27 } = await supabase
      .from("erros_devolucoes")
      .delete()
      .eq("organization_id", organizationId);
    if (e27) console.log("Error deleting erros_devolucoes:", e27.message);

    // 28. lojas
    const { error: e28 } = await supabase
      .from("lojas")
      .delete()
      .eq("organization_id", organizationId);
    if (e28) console.log("Error deleting lojas:", e28.message);

    // 29. alertas_estoque
    const { error: e29 } = await supabase
      .from("alertas_estoque")
      .delete()
      .eq("organization_id", organizationId);
    if (e29) console.log("Error deleting alertas_estoque:", e29.message);

    // 30. configuracao_alertas
    const { error: e30 } = await supabase
      .from("configuracao_alertas")
      .delete()
      .eq("organization_id", organizationId);
    if (e30) console.log("Error deleting configuracao_alertas:", e30.message);

    // 31. configuracoes_sistema
    const { error: e31 } = await supabase
      .from("configuracoes_sistema")
      .delete()
      .eq("organization_id", organizationId);
    if (e31) console.log("Error deleting configuracoes_sistema:", e31.message);

    // 32. convites_pendentes
    const { error: e32 } = await supabase
      .from("convites_pendentes")
      .delete()
      .eq("organization_id", organizationId);
    if (e32) console.log("Error deleting convites_pendentes:", e32.message);

    // 33. audit_logs
    const { error: e33 } = await supabase
      .from("audit_logs")
      .delete()
      .eq("organization_id", organizationId);
    if (e33) console.log("Error deleting audit_logs:", e33.message);

    // 34. permission_presets
    const { error: e34 } = await supabase
      .from("permission_presets")
      .delete()
      .eq("organization_id", organizationId);
    if (e34) console.log("Error deleting permission_presets:", e34.message);

    // 35. user_page_access
    const { error: e35 } = await supabase
      .from("user_page_access")
      .delete()
      .eq("organization_id", organizationId);
    if (e35) console.log("Error deleting user_page_access:", e35.message);

    // 36. user_permissions
    const { error: e36 } = await supabase
      .from("user_permissions")
      .delete()
      .eq("organization_id", organizationId);
    if (e36) console.log("Error deleting user_permissions:", e36.message);

    // 37. organization_members
    const { error: e37 } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", organizationId);
    if (e37) console.log("Error deleting organization_members:", e37.message);

    // 38. Finally delete the organization
    const { error: orgError } = await supabase
      .from("organizations")
      .delete()
      .eq("id", organizationId);

    if (orgError) {
      console.error("Error deleting organization:", orgError);
      return new Response(
        JSON.stringify({ error: `Erro ao excluir organização: ${orgError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete users that belonged only to this organization
    for (const userId of usersToDelete) {
      // Delete profile first
      await supabase.from("profiles").delete().eq("id", userId);
      
      // Delete user_roles
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      // Delete from auth.users
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
      if (authDeleteError) {
        console.log(`Error deleting auth user ${userId}:`, authDeleteError.message);
      }
    }

    console.log(`Successfully deleted organization ${organizationId} and ${usersToDelete.length} users`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Organização excluída com sucesso",
        deletedUsers: usersToDelete.length 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("Error in excluir-organizacao:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
