

# Plano: Implementar Modelo "Tanque Cheio" - Lógica de Reposição

## Modelo Atual (ERRADO)

```
final_sobra = vendas_acumuladas = 50
a_produzir = ideal - final_sobra = 140 - 50 = 90  ❌
```

O funcionário vê "A Produzir = 90" quando deveria ver "50".

## Modelo Correto (Tanque Cheio)

```
final_sobra = ideal - vendas = 140 - 50 = 90  (saldo no tanque)
a_produzir = ideal - final_sobra = 140 - 90 = 50  ✅
```

O funcionário vê "A Produzir = 50" (exatamente o que foi vendido).

## Analogia Visual

```text
TANQUE CHEIO (início do dia):
┌────────────┐
│████████████│ ← Ideal: 140 (tanque cheio)
│████████████│
│████████████│
└────────────┘

APÓS 50 VENDAS:
┌────────────┐
│            │ ← Espaço vazio: 50 (A Produzir)
│████████████│
│████████████│ ← Saldo restante: 90 (final_sobra)
└────────────┘
```

## Alterações no Edge Function

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

### Cenário 1: Criar nova contagem (linha 557)

```typescript
// DE (atual - vendas vão para sobra):
const novoFinalSobra = quantidadeTotal

// PARA (modelo tanque cheio - sobra = ideal - vendas):
const novoFinalSobra = Math.max(0, idealDoDia - quantidadeTotal)
```

### Cenário 2: Atualizar contagem existente (linha 595)

```typescript
// DE (atual - vendas acumuladas vão para sobra):
const vendasAnteriores = contagem.cardapio_web_baixa_total || 0
const novoTotalBaixas = vendasAnteriores + quantidadeTotal
const novoFinalSobra = novoTotalBaixas  // ERRADO!

// PARA (modelo tanque cheio - sobra = ideal - vendas_totais):
const vendasAnteriores = contagem.cardapio_web_baixa_total || 0
const novoTotalBaixas = vendasAnteriores + quantidadeTotal
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas)  // CORRETO!
```

## Fluxo Corrigido

```text
INÍCIO DO DIA OPERACIONAL:
├── ideal_amanha = 140
├── final_sobra = 140 (tanque cheio)
└── a_produzir = 0

PRIMEIRA VENDA (50 pizzas):
├── cardapio_web_baixa_total = 0 + 50 = 50
├── final_sobra = 140 - 50 = 90 (saldo restante)
├── a_produzir = 140 - 90 = 50 ✓ (o que foi vendido)
└── Tela: Azul=90, Laranja=50

SEGUNDA VENDA (10 pizzas):
├── cardapio_web_baixa_total = 50 + 10 = 60
├── final_sobra = 140 - 60 = 80 (saldo restante)
├── a_produzir = 140 - 80 = 60 ✓ (total vendido)
└── Tela: Azul=80, Laranja=60
```

## Resultado Esperado na Tela

| Campo | Valor | Significado |
|-------|-------|-------------|
| Ideal | 140 | Capacidade total do tanque |
| Sobra (azul) | **90** | Saldo restante no tanque |
| A Produzir (laranja) | **50** | O que foi consumido/vendido |

## Detalhes Técnicos

**Arquivo a modificar:**
- `supabase/functions/cardapio-web-webhook/index.ts`

**Mudanças específicas:**

1. **Linha 557** (nova contagem):
   - DE: `const novoFinalSobra = quantidadeTotal`
   - PARA: `const novoFinalSobra = Math.max(0, idealDoDia - quantidadeTotal)`

2. **Linha 595** (atualização):
   - DE: `const novoFinalSobra = novoTotalBaixas`
   - PARA: `const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas)`

3. **Atualizar logs** para refletir o novo modelo:
   - "saldo_restante" em vez de "vendas_acumuladas"

## Benefício para o Funcionário

- **Segunda-feira** (Ideal 100): Se vendeu 1, Azul=99, Laranja=**1** → Produz 1
- **Sexta-feira** (Ideal 180): Se vendeu 1, Azul=179, Laranja=**1** → Produz 1

O laranja sempre mostra exatamente o que foi vendido = o que precisa produzir.

