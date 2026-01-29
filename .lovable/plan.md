
# Plano: Corrigir Bloqueio Prematuro dos Cards

## Problema Identificado

A lógica atual em `ProductGroupedStacks.tsx` bloqueia **todos** os cards antes de clicar em "Iniciar":

```typescript
// ERRADO - linha 147
const producaoHabilitada = lojaIniciadaId === registroLojaId;
```

Quando `lojaIniciadaId` é `null`, a comparação `null === registroLojaId` resulta em `false`, bloqueando tudo.

---

## Solução

Modificar a lógica para que a produção fique **habilitada por padrão** quando nenhuma loja foi iniciada:

```typescript
// CORRETO
const producaoHabilitada = lojaIniciadaId === null || lojaIniciadaId === registroLojaId;
```

**Comportamento esperado:**
- `lojaIniciadaId === null` → Nenhuma loja iniciada → **Todos habilitados**
- `lojaIniciadaId === 'abc123'` → Loja específica iniciada → **Apenas essa loja habilitada**

---

## Mudanças Técnicas

### Arquivo: `src/components/kanban/ProductGroupedStacks.tsx`

**Antes (linha 147):**
```typescript
const producaoHabilitada = lojaIniciadaId === registroLojaId;
```

**Depois:**
```typescript
// Se nenhuma loja foi iniciada (null), todos estão habilitados
// Se uma loja foi iniciada, apenas ela fica habilitada
const producaoHabilitada = lojaIniciadaId === null || lojaIniciadaId === registroLojaId;
```

---

## Fluxo Corrigido

```text
ANTES DE CLICAR "INICIAR":
┌─────────────────────────────────────────────────────────────┐
│ lojaIniciadaId = null                                       │
│                                                             │
│ ┌─────────────────────┐  ┌─────────────────────┐            │
│ │ PEPPERONI           │  │ CALABRESA           │            │
│ │ [▶ Ir para Preparo] │  │ [▶ Ir para Preparo] │ ← TODOS    │
│ │ HABILITADO          │  │ HABILITADO          │   LIVRES   │
│ └─────────────────────┘  └─────────────────────┘            │
└─────────────────────────────────────────────────────────────┘

DEPOIS DE CLICAR "INICIAR" EM ALEIXO:
┌─────────────────────────────────────────────────────────────┐
│ lojaIniciadaId = 'aleixo-id'                                │
│                                                             │
│ ┌─────────────────────┐  ┌─────────────────────┐            │
│ │ PEPPERONI (ALEIXO)  │  │ CALABRESA (JAPIIM)  │            │
│ │ [▶ Ir para Preparo] │  │ [🔒 Aguardando]     │ ← JAPIIM   │
│ │ HABILITADO          │  │ BLOQUEADO           │   BLOQ.    │
│ └─────────────────────┘  └─────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kanban/ProductGroupedStacks.tsx` | Alterar lógica de `producaoHabilitada` (linha 147) |

---

## Resultado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Nenhuma loja iniciada | Todos bloqueados ❌ | Todos habilitados ✅ |
| Loja ALEIXO iniciada | Apenas ALEIXO habilitado ✅ | Apenas ALEIXO habilitado ✅ |
