import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AceitarConviteRequest {
  token: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Usuário não autenticado");
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { token }: AceitarConviteRequest = await req.json();

    if (!token) {
      throw new Error("Token de convite não fornecido");
    }

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from("convites_pendentes")
      .select("*, organizations(nome)")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      throw new Error("Convite não encontrado");
    }

    // Check if invite is still valid
    if (invite.status !== "pendente") {
      throw new Error(`Este convite já foi ${invite.status === "aceito" ? "aceito" : "cancelado ou expirou"}`);
    }

    // Check if invite has expired
    if (new Date(invite.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from("convites_pendentes")
        .update({ status: "expirado" })
        .eq("id", invite.id);
      throw new Error("Este convite expirou");
    }

    // Check if user email matches invite email
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error(`Este convite foi enviado para ${invite.email}. Faça login com esse email para aceitar.`);
    }

    // Check if user already belongs to an organization
    const { data: existingMember } = await supabase
      .from("organization_members")
      .select("id, organization_id")
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      if (existingMember.organization_id === invite.organization_id) {
        // Already in this organization, just update invite status
        await supabase
          .from("convites_pendentes")
          .update({ status: "aceito", accepted_at: new Date().toISOString() })
          .eq("id", invite.id);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Você já faz parte desta organização",
            already_member: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      } else {
        throw new Error("Você já pertence a outra organização. Não é possível aceitar este convite.");
      }
    }

    // Start transaction-like operations
    console.log("Processing invite for user:", user.id);

    // 1. Add user to organization
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: invite.roles[0] || "Loja", // Default role for organization_members
      });

    if (memberError) {
      console.error("Error adding to organization:", memberError);
      throw new Error("Erro ao adicionar usuário à organização");
    }

    // 2. Add user roles
    const roleInserts = invite.roles.map((role: string) => ({
      user_id: user.id,
      role: role,
    }));

    const { error: rolesError } = await supabase
      .from("user_roles")
      .insert(roleInserts);

    if (rolesError) {
      console.error("Error adding roles:", rolesError);
      // Rollback organization membership
      await supabase
        .from("organization_members")
        .delete()
        .eq("user_id", user.id);
      throw new Error("Erro ao atribuir funções ao usuário");
    }

    // 3. Add store access if any
    if (invite.lojas_ids && invite.lojas_ids.length > 0) {
      const lojaInserts = invite.lojas_ids.map((lojaId: string) => ({
        user_id: user.id,
        loja_id: lojaId,
        organization_id: invite.organization_id,
      }));

      const { error: lojasError } = await supabase
        .from("lojas_acesso")
        .insert(lojaInserts);

      if (lojasError) {
        console.error("Error adding store access:", lojasError);
        // Continue anyway, stores can be added later
      }
    }

    // 4. Update invite status
    const { error: updateError } = await supabase
      .from("convites_pendentes")
      .update({ 
        status: "aceito", 
        accepted_at: new Date().toISOString() 
      })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Error updating invite status:", updateError);
    }

    console.log("Invite accepted successfully for user:", user.id);

    const orgName = (invite.organizations as any)?.nome || "organização";

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bem-vindo à ${orgName}!`,
        organization_id: invite.organization_id,
        roles: invite.roles,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in aceitar-convite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
