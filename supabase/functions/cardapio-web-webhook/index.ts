import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

interface OrderItem {
  item_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  observation?: string;
  complements?: {
    name: string;
    quantity: number;
    price: number;
  }[];
}

interface OrderPayload {
  event: string;
  order: {
    id: number;
    type: string;
    status: string;
    sub_total: number;
    total: number;
    items: OrderItem[];
    customer?: {
      name: string;
      phone?: string;
    };
    created_at: string;
  };
}

interface IntegracaoCardapioWeb {
  id: string;
  organization_id: string;
  loja_id: string;
  token: string;
  ambiente: string;
  ativo: boolean;
}

interface MapeamentoItem {
  cardapio_item_id: number;
  cardapio_item_nome: string;
  item_porcionado_id: string;
  quantidade_consumida: number;
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

  try {
    // 1. Get API Key from header
    const apiKey = req.headers.get('X-API-KEY')
    
    if (!apiKey) {
      console.log('Webhook recebido sem X-API-KEY')
      return new Response(
        JSON.stringify({ error: 'API Key not provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const { organization_id, loja_id } = integracao as IntegracaoCardapioWeb
    console.log(`Webhook recebido para organização ${organization_id}, loja ${loja_id}`)

    // 3. Parse webhook payload
    const payload: OrderPayload = await req.json()
    console.log('Payload recebido:', JSON.stringify(payload, null, 2))

    // 4. Handle different events
    const evento = payload.event || 'order.created'
    
    if (evento !== 'order.created' && evento !== 'order.confirmed') {
      // Log but don't process other events
      await supabase.from('cardapio_web_pedidos_log').insert({
        organization_id,
        loja_id,
        order_id: payload.order?.id || 0,
        evento,
        payload,
        sucesso: true,
        itens_processados: null,
        erro: 'Evento ignorado - apenas order.created e order.confirmed são processados'
      })
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Event ${evento} received but not processed`,
          order_id: payload.order?.id 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Get mappings for this organization
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

    // 6. Get today's date in São Paulo timezone
    const today = new Date()
    const spDate = new Date(today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const diaOperacional = spDate.toISOString().split('T')[0]

    // 7. Process each item in the order
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

    for (const item of payload.order.items) {
      const mappings = mapeamentoMap.get(item.item_id)
      
      if (!mappings || mappings.length === 0) {
        console.log(`Item ${item.item_id} (${item.name}) não tem mapeamento configurado`)
        continue
      }

      const itensBaixados: { item_porcionado_id: string; quantidade_baixada: number }[] = []

      for (const mapping of mappings) {
        const quantidadeTotal = item.quantity * mapping.quantidade_consumida

        // Update contagem_porcionados - decrement final_sobra
        const { data: contagem, error: contagemError } = await supabase
          .from('contagem_porcionados')
          .select('id, final_sobra')
          .eq('loja_id', loja_id)
          .eq('item_porcionado_id', mapping.item_porcionado_id)
          .eq('organization_id', organization_id)
          .eq('dia_operacional', diaOperacional)
          .single()

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
            })

          if (insertError) {
            console.error('Erro ao criar contagem:', insertError)
            erros.push(`Erro ao criar contagem para item ${mapping.item_porcionado_id}: ${insertError.message}`)
          } else {
            itensBaixados.push({
              item_porcionado_id: mapping.item_porcionado_id,
              quantidade_baixada: quantidadeTotal
            })
          }
        } else {
          // Update existing contagem
          const novoFinalSobra = (contagem.final_sobra || 0) - quantidadeTotal

          const { error: updateError } = await supabase
            .from('contagem_porcionados')
            .update({ 
              final_sobra: novoFinalSobra,
              updated_at: new Date().toISOString()
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
          }
        }
      }

      if (itensBaixados.length > 0) {
        itensProcessados.push({
          cardapio_item_id: item.item_id,
          cardapio_item_nome: item.name,
          quantidade_pedido: item.quantity,
          itens_baixados: itensBaixados
        })
      }
    }

    // 8. Log the webhook
    const sucesso = erros.length === 0
    await supabase.from('cardapio_web_pedidos_log').insert({
      organization_id,
      loja_id,
      order_id: payload.order.id,
      evento,
      payload,
      itens_processados: itensProcessados,
      sucesso,
      erro: erros.length > 0 ? erros.join('; ') : null
    })

    console.log(`Pedido ${payload.order.id} processado: ${itensProcessados.length} itens baixados`)

    return new Response(
      JSON.stringify({
        success: sucesso,
        order_id: payload.order.id,
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
