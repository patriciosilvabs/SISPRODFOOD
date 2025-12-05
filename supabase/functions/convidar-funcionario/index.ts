import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

    // Check if email already has a pending invite
    const { data: existingInvite } = await supabase
      .from("convites_pendentes")
      .select("id, status")
      .eq("organization_id", orgMember.organization_id)
      .eq("email", email.toLowerCase())
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
      .eq("email", email.toLowerCase())
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

    // Create invite
    const { data: invite, error: inviteError } = await supabase
      .from("convites_pendentes")
      .insert({
        organization_id: orgMember.organization_id,
        email: email.toLowerCase(),
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

    // Get organization name
    const orgName = (orgMember.organizations as any)?.nome || "Sistema";

    // Build invite URL
    const siteUrl = req.headers.get("origin") || "https://lovable.dev";
    const inviteUrl = `${siteUrl}/aceitar-convite?token=${token}`;

    // Format roles for display
    const rolesDisplay = roles.join(", ");

    // Send invitation email using Resend API directly
    let emailSent = false;
    try {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${orgName} <onboarding@resend.dev>`,
          to: [email],
          subject: `Você foi convidado para ${orgName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
              <div style="max-width: 560px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px;">Você foi convidado!</h1>
                
                <p style="color: #52525b; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                  <strong>${profile?.nome || "Um administrador"}</strong> convidou você para fazer parte da equipe <strong>${orgName}</strong>.
                </p>
                
                <div style="background-color: #f4f4f5; border-radius: 6px; padding: 16px; margin: 0 0 24px;">
                  <p style="color: #71717a; font-size: 14px; margin: 0 0 4px;">Funções atribuídas:</p>
                  <p style="color: #18181b; font-size: 16px; font-weight: 500; margin: 0;">${rolesDisplay}</p>
                </div>
                
                <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                  Aceitar Convite
                </a>
                
                <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0;">
                  Este convite expira em 7 dias. Se você não solicitou este convite, pode ignorar este email.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
                
                <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
                  Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                  <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
                </p>
              </div>
            </body>
            </html>
          `,
        }),
      });

      if (emailResponse.ok) {
        emailSent = true;
        console.log("Email sent successfully");
      } else {
        const errorData = await emailResponse.json();
        console.error("Error sending email:", errorData);
      }
    } catch (emailError) {
      console.error("Error sending email:", emailError);
    }

    console.log("Invite created successfully:", invite.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Convite enviado com sucesso",
        invite_id: invite.id,
        email_sent: emailSent,
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
