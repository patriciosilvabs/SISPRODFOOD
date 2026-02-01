

# Plano: Corrigir Processamento de OPTIONS (não complements)

## Problema Identificado

A API do CardápioWeb usa **`options`** em vez de **`complements`**:

```
Estrutura Real:
item.options = [
  { option_id: 2001010, name: "# Massa Tradicional" },
  { option_id: 1036576, name: "CALABRESA (G)" }   ← VINCULADO!
]
```

O código atual procura `item.complements` que sempre está vazio.

## Solução

Modificar a edge function para processar `item.options` usando `option_id`:

### Arquivo: `supabase/functions/cardapio-web-webhook/index.ts`

**Mudança principal:**

```typescript
// ANTES (errado):
if (item.complements && item.complements.length > 0) {
  for (const c of item.complements) {
    processItem(c.id || c.item_id, c.name, ...);
  }
}

// DEPOIS (correto):
if (item.options && item.options.length > 0) {
  for (const opt of item.options) {
    processItem(opt.option_id, opt.name, item.quantity * (opt.quantity || 1));
  }
}
```

## Resultado Esperado

Após esta correção:

| Item no Pedido | option_id | Mapeamento | Resultado |
|---------------|-----------|------------|-----------|
| CALABRESA (G) | 1036576 | ✅ Vinculado | **Baixa estoque** |
| Massa Tradicional | 2001010 | ⚠️ Sem vínculo | Ignora (não baixa) |

A próxima venda de pizza com sabor CALABRESA vai baixar automaticamente o estoque do item porcionado vinculado.

## Arquivos a Modificar

1. `supabase/functions/cardapio-web-webhook/index.ts`
   - Linha ~409: Alterar loop de `complements` para `options`
   - Usar `opt.option_id` em vez de `c.id`
   - Manter logs para diagnóstico

