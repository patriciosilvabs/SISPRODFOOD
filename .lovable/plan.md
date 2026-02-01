
# Plano: Corrigir Autenticação da API CardápioWeb

## Problema Identificado

A API Key está salva corretamente no banco (`7nSyGq49NVXuyZfgEQNPg3TdUqLNXTMNNJwckvE`), mas a chamada para buscar detalhes do pedido retorna **401 Unauthorized**.

Erro nos logs:
```
Erro ao buscar pedido: 401 - {"code":4010,"message":"Token inválido."}
```

## Análise

Baseado na documentação do CardápioWeb que você enviou, o header de autenticação pode variar. Precisamos testar o formato correto.

A documentação mostra que o endpoint é:
```
GET https://integracao.sandbox.cardapioweb.com/api/partner/v1/orders/{orderId}
```

## Solução

Modificar a edge function `cardapio-web-webhook` para usar o formato correto de autenticação conforme a documentação do CardápioWeb.

### Alteração no Arquivo

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

**De (linhas 76-82):**
```typescript
const response = await fetch(url, {
  method: 'GET',
  headers: { 
    'X-API-KEY': apiKey,
    'Content-Type': 'application/json'
  }
});
```

**Para:**
```typescript
const response = await fetch(url, {
  method: 'GET',
  headers: { 
    'Authorization': apiKey,
    'Content-Type': 'application/json'
  }
});
```

Nota: A documentação do CardápioWeb que você mostrou na imagem indica que o header `Authorization` deve conter a API Key diretamente (sem prefixo "Bearer").

---

## Detalhes Técnicos

| Aspecto | Atual | Correto (Conforme Doc) |
|---------|-------|------------------------|
| Header Name | `X-API-KEY` | `Authorization` |
| Header Value | `7nSyGq...` | `7nSyGq...` |
| Formato | `X-API-KEY: {token}` | `Authorization: {token}` |

## Teste Após Correção

1. Deploy automático da edge function
2. Fazer nova venda de teste no CardápioWeb
3. Verificar nos logs se a busca de detalhes foi bem-sucedida
4. Confirmar baixa de estoque na contagem

## Resumo

Uma única alteração no header de autenticação de `X-API-KEY` para `Authorization` na função `fetchOrderDetails`.
