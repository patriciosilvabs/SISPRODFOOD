


# Plano: Somar Vendas à Coluna Sobra ✅ IMPLEMENTADO

## Entendimento do Requisito

Cada venda do Cardápio Web deve ser **SOMADA** ao valor atual da coluna sobra.

### Comportamento Implementado

| Ação | `final_sobra` |
|------|---------------|
| Item "MASSA" começa com | **3** |
| Cardápio Web envia 1 venda | **4** (3 + 1) |
| Cardápio Web envia mais 2 vendas | **6** (4 + 2) |

## Alteração Realizada

### Edge Function: `supabase/functions/cardapio-web-webhook/index.ts`

**Atualização de contagem existente:**

```typescript
// MODELO SOMA: final_sobra = sobra_atual + vendas
const estoqueAtual = contagem.final_sobra ?? 0;
const novoFinalSobra = estoqueAtual + quantidadeTotal;
const novoTotalBaixas = (contagem.cardapio_web_baixa_total || 0) + quantidadeTotal;
```

**Criação de nova contagem:**

```typescript
// MODELO SOMA: final_sobra = vendas (começa com a quantidade)
const novoTotalBaixas = quantidadeTotal;
const novoFinalSobra = quantidadeTotal;
```

## Fluxo Implementado

```text
ITEM "MASSA" JÁ EXISTE COM final_sobra = 3:

VENDA WEB DE 1 PIZZA:
├── estoqueAtual = 3
├── quantidadeTotal = 1
├── novoFinalSobra = 3 + 1 = 4 ✓
└── cardapio_web_baixa_total = 1 (auditoria)

VENDA WEB DE 2 PIZZAS:
├── estoqueAtual = 4
├── quantidadeTotal = 2
├── novoFinalSobra = 4 + 2 = 6 ✓
└── cardapio_web_baixa_total = 3 (auditoria)
```
