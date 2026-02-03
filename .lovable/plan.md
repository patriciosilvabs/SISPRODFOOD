
# Plano: Corrigir Limite de 1000 Registros no Webhook do Cardápio Web

## Problema Identificado

O webhook do Cardápio Web não está processando todos os vínculos de um produto porque a **query de mapeamentos está limitada a 1000 registros** (limite padrão do Supabase).

### Evidência do Bug

Mapeamentos para o produto "MILHO VERDE (G)" (código 3543853):

| Posição na Query | Item Porcionado | Status |
|-----------------|-----------------|--------|
| 647 | NULL (sem vínculo) | ✅ Incluído |
| 810 | MASSA - PORCIONADO | ✅ Incluído |
| **1052** | **MUSSARELA - PORCIONADO** | ❌ **EXCLUÍDO** (além do limite 1000) |

A organização tem **1264 mapeamentos ativos**, mas a query só retorna os primeiros 1000.

### Código Problemático

```typescript
// supabase/functions/cardapio-web-webhook/index.ts (linhas 490-494)
const { data: mapeamentos, error: mapError } = await supabase
  .from('mapeamento_cardapio_itens')
  .select('*')
  .eq('organization_id', organization_id)
  .eq('ativo', true)
  // ❌ NÃO TEM .limit() - usa default de 1000
```

## Solução

Adicionar `.limit(10000)` na query para garantir que todos os mapeamentos sejam retornados. Também aplicar a mesma correção na query de mapeamentos por categoria.

## Detalhes Técnicos

### Arquivo: `supabase/functions/cardapio-web-webhook/index.ts`

#### Mudança 1: Query de mapeamentos específicos (linha 490-494)

```typescript
// ANTES
const { data: mapeamentos, error: mapError } = await supabase
  .from('mapeamento_cardapio_itens')
  .select('*')
  .eq('organization_id', organization_id)
  .eq('ativo', true)

// DEPOIS
const { data: mapeamentos, error: mapError } = await supabase
  .from('mapeamento_cardapio_itens')
  .select('*')
  .eq('organization_id', organization_id)
  .eq('ativo', true)
  .limit(10000) // Garantir que todos os mapeamentos sejam retornados
```

#### Mudança 2: Query de mapeamentos por categoria (linha 511-515)

```typescript
// ANTES
const { data: mapeamentosCategorias, error: catMapError } = await supabase
  .from('mapeamento_cardapio_categorias')
  .select('*')
  .eq('organization_id', organization_id)
  .eq('ativo', true)

// DEPOIS
const { data: mapeamentosCategorias, error: catMapError } = await supabase
  .from('mapeamento_cardapio_categorias')
  .select('*')
  .eq('organization_id', organization_id)
  .eq('ativo', true)
  .limit(10000) // Garantir que todas as regras de categoria sejam retornadas
```

#### Mudança 3: Adicionar log para diagnóstico (opcional, recomendado)

Após a construção do Map, adicionar contagem total:

```typescript
console.log(`📊 Mapeamentos carregados: ${mapeamentoMap.size} produtos, ${mapeamentos?.length || 0} registros totais`)
```

## Fluxo Corrigido

```text
ANTES (bug):
1. Query retorna apenas 1000 registros
2. MUSSARELA (posição 1052) não é incluída
3. Loop processa apenas MASSA
4. Estoque da MUSSARELA não é decrementado ❌

DEPOIS (correto):
1. Query retorna todos os registros (até 10000)
2. MUSSARELA é incluída no Map
3. Loop processa MASSA + MUSSARELA
4. Ambos os estoques são decrementados ✅
```

## Resultado Esperado

Quando uma venda de "MILHO VERDE (G)" ocorrer:

| Item Porcionado | Antes | Depois |
|-----------------|-------|--------|
| MASSA - PORCIONADO | -1 | -1 ✅ |
| MUSSARELA - PORCIONADO | 0 (não decrementava) | -1 ✅ |

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/cardapio-web-webhook/index.ts` | Adicionar `.limit(10000)` nas queries de mapeamentos |

## Considerações

- O limite de 10000 é suficiente para a maioria das organizações
- Se necessário no futuro, implementar paginação para organizações muito grandes
- A correção é retrocompatível e não afeta mapeamentos existentes
