
# Plano: Corrigir Limpeza do Painel de Status (Coluna Gerada)

## Problema Identificado

O erro no console mostra claramente:

```
"Column \"a_produzir\" is a generated column."
"column \"a_produzir\" can only be updated to DEFAULT"
```

O campo `a_produzir` é uma **coluna calculada (GENERATED)** no PostgreSQL:

```sql
a_produzir INTEGER GENERATED ALWAYS AS (GREATEST(0, ideal_amanha - final_sobra)) STORED
```

Isso significa que:
- `a_produzir` é calculado automaticamente: `ideal_amanha - final_sobra` (mínimo 0)
- **Não é possível** atualizar diretamente uma coluna GENERATED
- Para zerar `a_produzir`, precisamos atualizar os campos de origem

## Solução

Atualizar `ideal_amanha = 0` em vez de `a_produzir = 0`.

Quando `ideal_amanha = 0`:
- `a_produzir = GREATEST(0, 0 - final_sobra) = 0`

## Alteração

### Arquivo: `src/pages/ResumoDaProducao.tsx`

| Linha | Antes | Depois |
|-------|-------|--------|
| 308 | `{ a_produzir: 0 }` | `{ ideal_amanha: 0 }` |

```typescript
// ANTES (linha 306-310)
const { error: errorContagem } = await supabase
  .from('contagem_porcionados')
  .update({ a_produzir: 0 })  // ❌ ERRO: coluna gerada
  .eq('organization_id', organizationId)
  .eq('dia_operacional', hoje);

// DEPOIS
const { error: errorContagem } = await supabase
  .from('contagem_porcionados')
  .update({ ideal_amanha: 0 })  // ✅ Correto: coluna editável
  .eq('organization_id', organizationId)
  .eq('dia_operacional', hoje);
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Clicar em Limpar | Erro no console, painel mantém dados | Painel limpo corretamente |
| `a_produzir` calculado | Mantém valor antigo | Fica 0 (ideal_amanha - final_sobra = 0 - X ≤ 0) |

## Observação

A limpeza zera `ideal_amanha`, o que significa que:
- O estoque físico (`final_sobra`) é preservado
- A demanda planejada é zerada
- As lojas precisarão informar nova contagem para gerar demanda
