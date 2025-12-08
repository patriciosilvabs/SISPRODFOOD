import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ItemEstoque {
  id: string;
  nome: string;
  tipo: 'insumo' | 'produto';
  estoque_atual: number;
  consumo_medio_diario: number;
  lead_time_dias: number;
  estoque_minimo: number;
  dias_cobertura_desejado: number;
}

interface AlertaItem {
  item_id: string;
  item_nome: string;
  item_tipo: 'insumo' | 'produto';
  status: 'critico' | 'urgente';
  estoque_atual: number;
  dias_cobertura_restante: number;
}

function calcularStatus(item: ItemEstoque): { status: 'critico' | 'urgente' | 'alerta' | 'ok'; diasCobertura: number } {
  const consumoDiario = item.consumo_medio_diario || 0.01;
  const diasCobertura = item.estoque_atual / consumoDiario;
  const estoqueCritico = consumoDiario * item.lead_time_dias;
  const pontoPedido = estoqueCritico + item.estoque_minimo;

  if (item.estoque_atual < estoqueCritico) {
    return { status: 'critico', diasCobertura };
  } else if (item.estoque_atual <= pontoPedido) {
    return { status: 'urgente', diasCobertura };
  } else if (item.estoque_atual <= pontoPedido + (consumoDiario * 2)) {
    return { status: 'alerta', diasCobertura };
  }
  return { status: 'ok', diasCobertura };
}

function gerarEmailHtml(orgNome: string, criticos: AlertaItem[], urgentes: AlertaItem[], appUrl: string): string {
  const criticosHtml = criticos.length > 0 
    ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #DC2626; margin-bottom: 10px;">🔴 CRÍTICOS (Pedir AGORA!)</h3>
        <ul style="list-style: none; padding: 0;">
          ${criticos.map(item => `
            <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
              <strong>${item.item_nome}</strong> (${item.item_tipo}) - 
              Estoque: ${item.estoque_atual.toFixed(2)} | 
              Cobertura: ${item.dias_cobertura_restante.toFixed(1)} dias
            </li>
          `).join('')}
        </ul>
      </div>
    ` : '';

  const urgentesHtml = urgentes.length > 0 
    ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #F59E0B; margin-bottom: 10px;">🟡 URGENTES (Pedir HOJE)</h3>
        <ul style="list-style: none; padding: 0;">
          ${urgentes.map(item => `
            <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
              <strong>${item.item_nome}</strong> (${item.item_tipo}) - 
              Estoque: ${item.estoque_atual.toFixed(2)} | 
              Cobertura: ${item.dias_cobertura_restante.toFixed(1)} dias
            </li>
          `).join('')}
        </ul>
      </div>
    ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Alerta de Estoque</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e40af, #7c3aed); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0;">🚨 Alerta de Estoque</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">${orgNome}</p>
      </div>
      
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin-top: 0;">Sua organização possui itens que precisam de atenção:</p>
        
        ${criticosHtml}
        ${urgentesHtml}
        
        <div style="margin-top: 30px; text-align: center;">
          <a href="${appUrl}/lista-compras-ia" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            🛒 Ver Lista de Compras Completa
          </a>
        </div>
      </div>
      
      <div style="background: #f3f4f6; padding: 15px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
          Este alerta foi gerado automaticamente pelo SimChef.<br>
          Gerencie suas preferências em Configurações → Alertas de Estoque.
        </p>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const appUrl = Deno.env.get("APP_URL") || "https://app.simchef.app";

    console.log("Iniciando verificação de alertas de estoque...");

    // Buscar organizações ativas com alertas configurados
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from("organizations")
      .select(`
        id, 
        nome,
        configuracao_alertas (
          alertas_email_ativos,
          emails_destinatarios,
          enviar_apenas_criticos,
          frequencia
        )
      `)
      .eq("ativo", true);

    if (orgsError) {
      console.error("Erro ao buscar organizações:", orgsError);
      throw orgsError;
    }

    console.log(`Encontradas ${orgs?.length || 0} organizações ativas`);

    let totalAlertasEnviados = 0;

    for (const org of orgs || []) {
      const config = org.configuracao_alertas?.[0];
      
      // Se não há configuração ou alertas desativados, pular
      if (!config?.alertas_email_ativos || config.frequencia === 'nunca') {
        console.log(`Organização ${org.nome}: alertas desativados, pulando...`);
        continue;
      }

      console.log(`Processando organização: ${org.nome}`);

      // Calcular data de 30 dias atrás para consumo médio
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

      // Buscar insumos da organização
      const { data: insumos } = await supabaseAdmin
        .from("insumos")
        .select("id, nome, quantidade_em_estoque, estoque_minimo, lead_time_real_dias, dias_cobertura_desejado")
        .eq("organization_id", org.id);

      // Buscar logs de consumo de insumos (últimos 30 dias)
      const { data: insumosLogs } = await supabaseAdmin
        .from("insumos_log")
        .select("insumo_id, quantidade")
        .eq("organization_id", org.id)
        .eq("tipo", "saida")
        .gte("data", trintaDiasAtras.toISOString());

      // Calcular consumo médio por insumo
      const consumoInsumos: Record<string, number> = {};
      for (const log of insumosLogs || []) {
        consumoInsumos[log.insumo_id] = (consumoInsumos[log.insumo_id] || 0) + Number(log.quantidade);
      }

      // Buscar produtos da organização
      const { data: produtos } = await supabaseAdmin
        .from("produtos")
        .select("id, nome, lead_time_real_dias, dias_cobertura_desejado")
        .eq("organization_id", org.id)
        .eq("ativo", true);

      // Buscar estoque CPD de produtos
      const { data: estoqueProdutos } = await supabaseAdmin
        .from("estoque_cpd_produtos")
        .select("produto_id, quantidade")
        .eq("organization_id", org.id);

      const estoqueProdutosMap: Record<string, number> = {};
      for (const e of estoqueProdutos || []) {
        estoqueProdutosMap[e.produto_id] = Number(e.quantidade);
      }

      // Buscar logs de consumo de produtos (últimos 30 dias)
      const { data: produtosLogs } = await supabaseAdmin
        .from("movimentacoes_cpd_produtos")
        .select("produto_id, quantidade")
        .eq("organization_id", org.id)
        .eq("tipo", "saida")
        .gte("created_at", trintaDiasAtras.toISOString());

      const consumoProdutos: Record<string, number> = {};
      for (const log of produtosLogs || []) {
        consumoProdutos[log.produto_id] = (consumoProdutos[log.produto_id] || 0) + Number(log.quantidade);
      }

      // Buscar alertas ativos para não duplicar
      const { data: alertasAtivos } = await supabaseAdmin
        .from("alertas_estoque")
        .select("item_id, item_tipo")
        .eq("organization_id", org.id)
        .is("resolvido_em", null);

      const alertasAtivosSet = new Set(
        (alertasAtivos || []).map(a => `${a.item_tipo}-${a.item_id}`)
      );

      const novosAlertas: AlertaItem[] = [];
      const itemsParaResolver: { item_id: string; item_tipo: string }[] = [];

      // Processar insumos
      for (const insumo of insumos || []) {
        const consumoTotal = consumoInsumos[insumo.id] || 0;
        const consumoDiario = consumoTotal / 30;

        const item: ItemEstoque = {
          id: insumo.id,
          nome: insumo.nome,
          tipo: 'insumo',
          estoque_atual: Number(insumo.quantidade_em_estoque) || 0,
          consumo_medio_diario: consumoDiario,
          lead_time_dias: insumo.lead_time_real_dias || 2,
          estoque_minimo: Number(insumo.estoque_minimo) || 0,
          dias_cobertura_desejado: insumo.dias_cobertura_desejado || 7,
        };

        const { status, diasCobertura } = calcularStatus(item);
        const alertaKey = `insumo-${insumo.id}`;

        if ((status === 'critico' || status === 'urgente') && !alertasAtivosSet.has(alertaKey)) {
          if (status === 'critico' || !config.enviar_apenas_criticos) {
            novosAlertas.push({
              item_id: insumo.id,
              item_nome: insumo.nome,
              item_tipo: 'insumo',
              status,
              estoque_atual: item.estoque_atual,
              dias_cobertura_restante: diasCobertura,
            });
          }
        } else if (status === 'ok' && alertasAtivosSet.has(alertaKey)) {
          itemsParaResolver.push({ item_id: insumo.id, item_tipo: 'insumo' });
        }
      }

      // Processar produtos
      for (const produto of produtos || []) {
        const consumoTotal = consumoProdutos[produto.id] || 0;
        const consumoDiario = consumoTotal / 30;
        const estoqueAtual = estoqueProdutosMap[produto.id] || 0;

        const item: ItemEstoque = {
          id: produto.id,
          nome: produto.nome,
          tipo: 'produto',
          estoque_atual: estoqueAtual,
          consumo_medio_diario: consumoDiario,
          lead_time_dias: produto.lead_time_real_dias || 2,
          estoque_minimo: 0,
          dias_cobertura_desejado: produto.dias_cobertura_desejado || 7,
        };

        const { status, diasCobertura } = calcularStatus(item);
        const alertaKey = `produto-${produto.id}`;

        if ((status === 'critico' || status === 'urgente') && !alertasAtivosSet.has(alertaKey)) {
          if (status === 'critico' || !config.enviar_apenas_criticos) {
            novosAlertas.push({
              item_id: produto.id,
              item_nome: produto.nome,
              item_tipo: 'produto',
              status,
              estoque_atual: estoqueAtual,
              dias_cobertura_restante: diasCobertura,
            });
          }
        } else if (status === 'ok' && alertasAtivosSet.has(alertaKey)) {
          itemsParaResolver.push({ item_id: produto.id, item_tipo: 'produto' });
        }
      }

      // Resolver alertas que voltaram ao normal
      for (const item of itemsParaResolver) {
        await supabaseAdmin
          .from("alertas_estoque")
          .update({ resolvido_em: new Date().toISOString() })
          .eq("organization_id", org.id)
          .eq("item_id", item.item_id)
          .eq("item_tipo", item.item_tipo)
          .is("resolvido_em", null);
      }

      if (novosAlertas.length === 0) {
        console.log(`Organização ${org.nome}: nenhum novo alerta a enviar`);
        continue;
      }

      // Inserir novos alertas
      const alertasParaInserir = novosAlertas.map(a => ({
        organization_id: org.id,
        item_id: a.item_id,
        item_tipo: a.item_tipo,
        item_nome: a.item_nome,
        status_alerta: a.status,
        estoque_atual: a.estoque_atual,
        dias_cobertura_restante: a.dias_cobertura_restante,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("alertas_estoque")
        .insert(alertasParaInserir);

      if (insertError) {
        console.error(`Erro ao inserir alertas para ${org.nome}:`, insertError);
        continue;
      }

      // Buscar emails dos admins da organização
      const { data: admins } = await supabaseAdmin
        .from("organization_members")
        .select("user_id, profiles(email)")
        .eq("organization_id", org.id)
        .eq("is_admin", true);

      const emailsAdmins = (admins || [])
        .map(a => (a.profiles as any)?.email)
        .filter(Boolean);

      // Adicionar emails extras configurados
      const todosEmails = [...new Set([
        ...emailsAdmins,
        ...(config.emails_destinatarios || []),
      ])];

      if (todosEmails.length === 0) {
        console.log(`Organização ${org.nome}: nenhum email destinatário encontrado`);
        continue;
      }

      const criticos = novosAlertas.filter(a => a.status === 'critico');
      const urgentes = novosAlertas.filter(a => a.status === 'urgente');

      const html = gerarEmailHtml(org.nome, criticos, urgentes, appUrl);

      // Enviar email
      try {
        const { error: emailError } = await resend.emails.send({
          from: "SimChef <alertas@simchef.app>",
          to: todosEmails,
          subject: `🚨 Alerta de Estoque - ${criticos.length} críticos, ${urgentes.length} urgentes`,
          html,
        });

        if (emailError) {
          console.error(`Erro ao enviar email para ${org.nome}:`, emailError);
        } else {
          totalAlertasEnviados += novosAlertas.length;
          console.log(`Email enviado para ${org.nome}: ${todosEmails.join(', ')}`);
        }
      } catch (emailErr) {
        console.error(`Exceção ao enviar email para ${org.nome}:`, emailErr);
      }
    }

    console.log(`Verificação concluída. Total de alertas enviados: ${totalAlertasEnviados}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verificação concluída. ${totalAlertasEnviados} alertas enviados.`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro na verificação de alertas:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
