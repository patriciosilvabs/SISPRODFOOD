

# Plano: Adicionar Verificação de Idempotência no Webhook

## Diagnóstico

### Problema Identificado
O pedido `179964837` foi processado **2 vezes** pelo webhook:
- 15:48:35 → sobra: 140 - 50 = **90** ✓
- 15:48:57 → sobra: 90 - 50 = **40** ✗ (duplicado!)

O Cardápio Web enviou o mesmo webhook 2 vezes (retry automático para garantir entrega), e o sistema processou ambos porque **não há verificação de duplicidade**.

### Por que "A Produzir" mostra 100?
- Ideal = 140
- Final Sobra (após 2 descontos) = 40
- A Produzir = 140 - 40 = **100** ← resultado do erro

### Como deveria funcionar:
- Ideal = 140
- Final Sobra (1 desconto apenas) = 90
- A Produzir = 140 - 90 = **50** ← resultado correto

## Solução

Adicionar verificação de idempotência **ANTES** de processar o pedido.

### Alteração no Edge Function

No arquivo `supabase/functions/cardapio-web-webhook/index.ts`, adicionar verificação logo após obter o `order_id`:

```typescript
// APÓS extrair orderId (linha ~265)
const orderId = payload.order_id || payload.order?.id || 0

// NOVA VERIFICAÇÃO DE IDEMPOTÊNCIA
if (orderId > 0) {
  const { data: existingLog, error: logCheckError } = await supabase
    .from('cardapio_web_pedidos_log')
    .select('id')
    .eq('order_id', orderId)
    .eq('organization_id', organization_id)
    .eq('sucesso', true)
    .limit(1)
    .maybeSingle()

  if (existingLog) {
    console.log(`⏭️ Pedido ${orderId} já foi processado anteriormente. Ignorando webhook duplicado.`)
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pedido já processado anteriormente (idempotente)',
        order_id: orderId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
}
```

### Fluxo Corrigido

```text
PRIMEIRO WEBHOOK (order_id: 179964837):
├── Verifica log → NÃO encontrado
├── Processa itens → final_sobra = 140 - 50 = 90
└── Insere log → sucesso = true

SEGUNDO WEBHOOK (retry - mesmo order_id):
├── Verifica log → ENCONTRADO com sucesso = true
├── Retorna 200 OK sem processar
└── Sobra permanece 90 ✓
```

## Detalhes Técnicos

### Arquivo a modificar
- `supabase/functions/cardapio-web-webhook/index.ts`

### Local da inserção
Após linha ~265 onde `orderId` é extraído, antes de buscar mapeamentos e processar itens.

### Resposta para webhooks duplicados
Retornar HTTP 200 (sucesso) para que o Cardápio Web não faça mais retries:
```json
{
  "success": true,
  "message": "Pedido já processado anteriormente (idempotente)",
  "order_id": 179964837
}
```

## Resultado Esperado

Após a correção, quando o Cardápio Web enviar um pedido de 50 pizzas com ideal = 140:
- Sobra: **90** (140 - 50)
- A Produzir: **50** (140 - 90)

Mesmo se o webhook for enviado múltiplas vezes, o resultado será sempre correto.

