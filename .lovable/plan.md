
# Plano: Simplificar Kanban e Integrar Filtro com Status das Contagens

## Problema Identificado

Conforme a imagem do usuário, dentro da coluna "A PRODUZIR" existem elementos que poluem a interface:
1. **Abas de filtro** (TODAS, ★ CPD - Centro de..., UNIDADE JAPIIM)
2. **Mensagem de dica amarela** ("CPD - Centro de Produção e Distribuição tem a maior demanda...")
3. **Labels de loja** acima dos cards

Isso torna a interface confusa e bagunçada.

## Solução Proposta

Transformar o fluxo em:
1. O usuário clica em uma **loja no "Status das Contagens de Hoje"** (no topo da página)
2. A coluna "A PRODUZIR" **automaticamente filtra** para mostrar apenas itens dessa loja
3. **Remover** abas/filtros e mensagens de dica de dentro da coluna

```
FLUXO ATUAL:
┌─────────────────────────────────────────┐
│ Status das Contagens de Hoje            │
│ ✅ JAPIIM [Iniciar]   ✅ CPD [Iniciar]  │
└─────────────────────────────────────────┘
           ↓ (Sem conexão visual)
┌───────────────────────────────────────────────┐
│ A PRODUZIR                                    │
│ [TODAS] [★ CPD] [JAPIIM] ← ABAS (poluição)   │
│ "CPD tem maior demanda..." ← MENSAGEM        │
│ Card 1, Card 2...                            │
└───────────────────────────────────────────────┘

FLUXO PROPOSTO:
┌──────────────────────────────────────────────────┐
│ Status das Contagens de Hoje                     │
│ ┌──────────────────┐  ┌────────────────────────┐ │
│ │ ★ CPD - 518 un   │  │ JAPIIM - 64 un         │ │
│ │ [👁 Ver] [Iniciar]│  │ [👁 Ver] [Iniciar]     │ │
│ └──────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────┘
           ↓ Clica em "Ver" ou no card
┌───────────────────────────────────────────────┐
│ A PRODUZIR (Filtrado: CPD)        [✕ Limpar] │
│ Card 1, Card 2, Card 3...                    │
│ (Sem abas, sem mensagens extras)             │
└───────────────────────────────────────────────┘
```

---

## Mudanças Técnicas

### 1. Criar estado de filtro global na página

**Arquivo:** `src/pages/ResumoDaProducao.tsx`

Adicionar estado para loja selecionada que será controlado pelo componente de status:

```typescript
const [lojaFiltrada, setLojaFiltrada] = useState<{ id: string; nome: string } | null>(null);
```

### 2. Atualizar `ContagemStatusIndicator.tsx`

- Adicionar botão "Ver Produção" ou tornar o card clicável
- Nova prop: `onSelecionarLoja?: (lojaId: string | null, lojaNome: string) => void`
- Destacar visualmente a loja selecionada

```typescript
// Ao clicar no card da loja
onClick={() => onSelecionarLoja?.(loja.id, loja.nome)}
```

### 3. Simplificar `LojaFilterTabs.tsx`

**Remover completamente** este componente - não será mais usado dentro da coluna A PRODUZIR.

### 4. Simplificar `ProductGroupedStacks.tsx`

- **Remover** a chamada ao `LojaFilterTabs`
- **Remover** a lógica de estado `selectedLojaId` interno
- Receber `lojaFiltradaId` como prop (controle externo)
- **Remover** badge de loja acima dos cards
- **Remover** mensagem de dica

```typescript
// Antes
const [selectedLojaId, setSelectedLojaId] = useState<string | null>(null);
<LojaFilterTabs ... />

// Depois
interface Props {
  lojaFiltradaId?: string | null; // Novo: recebe do pai
}
// Apenas filtra os registros baseado no prop
```

### 5. Atualizar `ResumoDaProducao.tsx`

- Passar `lojaFiltradaId` para `ProductGroupedStacks`
- Conectar `ContagemStatusIndicator` com o estado de filtro
- Adicionar indicador visual quando há filtro ativo no header da coluna

```typescript
<ContagemStatusIndicator 
  onSelecionarLoja={(lojaId, nome) => setLojaFiltrada(lojaId ? { id: lojaId, nome } : null)}
/>

// Coluna A PRODUZIR
<CardTitle>
  A PRODUZIR
  {lojaFiltrada && (
    <Button size="xs" onClick={() => setLojaFiltrada(null)}>
      {lojaFiltrada.nome} ✕
    </Button>
  )}
</CardTitle>

<ProductGroupedStacks
  lojaFiltradaId={lojaFiltrada?.id}
  ...
/>
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ResumoDaProducao.tsx` | Adicionar estado `lojaFiltrada`, conectar com Status e passar para ProductGroupedStacks |
| `src/components/kanban/ContagemStatusIndicator.tsx` | Adicionar botão/clique para selecionar loja, nova prop `onSelecionarLoja` |
| `src/components/kanban/ProductGroupedStacks.tsx` | Remover LojaFilterTabs, receber `lojaFiltradaId` como prop, simplificar render |
| `src/components/kanban/LojaFilterTabs.tsx` | Manter mas não usar (ou remover se não utilizado em outro lugar) |

---

## Resultado Visual Esperado

**Status das Contagens** (no topo):
```
┌─────────────────────────────────────────────────────────────────┐
│ 🏪 Status das Contagens de Hoje                      2/3 lojas │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ★ CPD - Centro de Produção    📦 5 itens • 518 un          │ │
│ │   Atualizado: 14:32           [👁 Ver] [🚀 Iniciar]        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✅ UNIDADE JAPIIM             📦 1 item • 64 un            │ │
│ │   Atualizado: 15:10           [👁 Ver] [🚀 Iniciar]        │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Coluna A PRODUZIR** (limpa, sem poluição):
```
┌─────────────────────────────────────────────┐
│ A PRODUZIR     [CPD ✕]              6      │  ← Badge mostra filtro ativo
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ PEPPERONI - PORCIONADO             │   │
│  │ Lote 1 de 3 • 75 un                │   │
│  │ [▶ Iniciar Preparo]                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ BACON - PORCIONADO                 │   │
│  │ 70 un                              │   │
│  │ [▶ Iniciar Preparo]                │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Abas de filtro dentro da coluna | Filtro controlado pelo Status (topo) |
| Mensagem de dica ocupando espaço | Sem mensagens extras |
| Interface poluída | Interface limpa e focada |
| Dois lugares para a mesma ação | Uma única fonte de controle |
| Usuário precisa entender as abas | Clique intuitivo no card da loja |
