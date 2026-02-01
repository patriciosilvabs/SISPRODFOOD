
# Plano: Corrigir Baixa de Estoque - Mapeamento Faltando

## Diagnóstico Confirmado

Os logs mostram claramente:
```
[main] Mapeamento para item 2791009 não tem item_porcionado_id configurado
Pedido 179561706 processado: 0 itens baixados
```

### Situação Atual

| Item | cardapio_item_id | item_porcionado_id | Status |
|------|-----------------|-------------------|--------|
| Grande - 1 Sabor | 2791009 | **NULL** | Sem vínculo |
| CALABRESA (G) | 1036576 | 5071a067... | Vinculado |

### Problema

O CardápioWeb envia **"Grande - 1 Sabor"** (item genérico) como o produto principal. Os complementos (sabores como CALABRESA) existem no banco mas **não estão sendo enviados pela API do CardápioWeb na estrutura `complements`** - ou seja, a API não retorna os sabores escolhidos, apenas o tamanho da pizza.

### Evidência

Nos logs, não aparece a mensagem:
```
Processando X complementos do item Grande - 1 Sabor
```

Isso significa que `item.complements` está vazio ou não existe na resposta da API.

---

## Soluções

### Opção 1: Vincular Item Principal (RECOMENDADA - Funciona Imediatamente)

Como o CardápioWeb só envia "Grande - 1 Sabor", você precisa vincular **esse item** aos porcionados base:

1. Na tela de **Mapeamento**, localize "Grande - 1 Sabor" (código 2791009)
2. No dropdown "Vincular item...", selecione **MASSA GRANDE** (ou equivalente)
3. Clique em "+ Adicionar item" para vincular também **MUSSARELA GRANDE**
4. Faça uma nova venda de teste

### Opção 2: Melhorar Logging da API (Para Diagnóstico)

Modificar a edge function para logar a estrutura completa dos items recebidos:

```typescript
// No arquivo supabase/functions/cardapio-web-webhook/index.ts
// Adicionar log detalhado após receber os dados:

for (const item of orderData.items) {
  console.log(`Item recebido: ${JSON.stringify(item)}`);
  // ... resto do código
}
```

Isso nos mostrará exatamente o que a API está enviando, incluindo se há `complements` ou não.

### Opção 3: Verificar Resposta Completa da API

Aumentar o limite do log de 500 para 5000 caracteres para ver a estrutura completa:

```typescript
// Linha 119 atual:
console.log('Detalhes do pedido recebidos:', JSON.stringify(data, null, 2).substring(0, 500));

// Mudar para:
console.log('Detalhes do pedido recebidos:', JSON.stringify(data, null, 2).substring(0, 5000));
```

---

## Implementação Proposta

### Arquivo: `supabase/functions/cardapio-web-webhook/index.ts`

1. Aumentar limite do log para ver resposta completa
2. Adicionar log detalhado de cada item processado
3. Logar estrutura de complementos (mesmo se vazio)

```typescript
// Após obter orderData.items:
for (const item of orderData.items) {
  console.log(`📦 Item: id=${item.item_id}, nome="${item.name}", qty=${item.quantity}`);
  console.log(`   Complements: ${item.complements ? item.complements.length : 0} itens`);
  if (item.complements && item.complements.length > 0) {
    for (const c of item.complements) {
      console.log(`   ↳ ${c.name} (id=${c.id || c.item_id || 'N/A'})`);
    }
  }
}
```

---

## Resumo

**Ação imediata necessária:** Vincule o item "Grande - 1 Sabor" (2791009) aos items porcionados MASSA e MUSSARELA na tela de mapeamento.

**Se preferir**, posso implementar logs mais detalhados para verificar exatamente o que a API do CardápioWeb está retornando, antes de você fazer o vínculo manual.
