import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConviteRequest {
  email: string;
  roles: string[];
  lojas_ids?: string[];
}

// Send invitation email via Resend
async function sendInviteEmail(
  resend: any,
  email: string,
  inviterName: string,
  orgName: string,
  acceptUrl: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: "SimChef <noreply@simchef.app>",
      to: [email],
      subject: `Você foi convidado para ${orgName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SimChef</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; margin-top: 0;">Você foi convidado!</h2>
            <p style="color: #4b5563; font-size: 16px;">
              <strong>${inviterName}</strong> convidou você para fazer parte da organização <strong>${orgName}</strong> no SimChef.
            </p>
            <p style="color: #4b5563; font-size: 16px;">
              Clique no botão abaixo para aceitar o convite e acessar o sistema:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Aceitar Convite
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Ou copie e cole este link no seu navegador:<br>
              <a href="${acceptUrl}" style="color: #3b82f6; word-break: break-all;">${acceptUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Este convite expira em 7 dias. Se você não solicitou este convite, pode ignorar este email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending email via Resend:", error);
      return false;
    }
    
    console.log("Email sent successfully via Resend to:", email);
    return true;
  } catch (error) {
    console.error("Error in sendInviteEmail:", error);
    return false;
  }
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Serviço de email não configurado");
    }
    
    const resend = new Resend(resendApiKey);
    
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
      // Se o convite foi cancelado, deletar para permitir novo convite
      if (existingInvite.status === "cancelado") {
        console.log("Deleting cancelled invite to allow resend:", existingInvite.id);
        await supabase
          .from("convites_pendentes")
          .delete()
          .eq("id", existingInvite.id);
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
    const inviterName = profile?.nome || user.email || "Um administrador";

    // Build redirect URL for accepting invite
    const siteUrl = req.headers.get("origin") || "https://simchef.app";
    const acceptUrl = `${siteUrl}/aceitar-convite?token=${token}`;

    let emailSent = false;

    // Check if user already exists in auth
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingAuthUser) {
      // User already exists - send custom email via Resend
      console.log("User already exists in auth, sending custom invite email");
      emailSent = await sendInviteEmail(resend, normalizedEmail, inviterName, orgName, acceptUrl);
    } else {
      // New user - try inviteUserByEmail first
      console.log("Inviting new user by email:", normalizedEmail);
      
      const { data: inviteData, error: inviteAuthError } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: {
          nome: normalizedEmail.split('@')[0],
          invite_token: token,
          organization_id: orgMember.organization_id,
          invited_roles: roles,
          invited_lojas_ids: lojas_ids,
        },
        redirectTo: acceptUrl,
      });

      if (inviteAuthError) {
        console.error("Error with inviteUserByEmail:", inviteAuthError);
        // Fallback to Resend if inviteUserByEmail fails
        emailSent = await sendInviteEmail(resend, normalizedEmail, inviterName, orgName, acceptUrl);
      } else {
        console.log("User invited successfully via Supabase Auth");
        emailSent = true;
      }
    }

    if (!emailSent) {
      throw new Error("Erro ao enviar email de convite. Verifique se o email está correto.");
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
        convidado_por_nome: inviterName,
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
        message: "Convite enviado com sucesso! O funcionário receberá um email para aceitar o convite.",
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