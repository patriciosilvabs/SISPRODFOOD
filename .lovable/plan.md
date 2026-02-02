
# Plano: Unificar Ajustes Manuais e Automáticos no Cálculo de "A Produzir"

## Entendimento do Problema

A fórmula atual `a_produzir = MIN(ideal, vendas_web)` só considera vendas do Cardápio Web. Mas o usuário precisa que ajustes manuais nos botões de sobra (+ e -) também alterem a coluna "A Produzir".

### Exemplo do Problema

| Ação | `final_sobra` | `cardapio_web_baixa_total` | Fórmula Atual | Esperado |
|------|---------------|---------------------------|---------------|----------|
| Ideal = 140 | 140 | 0 | 0 | 0 |
| Usuário clica "-" 50x manualmente | 90 | 0 | 0 | **50** |
| Venda automática de 40 | 50 | 40 | 40 | **90** |

## Nova Lógica Proposta

A fórmula correta que considera **ambos os fluxos** (manual e automático) é:

```
a_produzir = MAX(0, ideal_amanha - final_sobra)
```

### Por que funciona?

1. **Vendas automáticas**: Decrementam `final_sobra` → aumenta `a_produzir`
2. **Ajustes manuais (-)**: Decrementam `final_sobra` → aumenta `a_produzir`
3. **Ajustes manuais (+)**: Incrementam `final_sobra` → diminui `a_produzir`

O campo `final_sobra` é o **"Estoque Virtual"** que reflete todas as movimentações. Usando-o diretamente na fórmula, ambos os fluxos são contemplados.

### Exemplo Corrigido

| Ação | `final_sobra` | `ideal` | `a_produzir` |
|------|---------------|---------|--------------|
| Início do dia | 140 | 140 | 0 |
| Usuário clica "-" 50x | 90 | 140 | **50** ✓ |
| Venda Web de 40 | 50 | 140 | **90** ✓ |
| Usuário clica "+" 10x | 60 | 140 | **80** ✓ |

## Alterações Necessárias

### 1. Migração de Banco de Dados

Alterar a coluna gerada `a_produzir`:

```sql
ALTER TABLE contagem_porcionados DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados
ADD COLUMN a_produzir integer GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))
) STORED;
```

### 2. Frontend: `src/pages/ContagemPorcionados.tsx`

**Linha ~1117-1120** - Exibição na UI:
```typescript
// DE:
const cardapioWebBaixaTotal = contagem?.cardapio_web_baixa_total || 0;
const aProduzir = Math.min(idealFromConfig, cardapioWebBaixaTotal);

// PARA:
const aProduzir = Math.max(0, idealFromConfig - finalSobra);
```

**Linha ~604-605** - Toast de confirmação:
```typescript
// DE:
const aProduzir = Math.min(idealAmanha, cardapioWebBaixaTotal);

// PARA:
const aProduzir = Math.max(0, idealAmanha - finalSobra);
```

## Fluxo Completo Corrigido

```text
DIA INICIA:
├── final_sobra = ideal_amanha (ex: 140)
└── a_produzir = MAX(0, 140 - 140) = 0

USUÁRIO AJUSTA MANUALMENTE (-50):
├── final_sobra = 90
└── a_produzir = MAX(0, 140 - 90) = 50 ✓

VENDA WEB DE 40 PIZZAS:
├── final_sobra decrementado para 50
├── cardapio_web_baixa_total = 40 (auditoria)
└── a_produzir = MAX(0, 140 - 50) = 90 ✓

USUÁRIO AJUSTA MANUALMENTE (+20):
├── final_sobra = 70
└── a_produzir = MAX(0, 140 - 70) = 70 ✓
```

## Benefícios

1. **Fluxo unificado**: Tanto ajustes manuais quanto vendas automáticas afetam "A Produzir"
2. **Feedback imediato**: A UI já usa `finalSobra` local, então a atualização é instantânea
3. **Simples e intuitivo**: Operador vê que diminuir sobra aumenta produção
4. **Auditoria preservada**: `cardapio_web_baixa_total` continua sendo registrado para rastreabilidade
