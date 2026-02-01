
# Plano: Investigar e Corrigir Autenticação CardápioWeb API

## Situação Atual

O erro persiste mesmo após a alteração do header. Analisando:

| Dado | Valor |
|------|-------|
| API Key no banco | `7nSyGq49NVXuyZfgEQNPg3TdUqLNXTMNNJwckvE` |
| Webhook token | `DfYVqc4zNpuInstwZUG7zxzT6OQD9DnugQm2zxF5` |
| Ambiente | sandbox |
| Endpoint | `https://integracao.sandbox.cardapioweb.com/api/partner/v1/orders/{id}` |
| Erro | 401 - Token inválido |

## Problema Provável

Baseado na documentação que você mostrou anteriormente, o CardápioWeb pode usar formatos diferentes de autenticação:
1. `Authorization: {token}` (sem prefixo)
2. `Authorization: Bearer {token}` (com prefixo Bearer)
3. `X-API-KEY: {token}` (header customizado)

## Solução

Modificar a edge function para:
1. Adicionar log mostrando exatamente qual API Key está sendo usada
2. Testar o formato `Authorization: Bearer {token}` que é o padrão mais comum em APIs REST

### Alteração no Arquivo

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

**Função `fetchOrderDetails` (linhas 68-95):**

```typescript
async function fetchOrderDetails(orderId: number, apiKey: string, ambiente: string): Promise<OrderData> {
  const baseUrl = ambiente === 'sandbox' 
    ? 'https://integracao.sandbox.cardapioweb.com'
    : 'https://integracao.cardapioweb.com';
  
  const url = `${baseUrl}/api/partner/v1/orders/${orderId}`;
  console.log(`Buscando detalhes do pedido ${orderId} em: ${url}`);
  console.log(`Usando API Key: ${apiKey.substring(0, 10)}... (${apiKey.length} chars)`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${apiKey}`,  // Adicionando prefixo Bearer
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Erro ao buscar pedido: ${response.status} - ${errorText}`);
    throw new Error(`Falha ao buscar pedido ${orderId}: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('Detalhes do pedido recebidos:', JSON.stringify(data, null, 2).substring(0, 500));
  
  return data.order || data;
}
```

## Resumo das Mudanças

1. Adicionar log para mostrar qual API Key está sendo usada (primeiros 10 chars + tamanho)
2. Alterar formato de `Authorization: {token}` para `Authorization: Bearer {token}`

## Após Implementação

1. A edge function será deployada automaticamente
2. Fazer nova venda de teste no CardápioWeb
3. Verificar logs para confirmar se a API Key correta está sendo usada
4. Se ainda falhar, testaremos outros formatos baseado na resposta
