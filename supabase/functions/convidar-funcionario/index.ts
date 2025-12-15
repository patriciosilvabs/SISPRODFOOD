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
  permissions?: string[];
}

// Send invitation email via Resend with SimChef branded template
async function sendInviteEmail(
  email: string,
  inviterName: string,
  orgName: string,
  acceptUrl: string
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY não configurada" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SimChef <noreply@simchef.app>",
        to: [email],
        subject: `Convite para ${orgName} - SimChef`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🍳 SimChef</h1>
                        <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Sistema de Gestão de Produção</p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 32px;">
                        <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 22px; font-weight: 600;">Você foi convidado!</h2>
                        
                        <p style="margin: 0 0 24px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                          <strong style="color: #18181b;">${inviterName}</strong> convidou você para fazer parte da equipe <strong style="color: #f97316;">${orgName}</strong> no SimChef.
                        </p>
                        
                        <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                          <p style="margin: 0; color: #9a3412; font-size: 14px;">
                            📋 Ao aceitar, você terá acesso ao sistema de gestão de produção da sua organização.
                          </p>
                        </div>
                        
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 24px 0;">
                              <a href="${acceptUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                                ✓ Aceitar Convite
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 24px 0 0 0; color: #a1a1aa; font-size: 13px; text-align: center;">
                          Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                          <a href="${acceptUrl}" style="color: #f97316; word-break: break-all;">${acceptUrl}</a>
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #fafafa; padding: 24px 32px; border-radius: 0 0 12px 12px; border-top: 1px solid #e4e4e7;">
                        <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center;">
                          Este convite expira em 7 dias.<br>
                          Se você não esperava este email, pode ignorá-lo com segurança.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Error sending email via Resend:", errorData);
      return { success: false, error: errorData };
    }

    console.log("Email sent successfully via Resend to:", email);
    return { success: true };
  } catch (error: any) {
    console.error("Error in sendInviteEmail:", error);
    return { success: false, error: error?.message || "Erro desconhecido" };
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
    const { email, roles = [], lojas_ids = [], permissions = [] }: ConviteRequest = await req.json();

    if (!email) {
      throw new Error("Email é obrigatório");
    }

    // Deve ter pelo menos uma role OU pelo menos uma permissão
    if (roles.length === 0 && permissions.length === 0) {
      throw new Error("Pelo menos uma função (role) ou permissão é obrigatória");
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
        // AUTO-CORREÇÃO: Verificar se o usuário ainda é membro da organização
        // Se não for mais membro (foi excluído), deletar convite órfão e permitir reconvite
        const { data: existingProfileCheck } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", normalizedEmail)
          .single();

        let isStillMember = false;
        if (existingProfileCheck) {
          const { data: memberCheck } = await supabase
            .from("organization_members")
            .select("id")
            .eq("organization_id", orgMember.organization_id)
            .eq("user_id", existingProfileCheck.id)
            .single();
          
          isStillMember = !!memberCheck;
        }

        if (isStillMember) {
          throw new Error("Este usuário já pertence à organização");
        } else {
          // Usuário não é mais membro - deletar convite órfão para permitir reconvite
          console.log("Deleting orphan accepted invite (user no longer member):", existingInvite.id);
          await supabase
            .from("convites_pendentes")
            .delete()
            .eq("id", existingInvite.id);
        }
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

    // Check if user already exists in auth
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingAuthUser) {
      // User already exists - send custom email via Resend
      console.log("User already exists in auth, sending custom invite email");
      const emailResult = await sendInviteEmail(normalizedEmail, inviterName, orgName, acceptUrl);
      
      if (!emailResult.success) {
        throw new Error("Erro ao enviar email de convite: " + (emailResult.error || "Erro desconhecido"));
      }
    } else {
      // New user - create user first, then send custom email
      console.log("Creating new user and sending custom invite email:", normalizedEmail);
      
      // Generate a temporary password (user will need to reset it)
      const tempPassword = crypto.randomUUID() + "Aa1!";
      
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email so they can login
        user_metadata: {
          nome: normalizedEmail.split('@')[0],
          invite_token: token,
          organization_id: orgMember.organization_id,
          invited_roles: roles,
          invited_lojas_ids: lojas_ids,
        },
      });

      if (createUserError) {
        console.error("Error creating user:", createUserError);
        throw new Error("Erro ao criar usuário: " + createUserError.message);
      }

      console.log("User created successfully:", newUser.user?.id);
      
      // Send custom invite email via Resend (same template for all users)
      const emailResult = await sendInviteEmail(normalizedEmail, inviterName, orgName, acceptUrl);
      
      if (!emailResult.success) {
        console.error("Failed to send email, but user was created:", emailResult.error);
        // Don't throw here - user was created, just email failed
      }
    }

    // Create invite record in database
    const { data: invite, error: inviteError } = await supabase
      .from("convites_pendentes")
      .insert({
        organization_id: orgMember.organization_id,
        email: normalizedEmail,
        roles,
        lojas_ids,
        permissions, // Salvar permissões granulares
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

    // Registrar log de auditoria
    try {
      await supabase.from('audit_logs').insert([{
        organization_id: orgMember.organization_id,
        user_id: user.id,
        user_email: user.email || '',
        action: 'user.invite',
        entity_type: 'invite',
        entity_id: invite.id,
        details: {
          invited_email: normalizedEmail,
          roles,
          lojas_ids,
          inviter_name: inviterName,
        },
      }]);
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
      // Não falhar a operação principal por causa do log de auditoria
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Convite enviado com sucesso! O funcionário receberá um email para aceitar o convite.",
        invite_id: invite.id,
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
