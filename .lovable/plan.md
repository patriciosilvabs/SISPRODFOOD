
# Plano: Corrigir Duplicação de Itens no Estoque CPD (Romaneio)

## Problema Identificado

Na página de Romaneio, a seção "Estoque Disponível no CPD" exibe **itens duplicados** com quantidades diferentes. Isso ocorre porque as queries buscam registros da tabela `contagem_porcionados` **sem filtrar pelo dia operacional atual**, retornando o histórico de múltiplos dias.

**Exemplo do problema:**
- BACON - PORCIONADO: 7 un (dia 22)
- BACON - PORCIONADO: 23 un (dia 23)
- BACON - PORCIONADO: 20 un (dia 28)
- BACON - PORCIONADO: 67 un (dia 29) ← **Valor correto (hoje)**

A página "Estoque Porcionados (CPD)" funciona corretamente porque **filtra por dia_operacional**, mostrando apenas os 67 un.

## Causa Raiz

No arquivo `src/pages/Romaneio.tsx`, duas queries não incluem o filtro de dia operacional:

**Query 1 - Estoque CPD (linhas 738-746):**
```typescript
// PROBLEMA: Falta .eq('dia_operacional', serverDate)
const { data: contagemCPD } = await supabase
  .from('contagem_porcionados')
  .select(...)
  .eq('loja_id', lojaCPD.id)
  .gt('final_sobra', 0);  // ❌ Retorna TODOS os dias
```

**Query 2 - Demandas das Lojas (linhas 772-781):**
```typescript
// PROBLEMA: Falta .eq('dia_operacional', serverDate)
const { data: contagensData } = await supabase
  .from('contagem_porcionados')
  .select(...)
  .in('loja_id', lojasIds)
  .gt('a_produzir', 0);  // ❌ Retorna TODOS os dias
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Romaneio.tsx` | Adicionar `.eq('dia_operacional', serverDate)` nas queries de contagem |

## Alterações Técnicas

### Query 1 - Estoque CPD (linhas 738-746)

**Antes:**
```typescript
const { data: contagemCPD, error: contagemError } = await supabase
  .from('contagem_porcionados')
  .select(`
    item_porcionado_id, 
    final_sobra,
    itens_porcionados!inner(nome)
  `)
  .eq('loja_id', lojaCPD.id)
  .gt('final_sobra', 0);
```

**Depois:**
```typescript
const { data: contagemCPD, error: contagemError } = await supabase
  .from('contagem_porcionados')
  .select(`
    item_porcionado_id, 
    final_sobra,
    itens_porcionados!inner(nome)
  `)
  .eq('loja_id', lojaCPD.id)
  .eq('dia_operacional', serverDate)  // ✅ Filtrar pelo dia atual
  .gt('final_sobra', 0);
```

### Query 2 - Demandas das Lojas (linhas 772-781)

**Antes:**
```typescript
const { data: contagensData, error: contagensLojasError } = await supabase
  .from('contagem_porcionados')
  .select(`
    loja_id,
    item_porcionado_id,
    a_produzir,
    itens_porcionados!inner(id, nome)
  `)
  .in('loja_id', lojasIds)
  .gt('a_produzir', 0);
```

**Depois:**
```typescript
const { data: contagensData, error: contagensLojasError } = await supabase
  .from('contagem_porcionados')
  .select(`
    loja_id,
    item_porcionado_id,
    a_produzir,
    itens_porcionados!inner(id, nome)
  `)
  .in('loja_id', lojasIds)
  .eq('dia_operacional', serverDate)  // ✅ Filtrar pelo dia atual
  .gt('a_produzir', 0);
```

### Queries de Validação/Débito (linhas 1220, 1305, 1358)

As queries de validação e débito de estoque também precisam de filtro para garantir que estão operando no registro correto do dia:

- Linha 1220-1225: `.eq('dia_operacional', serverDate)`
- Linha 1305-1310: `.eq('dia_operacional', serverDate)`
- Linha 1358-1363: `.eq('dia_operacional', serverDate)`

> **Nota:** Essas queries usam `.maybeSingle()`, então já retornam um registro único. Porém, sem o filtro de dia, podem retornar um registro de dia anterior. Isso é crítico para garantir que o débito seja feito no registro correto.

## Resultado Esperado

| Local | Antes | Depois |
|-------|-------|--------|
| "Estoque Disponível no CPD" | 8x BACON com quantidades diferentes | 1x BACON: 67 un |
| Demandas das lojas | Duplicadas por dia | Apenas demandas do dia atual |
| Débito de estoque | Pode debitar registro antigo | Sempre debita registro do dia |

## Alinhamento com Arquitetura

Esta correção segue a documentação existente:

> "O fluxo de estoque entre CPD e lojas utiliza o campo `final_sobra` na tabela `contagem_porcionados` (dia operacional atual) como fonte única de verdade" - memory `inventory-flow-cpd-stores-sync`

## Impacto

- **Zero risco de perda de dados**: Apenas adiciona filtro de leitura
- **Comportamento correto**: Alinha Romaneio com padrão já usado em outras páginas (AjusteEstoquePorcionadosCPD, ContagemPorcionados)
- **Performance**: Melhora performance ao filtrar menos registros
