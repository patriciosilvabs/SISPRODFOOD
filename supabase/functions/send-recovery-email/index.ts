import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecoveryEmailRequest {
  email: string;
  resetLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, resetLink }: RecoveryEmailRequest = await req.json();

    console.log("Sending recovery email to:", email);
    console.log("Reset link:", resetLink);

    const emailResponse = await resend.emails.send({
      from: "SisProd <noreply@simchef.app>",
      to: [email],
      subject: "🔐 Redefinir sua senha - SisProd",
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
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        SisProd
                      </h1>
                      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
                        Sistema de Estoque e Produção
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #18181b; margin: 0 0 16px; font-size: 24px; font-weight: 600;">
                        Olá! 👋
                      </h2>
                      
                      <p style="color: #52525b; margin: 0 0 16px; font-size: 16px; line-height: 1.6;">
                        Você solicitou a redefinição de senha da sua conta no <strong>SisProd</strong>.
                      </p>
                      
                      <p style="color: #52525b; margin: 0 0 32px; font-size: 16px; line-height: 1.6;">
                        Clique no botão abaixo para criar uma nova senha:
                      </p>
                      
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${resetLink}" 
                               style="display: inline-block;
                                      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                                      color: #ffffff;
                                      padding: 16px 48px;
                                      text-decoration: none;
                                      border-radius: 12px;
                                      font-weight: 600;
                                      font-size: 16px;
                                      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                              Redefinir Minha Senha
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Warning -->
                      <div style="margin-top: 32px; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
                          ⚠️ <strong>Importante:</strong> Este link expira em 1 hora e só pode ser usado uma única vez.
                        </p>
                      </div>
                      
                      <p style="color: #71717a; margin: 24px 0 0; font-size: 14px; line-height: 1.5;">
                        Se você não solicitou esta redefinição de senha, pode ignorar este email com segurança. Sua senha permanecerá inalterada.
                      </p>
                      
                      <!-- Alternative Link -->
                      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e4e4e7;">
                        <p style="color: #a1a1aa; margin: 0 0 8px; font-size: 12px;">
                          Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                        </p>
                        <p style="color: #6366f1; margin: 0; font-size: 12px; word-break: break-all;">
                          ${resetLink}
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #18181b; padding: 24px 30px; text-align: center;">
                      <p style="color: #a1a1aa; margin: 0; font-size: 12px;">
                        © ${new Date().getFullYear()} SisProd - Sistema de Estoque e Produção
                      </p>
                      <p style="color: #71717a; margin: 8px 0 0; font-size: 11px;">
                        Este é um email automático. Por favor, não responda.
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

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-recovery-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
