
# Plano: Vincular Item "Grande - 1 Sabor" que está chegando no webhook

## Diagnóstico Confirmado

A API está funcionando! O problema é que o item chegando nos pedidos é diferente do que foi mapeado:

| O que está mapeado | O que chega no webhook |
|-------------------|----------------------|
| CALABRESA (G) - código `1036576` | Grande - 1 Sabor - código `2791009` |

O CardápioWeb envia o **produto pai** (pizza genérica), não o sabor específico. Você precisa vincular o item "Grande - 1 Sabor".

## Solução Imediata (Manual)

1. Na tela de **Mapeamento do Cardápio Web**, procure pelo item **"Grande - 1 Sabor"** (código `2791009`)
2. Vincule esse item aos itens porcionados MASSA e MUSSARELA
3. Faça uma nova venda de teste

## Solução Técnica (Opcional - Processar Complementos)

Se quiser que o sistema processe também os **sabores/complementos** que vêm junto no pedido, posso modificar a edge function para:

1. Além do item principal, processar também os `complements` que vêm na API
2. Os complementos trazem o código do sabor específico (CALABRESA, etc)

### Modificação na Edge Function

No arquivo `supabase/functions/cardapio-web-webhook/index.ts`:

```typescript
for (const item of orderData.items) {
  // Processar item principal
  processarItem(item.item_id, item.name, item.quantity);
  
  // Processar COMPLEMENTOS (sabores, opcionais, etc)
  if (item.complements && item.complements.length > 0) {
    for (const complement of item.complements) {
      // Verificar se temos complement.id ou outro identificador
      if (complement.id) {
        processarItem(complement.id, complement.name, item.quantity);
      }
    }
  }
}
```

Isso permitiria processar tanto o produto principal quanto os sabores específicos.

## Resumo

### Opção 1 - Rápida (Recomendada)
- Vincule o item "Grande - 1 Sabor" aos porcionados (MASSA + MUSSARELA)
- Funciona imediatamente

### Opção 2 - Completa
- Implementar processamento de complementos
- Permite baixar estoque baseado no sabor específico (ex: Calabresa baixa pepperoni)

Qual opção você prefere?
