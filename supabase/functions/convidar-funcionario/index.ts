import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConviteRequest {
  email: string;
  roles: string[];
  lojas_ids?: string[];
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

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(nome)")
      .eq("user_id", user.id)
      .single();

    if (orgError || !orgMember) {
      throw new Error("Usuário não pertence a nenhuma organização");
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "Admin",
    });

    if (!isAdmin) {
      throw new Error("Apenas administradores podem convidar funcionários");
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .single();

    // Parse request body
    const { email, roles, lojas_ids = [] }: ConviteRequest = await req.json();

    if (!email || !roles || roles.length === 0) {
      throw new Error("Email e pelo menos uma função são obrigatórios");
    }

    const normalizedEmail = email.toLowerCase();

    // Check if email already has a pending invite
    const { data: existingInvite } = await supabase
      .from("convites_pendentes")
      .select("id, status")
      .eq("organization_id", orgMember.organization_id)
      .eq("email", normalizedEmail)
      .single();

    if (existingInvite) {
      if (existingInvite.status === "pendente") {
        throw new Error("Já existe um convite pendente para este email");
      }
      if (existingInvite.status === "aceito") {
        throw new Error("Este email já aceitou um convite para esta organização");
      }
    }

    // Check if user already belongs to organization
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingProfile) {
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgMember.organization_id)
        .eq("user_id", existingProfile.id)
        .single();

      if (existingMember) {
        throw new Error("Este usuário já pertence à organização");
      }
    }

    // Generate invite token
    const token = crypto.randomUUID();
    
    // Get organization name
    const orgName = (orgMember.organizations as any)?.nome || "Sistema";

    // Build redirect URL for after password setup
    const siteUrl = req.headers.get("origin") || "https://lovable.dev";
    const redirectUrl = `${siteUrl}/aceitar-convite?token=${token}`;

    // Use inviteUserByEmail to pre-create user and send password setup email
    console.log("Inviting user by email:", normalizedEmail);
    
    const { data: inviteData, error: inviteAuthError } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: {
        nome: normalizedEmail.split('@')[0], // Nome temporário baseado no email
        invite_token: token,
        organization_id: orgMember.organization_id,
        invited_roles: roles,
        invited_lojas_ids: lojas_ids,
      },
      redirectTo: redirectUrl,
    });

    if (inviteAuthError) {
      console.error("Error inviting user:", inviteAuthError);
      // Se o usuário já existe no Auth, tentamos outra abordagem
      if (inviteAuthError.message.includes("already been registered")) {
        console.log("User already exists in auth, will use existing flow");
        // Continua para criar o convite no banco - o usuário existente fará login normalmente
      } else {
        throw new Error("Erro ao convidar usuário: " + inviteAuthError.message);
      }
    } else {
      console.log("User invited successfully, auth user id:", inviteData?.user?.id);
    }

    // Create invite record in database
    const { data: invite, error: inviteError } = await supabase
      .from("convites_pendentes")
      .insert({
        organization_id: orgMember.organization_id,
        email: normalizedEmail,
        roles,
        lojas_ids,
        convidado_por_id: user.id,
        convidado_por_nome: profile?.nome || user.email,
        token,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      throw new Error("Erro ao criar convite: " + inviteError.message);
    }

    console.log("Invite created successfully:", invite.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Convite enviado com sucesso! O funcionário receberá um email para definir sua senha.",
        invite_id: invite.id,
        email_sent: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in convidar-funcionario:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
