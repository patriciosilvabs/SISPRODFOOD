

# Plano: Testar Múltiplos Formatos de Autenticação

## Problema

O erro 401 persiste mesmo após:
- Usar `Authorization: {token}` (sem Bearer)
- Usar `Authorization: Bearer {token}` (com Bearer)

A API Key no banco (`7nSyGq49NVXuyZfgEQNPg3TdUqLNXTMNNJwckvE`) está sendo usada corretamente, mas o CardápioWeb não a aceita.

## Diagnóstico

Há três possibilidades:

1. **A API Key inserida está incorreta** - talvez a chave copiada esteja incompleta ou com caracteres extras
2. **O formato de autenticação é diferente** - pode ser X-Api-Key, api_key como query param, ou outro formato
3. **A API Key expirou ou não está ativa** no painel do CardápioWeb

## Solução Proposta

Modificar a edge function para:

1. **Testar múltiplos formatos** em sequência até um funcionar
2. **Adicionar logs detalhados** para identificar qual formato funciona
3. **Incluir tentativas com todos os headers possíveis**:
   - `Authorization: Bearer {token}`
   - `Authorization: {token}` (sem Bearer)
   - `X-API-KEY: {token}`
   - `api_key: {token}`

### Alteração no Arquivo

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

**Função `fetchOrderDetails` será modificada para:**

```typescript
async function fetchOrderDetails(orderId: number, apiKey: string, ambiente: string): Promise<OrderData> {
  const baseUrl = ambiente === 'sandbox' 
    ? 'https://integracao.sandbox.cardapioweb.com'
    : 'https://integracao.cardapioweb.com';
  
  const url = `${baseUrl}/api/partner/v1/orders/${orderId}`;
  console.log(`Buscando detalhes do pedido ${orderId} em: ${url}`);
  console.log(`API Key completa: ${apiKey}`); // Log temporário para debug
  
  // Tentar múltiplos formatos de autenticação
  const authFormats = [
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${apiKey}` } },
    { name: 'Auth direto', headers: { 'Authorization': apiKey } },
    { name: 'X-API-KEY', headers: { 'X-API-KEY': apiKey } },
    { name: 'api_key', headers: { 'api_key': apiKey } },
  ];
  
  for (const format of authFormats) {
    console.log(`Tentando formato: ${format.name}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        ...format.headers,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log(`✅ Formato ${format.name} funcionou!`);
      const data = await response.json();
      return data.order || data;
    }
    
    const errorText = await response.text();
    console.log(`❌ Formato ${format.name} falhou: ${response.status} - ${errorText}`);
  }
  
  throw new Error(`Todos os formatos de autenticação falharam para pedido ${orderId}`);
}
```

## Importante - Verificação Manual

Antes de implementar, você deve verificar no painel do CardápioWeb:

1. A API Key está **ativa**?
2. A API Key tem **permissão para leitura de pedidos**?
3. A API Key é para o **ambiente sandbox**?
4. Copie a API Key novamente garantindo que não há espaços extras

## Resumo

Esta alteração vai testar todos os formatos possíveis e mostrar nos logs qual funciona (ou se nenhum funciona, confirmando que a API Key está inválida).

