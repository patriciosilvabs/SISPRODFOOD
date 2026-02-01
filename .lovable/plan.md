

# Plano: Corrigir Integração CardápioWeb - Busca de Detalhes via API

## Problema Identificado

O CardápioWeb envia apenas uma **notificação** com o `order_id`, não os detalhes completos do pedido. Nossa edge function espera receber `payload.order.items`, mas o payload real é:

```json
{
  "event_id": "1pry7dk9gcgqmiqe7n8",
  "event_type": "ORDER_CREATED",
  "merchant_id": 8268,
  "order_id": 179546164,
  "order_status": "confirmed",
  "created_at": "2026-02-01T14:22:26-03:00"
}
```

## Solução

Implementar a busca de detalhes do pedido via API do CardápioWeb quando recebermos apenas a notificação.

---

## Parte 1: Adicionar Campo API Key na Integração

Adicionar coluna para armazenar a API Key do CardápioWeb (necessária para buscar detalhes):

```sql
ALTER TABLE integracoes_cardapio_web 
ADD COLUMN cardapio_api_key TEXT;
```

---

## Parte 2: Atualizar Edge Function

Modificar `supabase/functions/cardapio-web-webhook/index.ts`:

### 2.1 Nova Função para Buscar Detalhes

```typescript
async function fetchOrderDetails(orderId: number, apiKey: string, ambiente: string) {
  const baseUrl = ambiente === 'sandbox' 
    ? 'https://integracao.sandbox.cardapioweb.com'
    : 'https://integracao.cardapioweb.com';
  
  const response = await fetch(`${baseUrl}/api/partner/v1/orders/${orderId}`, {
    headers: { 'X-API-KEY': apiKey }
  });
  
  if (!response.ok) {
    throw new Error(`Falha ao buscar pedido: ${response.status}`);
  }
  
  return await response.json();
}
```

### 2.2 Lógica Atualizada no Handler

```typescript
// Detectar formato do payload
let orderData;

if (payload.order && payload.order.items) {
  // Formato completo - usar diretamente
  orderData = payload.order;
} else if (payload.order_id) {
  // Apenas notificação - buscar detalhes via API
  if (!integracao.cardapio_api_key) {
    throw new Error('API Key do CardápioWeb não configurada');
  }
  
  const detalhes = await fetchOrderDetails(
    payload.order_id, 
    integracao.cardapio_api_key,
    integracao.ambiente
  );
  
  orderData = detalhes.order || detalhes;
} else {
  throw new Error('Payload inválido: sem order nem order_id');
}

// Continuar processamento com orderData.items
```

### 2.3 Processar Eventos Relevantes

```typescript
const RELEVANT_STATUSES = ["confirmed", "preparing", "ready", "dispatched", "canceled"];

// Só buscar detalhes e processar estoque para ORDER_CREATED e confirmed
if (payload.event_type === 'ORDER_STATUS_UPDATED' && payload.order_status === 'canceled') {
  // Log cancelamento mas não processa estoque
  return { success: true, message: 'Pedido cancelado registrado' };
}

if (!RELEVANT_STATUSES.includes(payload.order_status)) {
  return { success: true, message: 'Status ignorado' };
}
```

---

## Parte 3: Atualizar Interface de Configuração

### 3.1 Adicionar Campo no Hook

**Arquivo:** `src/hooks/useCardapioWebIntegracao.ts`

Atualizar interface e mutation para incluir `cardapio_api_key`.

### 3.2 Atualizar Card de Integração

**Arquivo:** `src/components/cardapio-web/LojaIntegracaoCard.tsx`

Adicionar campo de input para a API Key do CardápioWeb:

```typescript
<Input
  type="password"
  placeholder="API Key do CardápioWeb"
  value={cardapioApiKey}
  onChange={(e) => setCardapioApiKey(e.target.value)}
/>
```

---

## Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| **Banco de Dados** | Nova coluna `cardapio_api_key` na tabela `integracoes_cardapio_web` |
| **cardapio-web-webhook** | Buscar detalhes via API quando receber apenas notificação |
| **useCardapioWebIntegracao.ts** | Incluir `cardapio_api_key` nas operações |
| **LojaIntegracaoCard.tsx** | Campo para configurar API Key do CardápioWeb |

---

## Fluxo Corrigido

```text
1. CardápioWeb envia notificação: { event_type: "ORDER_CREATED", order_id: 12345 }
2. Webhook valida token → Encontra integração ativa
3. Detecta que payload não tem items → Busca detalhes via API
4. GET https://integracao.cardapioweb.com/api/partner/v1/orders/12345
5. Recebe items do pedido → Processa baixa de estoque
6. Atualiza contagem_porcionados com dados de rastreamento
```

---

## Configuração Necessária pelo Usuário

Após a implementação, o usuário precisará:

1. Acessar a tela de Configuração do Cardápio Web
2. Informar a **API Key do CardápioWeb** (obtida no painel do CardápioWeb)
3. Salvar a configuração

Sem essa API Key, não é possível buscar os detalhes dos pedidos.

