
# Plano: Filtrar CPD de Configurações de Estoque por Loja

## Problema Identificado

O CPD (Centro de Produção e Distribuição) está aparecendo incorretamente em modais e listagens onde apenas **lojas comuns** deveriam ser exibidas. Conforme a arquitetura do sistema:

- **CPD** = Centro de produção. Produz e envia para lojas.
- **Loja** = Unidade de venda. Recebe produtos do CPD.

O CPD **não possui demanda própria** - ele é a fonte de produção, não um destino. Configurar "estoques ideais" ou "estoques mínimos" para o CPD não faz sentido operacional.

## Arquivos Afetados

| Arquivo | Problema | Ação |
|---------|----------|------|
| `src/pages/ItensPorcionados.tsx` | Busca lojas sem filtrar CPD (linhas 210-215) e exibe CPD no modal de Estoques Ideais | Adicionar `.neq('tipo', 'cpd')` na query |
| `src/components/modals/ConfigurarEstoqueMinimoModal.tsx` | Busca lojas sem filtrar CPD (linhas 82-85) | Adicionar `.neq('tipo', 'cpd')` na query |
| `src/pages/EstoqueLoja.tsx` | Admin vê todas as lojas incluindo CPD (linhas 101-107) | Adicionar `.neq('tipo', 'cpd')` na query |

## Padrão Já Usado no Sistema

Várias partes do sistema já filtram corretamente o CPD. Exemplos:

```typescript
// ReposicaoLoja.tsx - linha 142
.neq('tipo', 'cpd')

// Romaneio.tsx - linha 681
.neq('tipo', 'cpd')

// GerenciarDestinatariosEmailModal.tsx - linha 104
.neq('tipo', 'cpd')
```

## Alterações Técnicas

### 1. ItensPorcionados.tsx (linhas 209-215)

**Antes:**
```typescript
// Buscar lojas (exceto CPD)
const { data: lojasData } = await supabase
  .from('lojas')
  .select('id, nome, tipo')
  .order('nome');
```

**Depois:**
```typescript
// Buscar lojas (exceto CPD - não precisa configurar estoque ideal para CPD)
const { data: lojasData } = await supabase
  .from('lojas')
  .select('id, nome, tipo')
  .neq('tipo', 'cpd')
  .order('nome');
```

### 2. ConfigurarEstoqueMinimoModal.tsx (linhas 80-93)

**Antes:**
```typescript
const { data, error } = await supabase
  .from("lojas")
  .select("id, nome")
  .order("nome");
```

**Depois:**
```typescript
const { data, error } = await supabase
  .from("lojas")
  .select("id, nome, tipo")
  .neq('tipo', 'cpd')
  .order("nome");
```

### 3. EstoqueLoja.tsx (linhas 100-107)

**Antes (Admin):**
```typescript
const { data: todasLojas, error: lojasError } = await supabase
  .from('lojas')
  .select('id, nome')
  .order('nome');
```

**Depois (Admin):**
```typescript
const { data: todasLojas, error: lojasError } = await supabase
  .from('lojas')
  .select('id, nome, tipo')
  .neq('tipo', 'cpd')
  .order('nome');
```

## Resultado Esperado

1. **Modal "Configurar Estoques Ideais por Loja"** (ItensPorcionados):
   - ❌ Antes: Mostra CPD + Lojas comuns
   - ✅ Depois: Mostra apenas lojas comuns

2. **Modal "Configurar Estoque Mínimo Semanal"** (ConfigurarEstoqueMinimoModal):
   - ❌ Antes: Dropdown de loja inclui CPD
   - ✅ Depois: Dropdown mostra apenas lojas comuns

3. **Página "Estoque Loja"** (EstoqueLoja):
   - ❌ Antes: Admin vê CPD na seleção de loja
   - ✅ Depois: Admin vê apenas lojas comuns

## Impacto

- **Zero impacto em dados existentes**: Apenas filtra visualmente
- **Alinhamento com arquitetura**: CPD não tem demanda própria (memory `production-demand-exclusion-cpd`)
- **Consistência com padrões existentes**: Várias páginas já aplicam este filtro
