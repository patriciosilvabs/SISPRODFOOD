

# Plano: Correção do Tipo de Coluna para Códigos Grandes

## Problema Identificado

O erro `22003` indica que o valor `5983177567376339` excede o limite do tipo `integer` do PostgreSQL:

| Tipo | Limite Máximo |
|------|---------------|
| integer (int4) | 2.147.483.647 |
| bigint (int8) | 9.223.372.036.854.775.807 |

O código interno do Cardápio Web (`5983177567376339`) é maior que o limite do `integer`, então precisamos alterar a coluna para `bigint`.

## Solução

Migração SQL para alterar o tipo da coluna `cardapio_item_id` de `integer` para `bigint`.

## Alteração no Banco de Dados

```sql
ALTER TABLE mapeamento_cardapio_itens 
  ALTER COLUMN cardapio_item_id TYPE bigint;
```

## Alteração no Código

O TypeScript já trata números como `number` (64-bit float), então não há necessidade de alterar o código frontend. O `parseInt()` no parser já funciona corretamente para esses valores.

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Alterar `cardapio_item_id` de `integer` para `bigint` |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente pelo Supabase |

## Impacto

- **Zero downtime**: A alteração de `integer` para `bigint` é compatível com dados existentes
- **Sem perda de dados**: Todos os valores existentes serão preservados
- **Código frontend**: Nenhuma alteração necessária

