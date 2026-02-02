

# Plano: Modelo Decremento - Sobra Inicia no Ideal e Desconta Vendas

## Entendimento do Requisito

A lógica correta é simples:
1. **Sobra inicia com o valor do Ideal** (ex: 140)
2. **Cada venda do Cardápio Web DESCONTA** da sobra

### Comportamento Esperado

| Ação | `final_sobra` |
|------|---------------|
| Sobra inicia com ideal | **140** |
| Cardápio Web envia 1 venda (1 pizza) | **139** (140 - 1) |
| Cardápio Web envia 1 venda (10 pizzas) | **129** (139 - 10) |

## Problema Atual

O código atual está **SOMANDO** as vendas:
```typescript
const novoFinalSobra = estoqueAtual + quantidadeTotal  // ❌ ERRADO
```

## Alterações Necessárias

### Edge Function: `supabase/functions/cardapio-web-webhook/index.ts`

**Cenário 1: Contagem não existe (linhas 523-559)**

Quando não há contagem para o dia, criar uma nova iniciando com `ideal - venda`:
```typescript
// DE (modelo soma):
const novoFinalSobra = quantidadeTotal

// PARA (modelo decremento):
const novoFinalSobra = Math.max(0, idealDoDia - quantidadeTotal)
```

**Cenário 2: Contagem já existe (linhas 560-593)**

Quando já existe contagem, descontar da sobra atual:
```typescript
// DE (modelo soma):
const novoFinalSobra = estoqueAtual + quantidadeTotal

// PARA (modelo decremento):
const novoFinalSobra = Math.max(0, estoqueAtual - quantidadeTotal)
```

## Fluxo Completo

```text
DIA OPERACIONAL INICIA:
├── ideal_amanha = 140
└── final_sobra = (ainda não existe contagem)

PRIMEIRA VENDA (1 pizza) - cria contagem:
├── ideal = 140
├── quantidadeTotal = 1
├── novoFinalSobra = 140 - 1 = 139 ✓
└── cardapio_web_baixa_total = 1

SEGUNDA VENDA (10 pizzas) - atualiza contagem:
├── estoqueAtual = 139
├── quantidadeTotal = 10
├── novoFinalSobra = 139 - 10 = 129 ✓
└── cardapio_web_baixa_total = 11
```

## Impacto na Produção

Com `a_produzir = MAX(0, ideal - final_sobra)`:
- `ideal = 140`, `final_sobra = 129` → `a_produzir = 11`

Isso significa que quanto mais vendas, **MENOR** o `final_sobra` e **MAIOR** o `a_produzir`.

## Detalhes Técnicos

Arquivos a modificar:
- `supabase/functions/cardapio-web-webhook/index.ts` (linhas 523-593)

Mudanças específicas:
1. **Linha 528**: `novoFinalSobra = quantidadeTotal` → `novoFinalSobra = Math.max(0, idealDoDia - quantidadeTotal)`
2. **Linha 564**: `novoFinalSobra = estoqueAtual + quantidadeTotal` → `novoFinalSobra = Math.max(0, estoqueAtual - quantidadeTotal)`
3. Atualizar comentários e logs para refletir o modelo "decremento"

