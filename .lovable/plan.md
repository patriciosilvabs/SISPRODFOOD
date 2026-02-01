
# Plano: Corrigir Fórmula de `a_produzir` - Remover Vendas Web do Cálculo

## Diagnóstico do Problema

A fórmula atual está **conceitualmente errada**:

| Situação | Sobra | Ideal | Vendas Web | a_produzir Atual | a_produzir Correto |
|----------|-------|-------|------------|------------------|-------------------|
| Estoque OK | 100 | 100 | 102 | **102** ❌ | **0** ✅ |
| Precisa repor | 50 | 100 | 20 | 70 ❌ | **50** ✅ |
| Sem estoque | 0 | 100 | 0 | 100 ✅ | 100 ✅ |

### Por que a fórmula está errada?

O campo `final_sobra` representa o **estoque físico real** que existe na loja **neste momento**. Se o funcionário contou 100 unidades, significa que:

1. A loja **TEM** 100 unidades físicas
2. Vendas anteriores **já foram atendidas** (com estoque anterior ou produção)
3. Se o ideal é 100 e tem 100, **não precisa produzir nada**

O `cardapio_web_baixa_total` é apenas um campo de **auditoria/rastreamento** - não deve influenciar a necessidade de produção.

---

## Solução: Remover `cardapio_web_baixa_total` da Fórmula

```text
FÓRMULA ATUAL (ERRADA):
a_produzir = MAX(0, (ideal - sobra) + vendas_web)

FÓRMULA CORRETA:
a_produzir = MAX(0, ideal - sobra)
```

---

## Mudanças Necessárias

### 1. Migration SQL - Recriar Coluna Gerada

```sql
ALTER TABLE contagem_porcionados 
DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados 
ADD COLUMN a_produzir integer 
GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))
) STORED;
```

### 2. Edge Function - Apenas Atualizar Campos de Auditoria

O webhook do Cardápio Web continua atualizando apenas os campos de rastreamento:
- `cardapio_web_baixa_total` (acumulado do dia)
- `cardapio_web_ultima_baixa_at` (timestamp)
- `cardapio_web_ultima_baixa_qtd` (quantidade da última baixa)

E **não** precisa calcular `a_produzir` - o banco faz automaticamente.

---

## Fluxo Operacional Correto

```text
CENÁRIO 1: Loja com estoque cheio
├── Sobra física: 100
├── Ideal: 100
├── Vendas web acumuladas: 102 (apenas auditoria)
└── A Produzir: MAX(0, 100 - 100) = 0 ✅

CENÁRIO 2: Loja precisa repor
├── Sobra física: 30
├── Ideal: 100
├── Vendas web acumuladas: 50 (apenas auditoria)
└── A Produzir: MAX(0, 100 - 30) = 70 ✅

CENÁRIO 3: Loja sem estoque
├── Sobra física: 0
├── Ideal: 100
├── Vendas web acumuladas: 0
└── A Produzir: MAX(0, 100 - 0) = 100 ✅
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **Migration SQL** | Recriar coluna `a_produzir` com fórmula simplificada |
| `supabase/functions/cardapio-web-webhook/index.ts` | Remover logs de cálculo de `a_produzir` (opcional, cosmético) |

---

## Vantagens

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Precisão** | Sobra=100, Ideal=100 → A Produzir=102 ❌ | A Produzir=0 ✅ |
| **Clareza** | Vendas influenciam produção | Apenas estoque físico vs ideal |
| **Auditoria** | Campos misturados | Campos separados (sobra vs vendas) |
