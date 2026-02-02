

# Plano: Corrigir Importação Criando Duplicatas

## Problema Identificado

| Problema | Causa |
|----------|-------|
| Planilha tem 287 itens | Esperado |
| Banco de dados tem 1.393 registros | **Duplicatas!** |
| Cada item aparece até 15 vezes | Constraint UNIQUE falha com NULL |

### Por que isso acontece?

A constraint UNIQUE atual inclui `item_porcionado_id`:
```sql
UNIQUE(organization_id, loja_id, cardapio_item_id, item_porcionado_id)
```

**O PostgreSQL trata cada NULL como um valor DISTINTO**, então a constraint não impede duplicatas quando `item_porcionado_id` é `NULL`.

```text
Registro 1: org=A, loja=1, item=123, item_porc=NULL  -- Inserido ✅
Registro 2: org=A, loja=1, item=123, item_porc=NULL  -- Inserido ✅ (NULL ≠ NULL)
Registro 3: org=A, loja=1, item=123, item_porc=NULL  -- Inserido ✅ (NULL ≠ NULL)
... repete a cada importação
```

## Solução

### 1. Database: Criar Unique Index PARCIAL

Usar um **índice único parcial** que funciona quando `item_porcionado_id IS NULL`:

```sql
-- Índice para quando NÃO há vínculo (item_porcionado_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS 
  mapeamento_cardapio_itens_org_loja_item_null_unique 
ON mapeamento_cardapio_itens(organization_id, loja_id, cardapio_item_id) 
WHERE item_porcionado_id IS NULL;
```

Este índice garante que só pode existir **UM registro por produto/loja** quando não há vínculo.

### 2. Database: Limpar Duplicatas Existentes

Antes de criar o índice, precisamos remover os registros duplicados:

```sql
-- Deletar duplicatas mantendo apenas o registro mais antigo
DELETE FROM mapeamento_cardapio_itens a
USING mapeamento_cardapio_itens b
WHERE a.id > b.id
  AND a.organization_id = b.organization_id
  AND a.loja_id = b.loja_id
  AND a.cardapio_item_id = b.cardapio_item_id
  AND a.item_porcionado_id IS NULL
  AND b.item_porcionado_id IS NULL;
```

### 3. Hook: Usar INSERT com ON CONFLICT DO UPDATE

Mudar de `upsert` para `INSERT ... ON CONFLICT ... DO UPDATE` para atualizar registros existentes ao invés de criar novos:

```typescript
// No importarMapeamentos mutation
// Estratégia: Para cada item, tentar atualizar, se não existir, inserir
const { data, error } = await supabase.rpc('upsert_mapeamento_cardapio', {
  p_mappings: mappings
});
```

**Alternativa simplificada**: Antes de importar, deletar todos os mapeamentos **sem vínculo** da loja selecionada, depois inserir os novos.

## Alterações

| Arquivo/Componente | Alteração |
|--------------------|-----------|
| **Migration SQL** | Criar índice único parcial + limpar duplicatas |
| `src/hooks/useCardapioWebIntegracao.ts` | Modificar `importarMapeamentos` para deletar antes de inserir |

## Fluxo Corrigido de Importação

```text
ANTES (Problemático):
1. Importar arquivo (287 itens)
2. INSERT com onConflict
3. PostgreSQL ignora conflict (NULL ≠ NULL)
4. 287 novos registros criados → Total: 287 × N importações

DEPOIS (Correto):
1. Importar arquivo (287 itens)
2. DELETE todos mapeamentos SEM VÍNCULO da loja
3. INSERT novos registros
4. Resultado: Exatamente 287 registros para a loja
```

## Benefícios

1. **Sem duplicatas**: Cada produto aparece uma única vez por loja
2. **Importações repetíveis**: Re-importar atualiza ao invés de duplicar
3. **Performance**: Menos registros = consultas mais rápidas
4. **Dados limpos**: Banco de dados consistente

