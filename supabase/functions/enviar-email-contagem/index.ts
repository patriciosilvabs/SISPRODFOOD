import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ItemContagem {
  nome: string;
  ideal: number;
  sobra: number;
  aProduzir: number;
}

interface ContagemEmailRequest {
  organizationId: string;
  lojaId: string;
  lojaNome: string;
  diaOperacional: string;
  encerradoPor: string;
  encerradoEm: string;
  itens: ItemContagem[];
}

const generateEmailHtml = (data: ContagemEmailRequest): string => {
  const totalIdeal = data.itens.reduce((acc, i) => acc + i.ideal, 0);
  const totalSobra = data.itens.reduce((acc, i) => acc + i.sobra, 0);
  const totalProduzir = data.itens.reduce((acc, i) => acc + Math.max(0, i.aProduzir), 0);
  
  const itensHtml = data.itens.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${item.nome}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #3b82f6; font-weight: 600;">${item.ideal}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #22c55e; font-weight: 600;">${item.sobra}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${item.aProduzir > 0 ? '#ef4444' : '#9ca3af'}; font-weight: 600;">${item.aProduzir > 0 ? item.aProduzir : '-'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Resumo de Contagem - ${data.lojaNome}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
      <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 28px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">📦 CONTAGEM ENCERRADA</h1>
          <p style="color: rgba(255,255,255,0.95); margin: 10px 0 0 0; font-size: 18px; font-weight: 600;">${data.lojaNome.toUpperCase()}</p>
        </div>

        <!-- Info -->
        <div style="padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #64748b; font-size: 14px;">
            📅 <strong>Dia Operacional:</strong> ${data.diaOperacional}
          </p>
          <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px;">
            👤 Encerrada por <strong style="color: #1e40af;">${data.encerradoPor}</strong> em ${data.encerradoEm}
          </p>
        </div>

        <!-- Summary Cards -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding: 24px;">
          <tr>
            <td width="33%" style="padding: 0 8px 0 0;">
              <div style="background: #eff6ff; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total Ideal</p>
                <p style="margin: 6px 0 0 0; color: #1e40af; font-size: 32px; font-weight: 700;">${totalIdeal}</p>
              </div>
            </td>
            <td width="33%" style="padding: 0 8px;">
              <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total Sobras</p>
                <p style="margin: 6px 0 0 0; color: #166534; font-size: 32px; font-weight: 700;">${totalSobra}</p>
              </div>
            </td>
            <td width="33%" style="padding: 0 0 0 8px;">
              <div style="background: #fef2f2; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">A Produzir</p>
                <p style="margin: 6px 0 0 0; color: #dc2626; font-size: 32px; font-weight: 700;">${totalProduzir}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Items Table -->
        <div style="padding: 0 24px 24px 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 14px 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Item</th>
                <th style="padding: 14px 12px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #3b82f6; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Ideal</th>
                <th style="padding: 14px 12px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #22c55e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Sobra</th>
                <th style="padding: 14px 12px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #ef4444; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Prod.</th>
              </tr>
            </thead>
            <tbody>
              ${itensHtml}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 20px 24px; text-align: center;">
          <p style="margin: 0; color: #94a3b8; font-size: 13px;">
            SisProd - Sistema de Produção e Estoque
          </p>
          <p style="margin: 6px 0 0 0; color: #64748b; font-size: 11px;">
            Este é um email automático. Não responda.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Iniciando envio de email de contagem...");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ContagemEmailRequest = await req.json();
    console.log("Dados recebidos:", JSON.stringify({
      organizationId: data.organizationId,
      lojaId: data.lojaId,
      lojaNome: data.lojaNome,
      itensCount: data.itens?.length
    }));

    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar destinatários cadastrados para esta organização/loja
    const { data: destinatarios, error: destError } = await supabase
      .from('destinatarios_email_contagem')
      .select('email, nome')
      .eq('organization_id', data.organizationId)
      .eq('ativo', true)
      .or(`loja_id.is.null,loja_id.eq.${data.lojaId}`);

    if (destError) {
      console.error("Erro ao buscar destinatários:", destError);
      return new Response(
        JSON.stringify({ success: false, error: destError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!destinatarios || destinatarios.length === 0) {
      console.log("Nenhum destinatário cadastrado para esta organização/loja");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum destinatário cadastrado", enviados: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Encontrados ${destinatarios.length} destinatários`);

    // Gerar HTML do email
    const html = generateEmailHtml(data);
    const emails = destinatarios.map(d => d.email);

    // Enviar email
    const emailResponse = await resend.emails.send({
      from: "SisProd <onboarding@resend.dev>",
      to: emails,
      subject: `📦 Contagem Encerrada - ${data.lojaNome} (${data.diaOperacional})`,
      html: html,
    });

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email enviado para ${emails.length} destinatário(s)`,
        enviados: emails.length,
        emailResponse 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Erro ao enviar email de contagem:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
