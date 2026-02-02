

# Plano: Somar Vendas à Coluna Sobra (Não Subtrair)

## Entendimento do Requisito

A lógica atual está **invertida**. Você quer que cada venda do Cardápio Web seja **SOMADA** ao valor atual da coluna sobra.

### Exemplo do Comportamento Esperado

| Ação | `final_sobra` |
|------|---------------|
| Item "MASSA" começa com | **3** |
| Cardápio Web envia 1 venda | **4** (3 + 1) |
| Cardápio Web envia mais 2 vendas | **6** (4 + 2) |

## Alteração Necessária

### Edge Function: `supabase/functions/cardapio-web-webhook/index.ts`

**Linhas 560-591** - Atualização de contagem existente:

```typescript
// DE (modelo substituição - subtrai):
const novoTotalBaixas = (contagem.cardapio_web_baixa_total || 0) + quantidadeTotal;
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas);

// PARA (modelo soma - adiciona vendas à sobra):
const estoqueAtual = contagem.final_sobra ?? 0;
const novoFinalSobra = estoqueAtual + quantidadeTotal;
const novoTotalBaixas = (contagem.cardapio_web_baixa_total || 0) + quantidadeTotal;
```

**Linhas 523-559** - Criação de nova contagem:

```typescript
// DE (modelo substituição):
const novoTotalBaixas = quantidadeTotal;
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas);

// PARA (modelo soma):
const novoTotalBaixas = quantidadeTotal;
const novoFinalSobra = quantidadeTotal; // Começa com a quantidade da venda
```

## Fluxo Corrigido

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

## Impacto na Coluna "A Produzir"

Com a fórmula atual do banco (`a_produzir = MAX(0, ideal - final_sobra)`):
- Se `ideal = 10` e `final_sobra = 6`, então `a_produzir = 4`

**Atenção**: Isso significa que quanto mais vendas, MAIOR o `final_sobra` e MENOR o `a_produzir`. Isso está correto para você?

## Resumo da Mudança

| Modelo | Fórmula | Resultado |
|--------|---------|-----------|
| ~~Atual (substituição)~~ | `sobra = ideal - vendas` | Vendas diminuem sobra |
| **Novo (soma)** | `sobra = sobra_atual + vendas` | Vendas aumentam sobra |

