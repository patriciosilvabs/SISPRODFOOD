

# Plano: Corrigir Lógica de Cálculo - Vendas Direto na Sobra

## Entendimento do Requisito

A lógica que você precisa é simples:

| Valor | Descrição |
|-------|-----------|
| **Ideal** | 140 |
| **Vendas Cardápio Web** | 50 |
| **Sobra (campo azul)** | 50 (= as vendas que entraram) |
| **A Produzir (laranja)** | 90 (= 140 - 50 = o que falta produzir) |

## Problema Atual

O webhook está fazendo:
```
final_sobra = ideal - vendas = 140 - 50 = 90
a_produzir = ideal - final_sobra = 140 - 90 = 50  ❌
```

O correto deveria ser:
```
final_sobra = vendas = 50
a_produzir = ideal - final_sobra = 140 - 50 = 90  ✓
```

## Solução

### Alteração no Edge Function

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

**Cenário 1: Criar nova contagem (linhas 556-557)**

```typescript
// DE (atual - errado):
const novoFinalSobra = Math.max(0, idealDoDia - quantidadeTotal)

// PARA (correto):
const novoFinalSobra = quantidadeTotal  // Vendas vão direto para final_sobra
```

**Cenário 2: Atualizar contagem existente (linhas 592-593)**

```typescript
// DE (atual - errado):
const estoqueAtual = contagem.final_sobra ?? 0
const novoFinalSobra = Math.max(0, estoqueAtual - quantidadeTotal)

// PARA (correto - ACUMULA vendas):
const estoqueAtual = contagem.final_sobra ?? 0
const novoFinalSobra = estoqueAtual + quantidadeTotal  // Soma as novas vendas
```

## Fluxo Corrigido

```text
DIA OPERACIONAL INICIA:
├── ideal_amanha = 140
└── final_sobra = 0 (sem vendas ainda)

PRIMEIRA VENDA (50 pizzas):
├── final_sobra = 0 + 50 = 50 (acumula vendas)
├── a_produzir = 140 - 50 = 90 ✓
└── cardapio_web_baixa_total = 50

SEGUNDA VENDA (10 pizzas):
├── final_sobra = 50 + 10 = 60 (acumula vendas)
├── a_produzir = 140 - 60 = 80 ✓
└── cardapio_web_baixa_total = 60
```

## Significado dos Campos (Novo Modelo)

| Campo | Significado | Exemplo |
|-------|-------------|---------|
| `ideal_amanha` | Produção total planejada | 140 |
| `final_sobra` | Total de vendas acumuladas (consumo) | 50 |
| `a_produzir` | O que falta produzir (ideal - vendas) | 90 |

## Resultado Visual Esperado

| Coluna | Valor | Cor |
|--------|-------|-----|
| Sobra | **50** | Azul |
| A Produzir | **90** | Laranja |

## Detalhes Técnicos

Arquivos a modificar:
- `supabase/functions/cardapio-web-webhook/index.ts`

Linhas específicas:
1. **Linha 557**: Trocar `Math.max(0, idealDoDia - quantidadeTotal)` por `quantidadeTotal`
2. **Linha 593**: Trocar `Math.max(0, estoqueAtual - quantidadeTotal)` por `estoqueAtual + quantidadeTotal`
3. Atualizar logs para refletir "vendas acumuladas"

A fórmula do banco `a_produzir = ideal - final_sobra` permanece inalterada pois já está correta - só precisamos alimentar `final_sobra` com o valor correto (vendas, não resto).

