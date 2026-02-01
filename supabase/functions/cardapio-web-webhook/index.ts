import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-webhook-token',
}

interface OrderComplement {
  id?: number;
  item_id?: number;
  code?: string;
  name: string;
  quantity: number;
  price: number;
}

interface OrderItem {
  item_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  observation?: string;
  complements?: OrderComplement[];
}

interface OrderData {
  id: number;
  type?: string;
  status?: string;
  sub_total?: number;
  total?: number;
  items: OrderItem[];
  customer?: {
    name: string;
    phone?: string;
  };
  created_at?: string;
}

interface WebhookPayload {
  event?: string;
  event_type?: string;
  event_id?: string;
  order_id?: number;
  order_status?: string;
  merchant_id?: number;
  created_at?: string;
  order?: OrderData;
}

interface IntegracaoCardapioWeb {
  id: string;
  organization_id: string;
  loja_id: string;
  token: string;
  ambiente: string;
  ativo: boolean;
  cardapio_api_key: string | null;
}

interface MapeamentoItem {
  cardapio_item_id: number;
  cardapio_item_nome: string;
  item_porcionado_id: string;
  quantidade_consumida: number;
}

// Status que devemos processar
const RELEVANT_STATUSES = ["confirmed", "preparing", "ready", "dispatched"];

// Função para buscar detalhes do pedido via API do CardápioWeb
// Testa múltiplos ambientes e formatos de autenticação até encontrar um que funcione
async function fetchOrderDetails(orderId: number, apiKey: string, ambiente: string): Promise<OrderData> {
  // Tentar primeiro o ambiente configurado, depois o outro como fallback
  const ambientes = [
    {
      name: ambiente === 'sandbox' ? 'SANDBOX' : 'PRODUÇÃO',
      url: ambiente === 'sandbox' 
        ? 'https://integracao.sandbox.cardapioweb.com'
        : 'https://integracao.cardapioweb.com'
    },
    {
      name: ambiente === 'sandbox' ? 'PRODUÇÃO (fallback)' : 'SANDBOX (fallback)',
      url: ambiente === 'sandbox' 
        ? 'https://integracao.cardapioweb.com'
        : 'https://integracao.sandbox.cardapioweb.com'
    }
  ];
  
  console.log(`Buscando detalhes do pedido ${orderId}`);
  console.log(`API Key: ${apiKey.substring(0, 10)}...`);
  console.log(`Ambiente configurado: ${ambiente}`);
  
  // Formatos de autenticação a testar (X-API-KEY primeiro conforme documentação)
  const authFormats: { name: string; headers: Record<string, string> }[] = [
    { name: 'X-API-KEY', headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } },
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
    { name: 'Auth direto', headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' } },
  ];
  
  for (const amb of ambientes) {
    const url = `${amb.url}/api/partner/v1/orders/${orderId}`;
    console.log(`\n🔄 Tentando ambiente: ${amb.name}`);
    console.log(`URL: ${url}`);
    
    for (const format of authFormats) {
      console.log(`  Tentando formato: ${format.name}`);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: format.headers
        });
        
        if (response.ok) {
          console.log(`  ✅ SUCESSO! Ambiente ${amb.name} com formato ${format.name}`);
          const data = await response.json();
          console.log('Detalhes do pedido recebidos:', JSON.stringify(data, null, 2).substring(0, 5000));
          return data.order || data;
        }
        
        const errorText = await response.text();
        console.log(`  ❌ ${format.name} falhou: ${response.status} - ${errorText.substring(0, 100)}`);
      } catch (fetchError) {
        console.log(`  ❌ ${format.name} erro de fetch: ${fetchError}`);
      }
    }
  }
  
  throw new Error(`Todos os ambientes e formatos de autenticação falharam para pedido ${orderId}. Verifique se a API Key está correta e ativa no CardápioWeb.`);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Log all headers for debugging
  console.log('=== Cardápio Web Webhook Recebido ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  
  const headersObj: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    headersObj[key] = key.toLowerCase().includes('key') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')
      ? value.substring(0, 10) + '...' 
      : value
  })
  console.log('Headers:', JSON.stringify(headersObj, null, 2))

  try {
    // Clone request to read body for logging and token extraction
    const rawBody = await req.text()
    console.log('Body recebido:', rawBody.substring(0, 500))
    
    // 1. Try to get API Key from multiple sources
    // Cardápio Web sends token via x-webhook-token header
    let apiKey = req.headers.get('x-webhook-token') || req.headers.get('X-Webhook-Token')
    
    if (apiKey) {
      console.log('✅ API Key encontrada no x-webhook-token header')
    }
    
    // Fallback: Try X-API-KEY header
    if (!apiKey) {
      apiKey = req.headers.get('X-API-KEY') || req.headers.get('x-api-key')
      if (apiKey) {
        console.log('API Key encontrada no X-API-KEY header')
      }
    }
    
    // Fallback: Try Authorization header (Bearer token)
    if (!apiKey) {
      const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7)
        console.log('API Key encontrada no Authorization header')
      }
    }
    
    // Try query parameter
    if (!apiKey) {
      const url = new URL(req.url)
      apiKey = url.searchParams.get('token') || url.searchParams.get('api_key') || url.searchParams.get('apiKey')
      if (apiKey) {
        console.log('API Key encontrada na query string')
      }
    }
    
    // Try to extract from body
    if (!apiKey && rawBody) {
      try {
        const bodyJson = JSON.parse(rawBody)
        apiKey = bodyJson.token || bodyJson.api_key || bodyJson.apiKey
        if (apiKey) {
          console.log('API Key encontrada no body')
        }
      } catch {
        // Body is not JSON, ignore
      }
    }
    
    if (!apiKey) {
      console.log('❌ Webhook recebido sem API Key em nenhuma fonte')
      console.log('Headers disponíveis:', Object.keys(headersObj).join(', '))
      return new Response(
        JSON.stringify({ 
          error: 'API Key not provided',
          hint: 'Send token via X-API-KEY header, Authorization Bearer, query param (token), or in body (token)'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ API Key encontrada:', apiKey.substring(0, 10) + '...')
    
    // Parse the body we already read
    let payload: WebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      console.error('Erro ao parsear body como JSON')
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Validate token and get integration config
    const { data: integracao, error: integracaoError } = await supabase
      .from('integracoes_cardapio_web')
      .select('*')
      .eq('token', apiKey)
      .eq('ativo', true)
      .single()

    if (integracaoError || !integracao) {
      console.log('Token inválido ou integração inativa:', apiKey.substring(0, 10) + '...')
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API Key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { organization_id, loja_id, ambiente, cardapio_api_key } = integracao as IntegracaoCardapioWeb
    console.log(`Webhook recebido para organização ${organization_id}, loja ${loja_id}`)

    console.log('Payload recebido:', JSON.stringify(payload, null, 2))

    // 3. Determinar o tipo de evento
    const evento = payload.event_type || payload.event || 'order.created'
    const orderStatus = payload.order_status || payload.order?.status || ''
    const orderId = payload.order_id || payload.order?.id || 0
    
    console.log(`Evento: ${evento}, Status: ${orderStatus}, Order ID: ${orderId}`)

    // 4. Verificar se devemos processar este evento
    // ORDER_STATUS_UPDATED com status canceled - apenas logar
    if (evento === 'ORDER_STATUS_UPDATED' && orderStatus === 'canceled') {
      await supabase.from('cardapio_web_pedidos_log').insert({
        organization_id,
        loja_id,
        order_id: orderId,
        evento,
        payload,
        sucesso: true,
        itens_processados: null,
        erro: 'Pedido cancelado - não processa estoque'
      })
      
      console.log(`Pedido ${orderId} cancelado - registrado mas não processado`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Pedido cancelado registrado',
          order_id: orderId 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Se não é um status relevante e não é ORDER_CREATED, ignorar
    if (evento !== 'ORDER_CREATED' && evento !== 'order.created' && 
        !RELEVANT_STATUSES.includes(orderStatus)) {
      await supabase.from('cardapio_web_pedidos_log').insert({
        organization_id,
        loja_id,
        order_id: orderId,
        evento,
        payload,
        sucesso: true,
        itens_processados: null,
        erro: `Status ${orderStatus} ignorado - apenas ${RELEVANT_STATUSES.join(', ')} são processados`
      })
      
      console.log(`Evento ${evento} com status ${orderStatus} ignorado`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Event ${evento} with status ${orderStatus} received but not processed`,
          order_id: orderId 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Obter dados completos do pedido
    let orderData: OrderData | null = null
    
    // Se o payload já contém os items completos, usar diretamente
    if (payload.order?.items && payload.order.items.length > 0) {
      console.log('✅ Payload contém items completos, usando diretamente')
      orderData = payload.order
    } 
    // Caso contrário, precisamos buscar via API
    else if (orderId) {
      console.log('⚠️ Payload não contém items, buscando via API...')
      
      if (!cardapio_api_key) {
        const errorMsg = 'API Key do CardápioWeb não configurada. Configure a API Key na tela de integração.'
        console.error(errorMsg)
        
        await supabase.from('cardapio_web_pedidos_log').insert({
          organization_id,
          loja_id,
          order_id: orderId,
          evento,
          payload,
          sucesso: false,
          itens_processados: null,
          erro: errorMsg
        })
        
        return new Response(
          JSON.stringify({ 
            error: 'API Key do CardápioWeb não configurada',
            hint: 'Configure a API Key na tela de integração do Cardápio Web'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      try {
        orderData = await fetchOrderDetails(orderId, cardapio_api_key, ambiente)
        console.log(`✅ Detalhes do pedido ${orderId} obtidos via API`)
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : 'Erro ao buscar pedido'
        console.error('Erro ao buscar detalhes do pedido:', errorMsg)
        
        await supabase.from('cardapio_web_pedidos_log').insert({
          organization_id,
          loja_id,
          order_id: orderId,
          evento,
          payload,
          sucesso: false,
          itens_processados: null,
          erro: errorMsg
        })
        
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Se não conseguiu obter os dados do pedido
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      const errorMsg = 'Não foi possível obter os itens do pedido'
      console.error(errorMsg)
      
      await supabase.from('cardapio_web_pedidos_log').insert({
        organization_id,
        loja_id,
        order_id: orderId,
        evento,
        payload,
        sucesso: false,
        itens_processados: null,
        erro: errorMsg
      })
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processando ${orderData.items.length} itens do pedido ${orderId}`)
    
    // Log detalhado de cada item para diagnóstico
    for (const item of orderData.items) {
      console.log(`📦 Item Principal: id=${item.item_id}, nome="${item.name}", qty=${item.quantity}`)
      console.log(`   Complements: ${item.complements ? item.complements.length : 0} itens`)
      if (item.complements && item.complements.length > 0) {
        for (const c of item.complements) {
          console.log(`   ↳ Complement: "${c.name}" (id=${c.id || 'N/A'}, item_id=${c.item_id || 'N/A'}, code=${c.code || 'N/A'})`)
        }
      } else {
        console.log(`   ⚠️ Nenhum complemento encontrado para este item`)
      }
    }

    // 6. Get mappings for this organization
    const { data: mapeamentos, error: mapError } = await supabase
      .from('mapeamento_cardapio_itens')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('ativo', true)

    if (mapError) {
      console.error('Erro ao buscar mapeamentos:', mapError)
      throw new Error('Failed to fetch mappings')
    }

    // Create a map for quick lookup
    const mapeamentoMap = new Map<number, MapeamentoItem[]>()
    for (const m of (mapeamentos || []) as MapeamentoItem[]) {
      if (!mapeamentoMap.has(m.cardapio_item_id)) {
        mapeamentoMap.set(m.cardapio_item_id, [])
      }
      mapeamentoMap.get(m.cardapio_item_id)!.push(m)
    }

    // 7. Get today's date in São Paulo timezone
    const today = new Date()
    const spDate = new Date(today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const diaOperacional = spDate.toISOString().split('T')[0]

    // 8. Process each item in the order
    const itensProcessados: {
      cardapio_item_id: number;
      cardapio_item_nome: string;
      quantidade_pedido: number;
      itens_baixados: {
        item_porcionado_id: string;
        quantidade_baixada: number;
      }[];
    }[] = []

    const erros: string[] = []

    // Helper function to process a single item (main or complement)
    const processItem = async (
      itemId: number,
      itemName: string,
      quantity: number,
      sourceType: 'main' | 'complement'
    ): Promise<{ item_porcionado_id: string; quantidade_baixada: number }[]> => {
      const mappings = mapeamentoMap.get(itemId)
      
      if (!mappings || mappings.length === 0) {
        console.log(`[${sourceType}] Item ${itemId} (${itemName}) não tem mapeamento configurado`)
        return []
      }

      const itensBaixados: { item_porcionado_id: string; quantidade_baixada: number }[] = []

      for (const mapping of mappings) {
        // Pular mapeamentos sem item_porcionado_id (ainda não vinculados)
        if (!mapping.item_porcionado_id) {
          console.log(`[${sourceType}] Mapeamento para item ${itemId} não tem item_porcionado_id configurado`)
          continue
        }
        
        const quantidadeTotal = quantity * mapping.quantidade_consumida

        // Update contagem_porcionados - decrement final_sobra
        const { data: contagem, error: contagemError } = await supabase
          .from('contagem_porcionados')
          .select('id, final_sobra, cardapio_web_baixa_total')
          .eq('loja_id', loja_id)
          .eq('item_porcionado_id', mapping.item_porcionado_id)
          .eq('organization_id', organization_id)
          .eq('dia_operacional', diaOperacional)
          .single()

        const agora = new Date().toISOString()

        if (contagemError || !contagem) {
          // Create new contagem if doesn't exist
          const { error: insertError } = await supabase
            .from('contagem_porcionados')
            .insert({
              loja_id,
              item_porcionado_id: mapping.item_porcionado_id,
              organization_id,
              dia_operacional: diaOperacional,
              final_sobra: -quantidadeTotal, // Negative means consumed
              ideal_amanha: 0,
              usuario_id: '00000000-0000-0000-0000-000000000000',
              usuario_nome: 'Cardápio Web',
              // Campos de rastreamento Cardápio Web
              cardapio_web_baixa_total: quantidadeTotal,
              cardapio_web_ultima_baixa_at: agora,
              cardapio_web_ultima_baixa_qtd: quantidadeTotal,
            })

          if (insertError) {
            console.error('Erro ao criar contagem:', insertError)
            erros.push(`Erro ao criar contagem para item ${mapping.item_porcionado_id}: ${insertError.message}`)
          } else {
            itensBaixados.push({
              item_porcionado_id: mapping.item_porcionado_id,
              quantidade_baixada: quantidadeTotal
            })
            console.log(`[${sourceType}] ✅ Criou contagem para ${itemName}: -${quantidadeTotal}`)
          }
        } else {
          // Update existing contagem
          const novoFinalSobra = (contagem.final_sobra || 0) - quantidadeTotal
          const novoTotalBaixas = ((contagem as unknown as Record<string, number>).cardapio_web_baixa_total || 0) + quantidadeTotal

          const { error: updateError } = await supabase
            .from('contagem_porcionados')
            .update({ 
              final_sobra: novoFinalSobra,
              updated_at: agora,
              // Campos de rastreamento Cardápio Web
              cardapio_web_baixa_total: novoTotalBaixas,
              cardapio_web_ultima_baixa_at: agora,
              cardapio_web_ultima_baixa_qtd: quantidadeTotal,
            })
            .eq('id', contagem.id)

          if (updateError) {
            console.error('Erro ao atualizar contagem:', updateError)
            erros.push(`Erro ao atualizar contagem ${contagem.id}: ${updateError.message}`)
          } else {
            itensBaixados.push({
              item_porcionado_id: mapping.item_porcionado_id,
              quantidade_baixada: quantidadeTotal
            })
            console.log(`[${sourceType}] ✅ Atualizou contagem para ${itemName}: -${quantidadeTotal} (novo: ${novoFinalSobra})`)
          }
        }
      }

      return itensBaixados
    }

    // Process each item in the order
    for (const item of orderData.items) {
      const allItensBaixados: { item_porcionado_id: string; quantidade_baixada: number }[] = []

      // Process main item
      const mainItemBaixados = await processItem(item.item_id, item.name, item.quantity, 'main')
      allItensBaixados.push(...mainItemBaixados)

      // Process complements (sabores, opcionais, etc)
      if (item.complements && item.complements.length > 0) {
        console.log(`Processando ${item.complements.length} complementos do item ${item.name}`)
        
        for (const complement of item.complements) {
          // Try different ID sources: id, item_id, or parse from code
          const complementId = complement.id || complement.item_id || 
            (complement.code ? parseInt(complement.code, 10) : null)
          
          if (complementId && !isNaN(complementId)) {
            const complementBaixados = await processItem(
              complementId, 
              complement.name, 
              item.quantity * (complement.quantity || 1), // Multiply by item quantity
              'complement'
            )
            allItensBaixados.push(...complementBaixados)
          } else {
            console.log(`Complemento "${complement.name}" não tem ID numérico válido`)
          }
        }
      }

      if (allItensBaixados.length > 0) {
        itensProcessados.push({
          cardapio_item_id: item.item_id,
          cardapio_item_nome: item.name,
          quantidade_pedido: item.quantity,
          itens_baixados: allItensBaixados
        })
      }
    }

    // 9. Log the webhook
    const sucesso = erros.length === 0
    await supabase.from('cardapio_web_pedidos_log').insert({
      organization_id,
      loja_id,
      order_id: orderId,
      evento,
      payload,
      itens_processados: itensProcessados,
      sucesso,
      erro: erros.length > 0 ? erros.join('; ') : null
    })

    console.log(`Pedido ${orderId} processado: ${itensProcessados.length} itens baixados`)

    return new Response(
      JSON.stringify({
        success: sucesso,
        order_id: orderId,
        processed_items: itensProcessados.length,
        items: itensProcessados,
        errors: erros.length > 0 ? erros : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro no webhook:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
