

# Plano: Corrigir Lógica do Webhook - Decremento de Estoque

## Diagnóstico do Problema

### Dados Atuais no Banco
| Item | Ideal | Final Sobra | A Produzir | Vendas Web |
|------|-------|-------------|------------|------------|
| MASSA | 140 | 240 | 0 | 506 |
| MUSSARELA | 140 | 240 | 0 | 506 |

### Fórmula no Banco (coluna `a_produzir`)
```sql
a_produzir = GREATEST(0, ideal_amanha - final_sobra)
```

### O Que Está Acontecendo
O webhook está **SOMANDO** vendas ao `final_sobra`:
- Venda 1 (50): `final_sobra = 0 + 50 = 50`
- Venda 2 (50): `final_sobra = 50 + 50 = 100`
- ... (acumulando infinitamente)

Resultado: `final_sobra = 240` > `ideal = 140` → `a_produzir = 0` ❌

## O Que o Usuário Precisa

| Campo | Significado | Exemplo |
|-------|-------------|---------|
| **Ideal** | Produção total planejada | 140 |
| **Vendas Cardápio Web** | O que foi vendido/consumido | 50 |
| **A Produzir** | Ideal - Vendas = o que falta produzir | **90** |

## Solução Correta

O campo `final_sobra` deve representar o **estoque disponível** (o que resta após as vendas), NÃO as vendas acumuladas.

### Nova Lógica do Webhook

**Cenário 1: Criar nova contagem (não existe registro)**
```typescript
// Se não existe contagem, iniciar com ideal e decrementar a venda
const novoFinalSobra = Math.max(0, idealDoDia - quantidadeTotal)
// Exemplo: ideal=140, vendas=50 → final_sobra = 90
// a_produzir = 140 - 90 = 50... AINDA ERRADO!
```

**ESPERA!** A fórmula do banco `a_produzir = ideal - final_sobra` está projetada para:
- `final_sobra` = estoque físico restante na loja
- `a_produzir` = quanto precisa produzir para completar

Mas o usuário quer que **A Produzir = o que resta após descontar as vendas** (o oposto!).

### Entendimento Final

O usuário quer:
```
A Produzir = Ideal - Vendas = 140 - 50 = 90
```

Isso significa que `final_sobra` deve armazenar as **vendas** (não o estoque), e a fórmula precisa ser ajustada.

**OU** manter a fórmula atual e fazer:
- `final_sobra = vendas = 50`
- `a_produzir = ideal - final_sobra = 140 - 50 = 90` ✓

## Alterações Necessárias

### Arquivo: `supabase/functions/cardapio-web-webhook/index.ts`

**Cenário 1: Criar nova contagem (linhas 556-557)**
```typescript
// ATUAL (errado - acumula):
const novoFinalSobra = quantidadeTotal

// CORRETO - Vendas viram final_sobra (para que ideal - final_sobra = a_produzir):
const novoFinalSobra = quantidadeTotal // MANTER ASSIM
```

**Cenário 2: Atualizar contagem existente (linhas 592-593)**
```typescript
// ATUAL (errado - soma infinitamente):
const vendasAcumuladas = contagem.final_sobra ?? 0
const novoFinalSobra = vendasAcumuladas + quantidadeTotal // SOMA ERRADA!

// CORRETO - Substituir, não acumular:
const cardapioWebTotal = ((contagem as unknown as Record<string, number>).cardapio_web_baixa_total || 0) + quantidadeTotal
const novoFinalSobra = cardapioWebTotal // Total de vendas web = final_sobra
```

### Problema Identificado
O código está somando `final_sobra + quantidadeTotal` quando deveria usar apenas o `cardapio_web_baixa_total` atualizado.

## Fluxo Corrigido

```text
DIA OPERACIONAL INICIA:
├── ideal_amanha = 140
└── final_sobra = 0 (sem vendas ainda)

PRIMEIRA VENDA (50 pizzas):
├── cardapio_web_baixa_total = 0 + 50 = 50
├── final_sobra = 50 (= total vendas web)
├── a_produzir = 140 - 50 = 90 ✓
└── Tela mostra: Sobra=50, A Produzir=90

SEGUNDA VENDA (10 pizzas):
├── cardapio_web_baixa_total = 50 + 10 = 60
├── final_sobra = 60 (= total vendas web)
├── a_produzir = 140 - 60 = 80 ✓
└── Tela mostra: Sobra=60, A Produzir=80
```

## Resultado Esperado

| Campo | Valor | Cor |
|-------|-------|-----|
| Ideal | 140 | - |
| Sobra (vendas web) | **50** | Azul |
| A Produzir | **90** | Laranja |

## Detalhes Técnicos

**Arquivo a modificar:**
- `supabase/functions/cardapio-web-webhook/index.ts`

**Mudança principal (linha 593):**
```typescript
// DE:
const novoFinalSobra = vendasAcumuladas + quantidadeTotal

// PARA:
const novoFinalSobra = novoTotalBaixas // Usar o total atualizado de baixas web
```

A variável `novoTotalBaixas` já calcula corretamente o acumulado. O erro estava em usar `final_sobra` anterior + nova venda, quando deveria usar apenas `cardapio_web_baixa_total` atualizado.

