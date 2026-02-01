

# Plano: Simplificar Modelo - Webhook Alimenta Diretamente o Botão Azul

## Diagnóstico do Problema Atual

O modelo de 3 camadas está gerando valores incorretos:

| Campo | Valor Atual | Problema |
|-------|-------------|----------|
| `ideal_amanha` | 100 | ✅ Correto |
| `final_sobra` | 100 | Não usado no cálculo |
| `cardapio_web_baixa_total` | 105 | ⚠️ Acumulando vendas |
| `a_produzir` | **105** | ❌ Deveria ser no máximo 100! |
| `saldo_atual` | 0 | Correto (100 - 105 = 0) |

### Causa Raiz

A fórmula atual é:
```sql
a_produzir = GREATEST(0, cardapio_web_baixa_total)  -- Apenas vendas!
```

Isso ignora o `final_sobra` e permite valores maiores que o ideal.

---

## Solução: Webhook Decrementa `final_sobra` Diretamente

A ideia do usuário é muito mais simples e elegante:

```text
MODELO ATUAL (Complexo - 3 camadas):
├── final_sobra = 100 (funcionário/manual)
├── cardapio_web_baixa_total = 105 (rastreamento)
├── a_produzir = 105 (vendas diretas)
└── saldo_atual = 0 (calculado)

MODELO PROPOSTO (Simples - alimentar azul):
├── final_sobra = -5 (100 inicial - 105 vendas)
│   ou GREATEST(0, final_sobra) se não quiser negativo
├── a_produzir = MAX(0, ideal - final_sobra) = 100
└── Não precisa de cardapio_web_baixa_total no cálculo
```

### Fluxo Simplificado

1. **Início do dia**: `final_sobra = ideal_amanha` (ex: 100)
2. **Venda chega**: `final_sobra -= quantidade_vendida` (99, 98, 97...)
3. **Cálculo**: `a_produzir = MAX(0, ideal - final_sobra)`

---

## Mudanças Técnicas

### 1. Migration SQL - Restaurar Fórmula Original

```sql
-- Recriar a_produzir como ideal - final_sobra (fórmula clássica)
ALTER TABLE contagem_porcionados DROP COLUMN a_produzir;
ALTER TABLE contagem_porcionados DROP COLUMN saldo_atual;

ALTER TABLE contagem_porcionados 
ADD COLUMN a_produzir integer 
GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))
) STORED;

-- OPCIONAL: Adicionar coluna para não permitir negativo
COMMENT ON COLUMN contagem_porcionados.final_sobra IS 
  'Estoque atual (inicia com ideal, decrementado pelas vendas)';
```

### 2. Edge Function - Webhook Decrementa `final_sobra`

Alterar `supabase/functions/cardapio-web-webhook/index.ts`:

```typescript
// ANTES (modelo complexo):
// Atualiza cardapio_web_baixa_total, não mexe em final_sobra

// DEPOIS (modelo simples):
// Decrementa final_sobra diretamente
const novoFinalSobra = Math.max(0, (contagem.final_sobra || 0) - quantidadeTotal);

await supabase
  .from('contagem_porcionados')
  .update({ 
    final_sobra: novoFinalSobra,  // DECREMENTAR DIRETO!
    // cardapio_web_baixa_total permanece para auditoria
    cardapio_web_baixa_total: novoTotalBaixas,
    // ...
  })
  .eq('id', contagem.id)
```

### 3. Inicialização do Dia

Quando criar nova contagem para o dia:
```typescript
// ANTES: final_sobra = 0 (funcionário não contou)
// DEPOIS: final_sobra = ideal_amanha (começa cheio)

const { error: insertError } = await supabase
  .from('contagem_porcionados')
  .insert({
    final_sobra: idealDoDia,  // INICIAR COM IDEAL!
    ideal_amanha: idealDoDia,
    // ...
  })
```

---

## Comparação de Modelos

| Cenário | Modelo Atual | Modelo Proposto |
|---------|--------------|-----------------|
| Início do dia | final_sobra=0, ideal=100, a_produzir=0 | final_sobra=100, ideal=100, a_produzir=0 |
| Após 2 vendas | final_sobra=0, vendas=2, a_produzir=**2** | final_sobra=98, a_produzir=**2** ✅ |
| Após 105 vendas | final_sobra=0, vendas=105, a_produzir=**105** ❌ | final_sobra=0 (mínimo), a_produzir=**100** ✅ |

### Vantagens do Modelo Proposto

- **Simplicidade**: Apenas 1 campo (final_sobra) reflete o estado atual
- **Teto natural**: a_produzir nunca excede o ideal (GREATEST(0, ideal - final_sobra))
- **Visual intuitivo**: Funcionário vê "estoque virtual" diminuindo
- **Mantém auditoria**: cardapio_web_baixa_total ainda rastreia vendas totais

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Migration SQL** | Recriar `a_produzir = ideal - final_sobra`, remover `saldo_atual` |
| `supabase/functions/cardapio-web-webhook/index.ts` | Decrementar `final_sobra` em vez de apenas incrementar `cardapio_web_baixa_total` |
| `.lovable/plan.md` | Atualizar documentação |

---

## Regra de Contagem Manual

O funcionário ainda pode ajustar `final_sobra` manualmente via interface:
- Se a contagem física for diferente do "virtual", ele corrige
- O sistema aceita o valor informado
- Isso é útil para ajustes/correções

---

## Fluxo Visual Final

```text
┌─────────────────────────────────────────────────────────────┐
│  Item: PIZZA CALABRESA                                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  ESTOQUE ATUAL   │  │  IDEAL   │  │    A PRODUZIR      │ │
│  │  (Botão Azul)    │  │   100    │  │   (Laranja)        │ │
│  │ ──────────────── │  │          │  │ ───────────────    │ │
│  │       98         │  │          │  │        2           │ │
│  │ (100 - 2 vendas) │  │          │  │  (100 - 98)        │ │
│  └──────────────────┘  └──────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

