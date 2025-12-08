import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCTION_URL = "https://dc0b8f1a-0f27-4079-a37f-ebfc55c7280c.lovableproject.com";

interface RecoveryEmailRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: RecoveryEmailRequest = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Processando recuperação de senha para:", email);

    // Criar cliente Supabase com service_role para acessar auth.users
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Buscar usuário pelo email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("Erro ao buscar usuários:", userError);
      // Não revelar se o email existe ou não por segurança
      return new Response(
        JSON.stringify({ success: true, message: "Se o email existir, você receberá um link de recuperação." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      console.log("Usuário não encontrado para email:", email);
      // Não revelar se o email existe ou não por segurança
      return new Response(
        JSON.stringify({ success: true, message: "Se o email existir, você receberá um link de recuperação." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Gerar token único
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Salvar token na tabela
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        email: email.toLowerCase(),
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Erro ao salvar token:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro interno ao processar solicitação" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Construir link de recuperação
    const resetLink = `${PRODUCTION_URL}/reset-password?token=${token}`;

    console.log("Enviando email de recuperação para:", email);
    console.log("Link de recuperação:", resetLink);

    // Enviar email com Resend
    const emailResponse = await resend.emails.send({
      from: "SisProd <noreply@simchef.app>",
      to: [email],
      subject: "Recuperação de Senha - SisProd",
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recuperação de Senha</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SisProd</h1>
                      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">Sistema de Produção e Estoque</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #18181b; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Recuperação de Senha</h2>
                      
                      <p style="color: #52525b; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                        Olá,
                      </p>
                      
                      <p style="color: #52525b; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                        Recebemos uma solicitação para redefinir a senha da sua conta associada ao email <strong>${email}</strong>.
                      </p>
                      
                      <p style="color: #52525b; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">
                        Clique no botão abaixo para criar uma nova senha:
                      </p>
                      
                      <!-- Button -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td align="center">
                            <a href="${resetLink}" 
                               style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                              Redefinir Minha Senha
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #71717a; margin: 30px 0 0 0; font-size: 14px; line-height: 1.6;">
                        Este link é válido por <strong>1 hora</strong>. Após esse período, você precisará solicitar um novo link.
                      </p>
                      
                      <p style="color: #71717a; margin: 20px 0 0 0; font-size: 14px; line-height: 1.6;">
                        Se você não solicitou a redefinição de senha, pode ignorar este email com segurança.
                      </p>
                      
                      <!-- Divider -->
                      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 30px 0;">
                      
                      <p style="color: #a1a1aa; margin: 0; font-size: 12px; line-height: 1.6;">
                        Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                      </p>
                      <p style="color: #3b82f6; margin: 8px 0 0 0; font-size: 12px; word-break: break-all;">
                        ${resetLink}
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f4f4f5; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px;">
                      <p style="color: #71717a; margin: 0; font-size: 12px;">
                        © ${new Date().getFullYear()} SisProd. Todos os direitos reservados.
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
    });

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Se o email existir, você receberá um link de recuperação."
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Erro na função send-recovery-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao processar solicitação" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
