

# Plano: Adicionar Teste Direto com Ambiente de Produção

## Diagnóstico Atual

| Item | Status |
|------|--------|
| Webhook Token | ✅ Funcionando (eventos chegam) |
| API Key Sandbox | ❌ 401 em todos os formatos |
| Ambiente configurado | sandbox |

## Hipótese Principal

A API Key pode estar vinculada ao ambiente de **produção** no CardápioWeb, mas estamos tentando usar no endpoint de **sandbox**.

## Solução Proposta

Modificar a edge function para:

1. **Tentar AMBOS os ambientes** quando a autenticação falhar
2. Primeiro tenta o ambiente configurado (sandbox)
3. Se falhar, automaticamente tenta o outro ambiente (produção)
4. Registra qual ambiente funcionou para debug

### Alteração no Arquivo

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

**Modificação na função `fetchOrderDetails`:**

```typescript
async function fetchOrderDetails(orderId: number, apiKey: string, ambiente: string): Promise<OrderData> {
  // Tentar primeiro o ambiente configurado, depois o outro
  const ambientes = [
    ambiente === 'sandbox' 
      ? 'https://integracao.sandbox.cardapioweb.com'
      : 'https://integracao.cardapioweb.com',
    // Fallback para o outro ambiente
    ambiente === 'sandbox' 
      ? 'https://integracao.cardapioweb.com'  // tenta produção
      : 'https://integracao.sandbox.cardapioweb.com'  // tenta sandbox
  ];
  
  const authFormats = [
    { name: 'X-API-KEY', headers: { 'X-API-KEY': apiKey } },
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${apiKey}` } },
    { name: 'Auth direto', headers: { 'Authorization': apiKey } },
  ];
  
  for (const baseUrl of ambientes) {
    const url = `${baseUrl}/api/partner/v1/orders/${orderId}`;
    console.log(`Tentando ambiente: ${baseUrl}`);
    
    for (const format of authFormats) {
      // ... tentativas de autenticação
    }
  }
}
```

## Alternativa: Verificação Manual

Antes de implementar, você pode verificar rapidamente:

1. Acesse o painel do CardápioWeb
2. Verifique se você está no ambiente **SANDBOX** ou **PRODUÇÃO**
3. Confirme se a API Key foi gerada nesse mesmo ambiente
4. Se necessário, mude o ambiente no nosso sistema para "produção"

## Resumo

Esta alteração vai testar automaticamente ambos os ambientes do CardápioWeb, resolvendo o problema caso a chave seja de um ambiente diferente do configurado.

