
# Plano: Remover Função de Bloqueio de Produção

## O que será removido

Toda a lógica que bloqueia a produção de uma loja enquanto outra está em andamento, incluindo:

- Estado `lojaIniciada` e seu useEffect de monitoramento
- Prop `lojaIniciadaId` passada entre componentes
- Lógica de bloqueio visual nas lojas
- Verificação `producaoHabilitada` nos cards

---

## Arquivos a Modificar

### 1. `src/pages/ResumoDaProducao.tsx`

**Remover:**
- Estado `lojaIniciada` (linha ~161)
- useEffect que monitora itens em produção (linhas ~549-568)
- Verificação `if (lojaIniciada && lojaIniciada.id !== lojaId)` em `handleIniciarTudoLoja`
- Chamada `setLojaIniciada({ id: lojaId, nome: lojaNome })` 
- Prop `lojaIniciadaId={lojaIniciada?.id}` passada para `ContagemStatusIndicator` e `ProductGroupedStacks`
- Verificações de `!lojaIniciada` que bloqueiam ações

**Manter:**
- Estado `lojaFiltrada` (funcionalidade de filtro por loja continua)
- Botão "Iniciar" que move itens para preparo

---

### 2. `src/components/kanban/ContagemStatusIndicator.tsx`

**Remover:**
- Prop `lojaIniciadaId`
- Variáveis `isLojaIniciada` e `estaBloqueada`
- Badge "Em Produção" e "Aguardando"
- Ícone de cadeado (Lock)
- Estilos de bloqueio visual
- Mensagem "Outras lojas serão liberadas..."

**Manter:**
- Botão "Iniciar" (agora sempre visível para lojas com itens)
- Funcionalidade de clicar na loja para filtrar

---

### 3. `src/components/kanban/ProductGroupedStacks.tsx`

**Remover:**
- Prop `lojaIniciadaId` da interface e parâmetros
- Lógica que calcula `producaoHabilitada` baseado em `lojaIniciadaId`

**Alterar:**
- Passar `producaoHabilitada={true}` sempre (ou remover a prop)

---

### 4. `src/components/kanban/KanbanCard.tsx`

**Remover:**
- Lógica `aguardandoIniciar` que verifica `producaoHabilitada`
- Mensagem "Clique em 'Iniciar' na loja para liberar"

**Manter:**
- Prop `producaoHabilitada` (pode manter como opcional, sempre true)
- Bloqueio por lote anterior (`bloqueado_por_traco_anterior`)

---

### 5. `src/components/kanban/CardStack.tsx`

**Alterar:**
- Passar `producaoHabilitada={true}` sempre (ou remover a prop)

---

## Comportamento Após Remoção

| Antes | Depois |
|-------|--------|
| Clicar "Iniciar" bloqueia outras lojas | Cada loja é independente |
| Cards de outras lojas ficam bloqueados | Todos os cards sempre habilitados |
| Precisa finalizar uma loja para iniciar outra | Pode trabalhar em múltiplas lojas simultaneamente |
| Badge "Em Produção" / "Aguardando" | Apenas botão "Iniciar" |

---

## Resumo das Mudanças

```text
ANTES:
┌─────────────────────────┐   ┌─────────────────────────┐
│ LOJA ALEIXO             │   │ LOJA JAPIIM             │
│ [✓ Em Produção]         │   │ [🔒 Aguardando]         │
│ Cards habilitados       │   │ Cards bloqueados        │
└─────────────────────────┘   └─────────────────────────┘

DEPOIS:
┌─────────────────────────┐   ┌─────────────────────────┐
│ LOJA ALEIXO             │   │ LOJA JAPIIM             │
│ [🚀 Iniciar]            │   │ [🚀 Iniciar]            │
│ Cards habilitados       │   │ Cards habilitados       │
└─────────────────────────┘   └─────────────────────────┘
```

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `src/pages/ResumoDaProducao.tsx` | Remover estado `lojaIniciada`, useEffect e verificações relacionadas |
| `src/components/kanban/ContagemStatusIndicator.tsx` | Remover prop `lojaIniciadaId` e lógica de bloqueio visual |
| `src/components/kanban/ProductGroupedStacks.tsx` | Remover prop `lojaIniciadaId`, sempre habilitar produção |
| `src/components/kanban/KanbanCard.tsx` | Remover lógica `aguardandoIniciar` |
| `src/components/kanban/CardStack.tsx` | Simplificar, sempre passar `producaoHabilitada={true}` |
