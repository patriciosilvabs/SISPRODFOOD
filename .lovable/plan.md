

# Plano: Corrigir Coluna Gerada `a_produzir`

## Diagnóstico do Erro

A imagem mostra o erro:
```
column "a_produzir" can only be updated to DEFAULT
```

### Causa Raiz

| Componente | Problema |
|------------|----------|
| **Banco de Dados** | `a_produzir` é uma coluna GENERATED com fórmula `GREATEST(0, (ideal_amanha - final_sobra))` |
| **Edge Function** | Tenta fazer `UPDATE ... a_produzir = novoAProduzir` (linhas 542 e 576) |
| **Fórmula Atual** | NÃO inclui `cardapio_web_baixa_total` - ignora vendas web |

---

## Solução em Duas Partes

### 1. Atualizar Fórmula da Coluna Gerada

A fórmula precisa ser alterada de:
```sql
-- ANTES (ignora vendas web):
a_produzir = GREATEST(0, (ideal_amanha - final_sobra))

-- DEPOIS (modelo 3 camadas):
a_produzir = GREATEST(0, (ideal_amanha - COALESCE(final_sobra, 0)) + COALESCE(cardapio_web_baixa_total, 0))
```

Isso significa que o `a_produzir` será calculado automaticamente assim:
- `100 (ideal) - 50 (sobra) + 15 (vendas) = 65 unidades a produzir`

### 2. Remover Tentativa de UPDATE na Edge Function

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

Remover `a_produzir` de todos os INSERTs e UPDATEs, já que será calculado automaticamente pelo banco:

```typescript
// Linha 542 - REMOVER a_produzir do INSERT:
.insert({
  loja_id,
  item_porcionado_id: mapping.item_porcionado_id,
  organization_id,
  dia_operacional: diaOperacional,
  final_sobra: 0,
  ideal_amanha: idealDoDia,
  // a_produzir: REMOVER - é coluna gerada
  usuario_id: '00000000-0000-0000-0000-000000000000',
  usuario_nome: 'Cardápio Web',
  cardapio_web_baixa_total: novoTotalBaixas,
  cardapio_web_ultima_baixa_at: agora,
  cardapio_web_ultima_baixa_qtd: quantidadeTotal,
})

// Linha 576 - REMOVER a_produzir do UPDATE:
.update({ 
  ideal_amanha: idealDoDia,
  // a_produzir: REMOVER - é coluna gerada
  updated_at: agora,
  cardapio_web_baixa_total: novoTotalBaixas,
  cardapio_web_ultima_baixa_at: agora,
  cardapio_web_ultima_baixa_qtd: quantidadeTotal,
})
```

---

## Fluxo Após Correção

```text
1. Webhook recebe venda de 5 unidades
         ↓
2. Edge Function atualiza APENAS:
   - cardapio_web_baixa_total = 5
   - ideal_amanha = 100 (do dia)
         ↓
3. Banco de dados CALCULA automaticamente:
   a_produzir = GREATEST(0, (100 - 0) + 5) = 105
         ↓
4. Frontend lê a_produzir = 105 ✅
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **Migration SQL** | Recriar coluna gerada com nova fórmula incluindo `cardapio_web_baixa_total` |
| `supabase/functions/cardapio-web-webhook/index.ts` | Remover `a_produzir` dos INSERTs/UPDATEs |

---

## Migration SQL

```sql
-- Recriar a coluna a_produzir com a nova fórmula do modelo 3 camadas
ALTER TABLE contagem_porcionados 
DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados 
ADD COLUMN a_produzir integer 
GENERATED ALWAYS AS (
  GREATEST(0, (COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0)) + COALESCE(cardapio_web_baixa_total, 0))
) STORED;
```

---

## Vantagens da Solução

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Consistência** | Fórmula no código E no banco | Fórmula apenas no banco |
| **Manutenção** | Precisa sincronizar dois lugares | Única fonte de verdade |
| **Erro de update** | Falha ao tentar atualizar coluna gerada | Nunca tenta atualizar |
| **Cálculo** | Ignora vendas web | Inclui vendas web automaticamente |

