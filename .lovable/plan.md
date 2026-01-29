
# Plano: Corrigir Inconsistência de Fuso Horário no Dia Operacional

## Problema Identificado

Existe uma **inconsistência de fuso horário** entre as duas páginas:

| Página | Como calcula `dia_operacional` | Resultado às 23:59 SP |
|--------|--------------------------------|----------------------|
| **Contagem** | `new Date().toISOString().split('T')[0]` | 2026-01-**29** (UTC) |
| **Resumo** | `supabase.rpc('get_current_date')` | 2026-01-**28** (SP) |

**Consequência:** A loja salva contagem para o dia 29 (UTC), mas o Resumo busca contagens do dia 28 (São Paulo), resultando em dados não encontrados.

---

## Solução

Padronizar ambas as páginas para usar a **mesma fonte de data** - a função do servidor `get_current_date()`.

Isso garante que:
1. O dia operacional seja calculado de forma consistente em todo o sistema
2. A lógica respeite o fuso horário da organização (São Paulo)
3. A transição de dia aconteça no horário correto (meia-noite em SP, não em UTC)

---

## Mudanças Técnicas

### Arquivo: `src/pages/ContagemPorcionados.tsx`

**Modificar a função `handleSave`** para buscar a data do servidor antes de salvar:

**Antes (errado):**
```typescript
const today = new Date();
const diaOperacional = today.toISOString().split('T')[0]; // UTC!
```

**Depois (correto):**
```typescript
// Buscar data do servidor (respeita fuso horário da organização)
const { data: dataServidor } = await supabase.rpc('get_current_date');
const diaOperacional = dataServidor || new Date().toISOString().split('T')[0];
```

### Arquivo: `src/pages/ContagemPorcionados.tsx` - loadData

Também atualizar a função `loadData` que busca contagens existentes para usar a mesma data do servidor:

```typescript
// No início da função loadData:
const { data: dataServidor } = await supabase.rpc('get_current_date');
const today = dataServidor || new Date().toISOString().split('T')[0];
```

---

## Fluxo Corrigido

```
┌─────────────────────────────────────────────────────────────┐
│ HORÁRIO: 23:59 em São Paulo (02:59 UTC)                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ LOJA SALVA CONTAGEM                                        │
│ • supabase.rpc('get_current_date') → 2026-01-28            │
│ • dia_operacional = 2026-01-28                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ RESUMO DA PRODUÇÃO                                         │
│ • supabase.rpc('get_current_date') → 2026-01-28            │
│ • Busca contagens WHERE dia_operacional = 2026-01-28       │
│ • ENCONTRA os dados corretamente!                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Contagem usa UTC | Contagem usa fuso SP (igual Resumo) |
| Dados não batem entre páginas | Dados consistentes |
| Bug às 21h-00h (horário crítico) | Funciona 24h |

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ContagemPorcionados.tsx` | Alterar `loadData` e `handleSave` para usar `supabase.rpc('get_current_date')` |

---

## Nota sobre dados existentes

As contagens já salvas com `dia_operacional = 2026-01-29` permanecerão no banco. Quando o horário em SP virar meia-noite (01:00 UTC), o `get_current_date()` retornará 2026-01-29 e os dados aparecerão normalmente.

**Alternativa imediata** (se precisar ver os dados agora): Podemos também ajustar a consulta no Resumo para usar `CURRENT_DATE` (UTC) em vez de `get_current_date()` (SP), mas isso causaria outros problemas de consistência. A solução correta é padronizar na Contagem.
