
# Plano: Controle de Fluxo de Produção por Loja

## Requisitos do Usuário

1. **Remover botão "Ver Todos"** - Ao clicar no nome da loja, mostrar apenas os itens dessa loja
2. **"Ir para Preparo" bloqueado até clicar "Iniciar"** - O botão nos cards só fica ativo após o usuário clicar "Iniciar" na loja
3. **Lojas inativas até porcionamento** - Após "Iniciar" uma loja, as demais ficam bloqueadas até que TODOS os itens dessa loja estejam em "porcionamento"

---

## Arquitetura da Solução

```text
FLUXO PROPOSTO:
┌─────────────────────────────────────────────────────────────┐
│ Status das Contagens de Hoje                                │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ★ UNIDADE ALEIXO  📦 8 itens • 1016 un                 │ │
│ │   Atualizado: 23:04                                    │ │
│ │   [🚀 Iniciar]  ← Usuário clica para ativar produção   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ⏳ UNIDADE JAPIIM               📦 2 itens • 50 un     │ │
│ │   [BLOQUEADA]  ← Inativa até ALEIXO concluir           │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ A PRODUZIR (Filtrando: UNIDADE ALEIXO)                ✕    │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ PEPPERONI - PORCIONADO                                  │ │
│ │ [▶ Ir para Preparo] ← HABILITADO (loja foi iniciada)    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Estado Global Necessário

Novo estado em `ResumoDaProducao.tsx`:

```typescript
// Loja que teve "Iniciar" clicado (controla habilitação dos cards)
const [lojaIniciada, setLojaIniciada] = useState<{ id: string; nome: string } | null>(null);
```

---

## Mudanças Técnicas

### 1. `ResumoDaProducao.tsx`

**Adicionar estado `lojaIniciada`:**
```typescript
// Estado para controlar qual loja teve produção iniciada
const [lojaIniciada, setLojaIniciada] = useState<{ id: string; nome: string } | null>(null);
```

**Modificar lógica do botão "Iniciar":**
- Ao clicar em "Iniciar", definir `lojaIniciada`
- Também definir `lojaFiltrada` para mostrar apenas itens dessa loja
- Verificar se todos os itens da loja atual estão em "em_porcionamento" para desbloquear outras lojas

**Passar `lojaIniciada` para componentes filhos:**
```typescript
<ProductGroupedStacks
  lojaFiltradaId={lojaFiltrada?.id}
  lojaIniciadaId={lojaIniciada?.id}  // NOVO
/>
```

**Lógica para verificar se loja completou:**
```typescript
// Verificar se todos os itens da lojaIniciada já passaram para porcionamento
useEffect(() => {
  if (lojaIniciada) {
    const itensNaAProduzir = columns.a_produzir.filter(
      r => r.detalhes_lojas?.[0]?.loja_id === lojaIniciada.id
    );
    const itensEmPreparo = columns.em_preparo.filter(
      r => r.detalhes_lojas?.[0]?.loja_id === lojaIniciada.id
    );
    
    // Se não há mais itens em a_produzir nem em_preparo, desbloquear outras lojas
    if (itensNaAProduzir.length === 0 && itensEmPreparo.length === 0) {
      setLojaIniciada(null);
      setLojaFiltrada(null);
      toast.success(`✅ Produção de ${lojaIniciada.nome} concluída!`);
    }
  }
}, [columns, lojaIniciada]);
```

---

### 2. `ContagemStatusIndicator.tsx`

**Remover botão "Ver Todos":**
- Clicar no card da loja = filtrar pelos itens dessa loja (mantém)
- Remover botão separado "Ver" / "Ver Todos"

**Adicionar props para controle:**
```typescript
interface ContagemStatusIndicatorProps {
  lojas: Loja[];
  contagensHoje: ContagemData[];
  onIniciarProducaoLoja?: (lojaId: string, lojaNome: string) => void;
  onSelecionarLoja?: (lojaId: string | null, lojaNome: string) => void;
  lojaFiltradaId?: string | null;
  lojaIniciadaId?: string | null;  // NOVO: qual loja foi iniciada
}
```

**Lógica de bloqueio visual:**
- Se `lojaIniciadaId` está definido e é diferente da loja atual, mostrar como "bloqueada"
- Desabilitar botão "Iniciar" de outras lojas enquanto uma está em produção

```typescript
const isLojaAtual = lojaIniciadaId === loja.id;
const estaBloqueada = lojaIniciadaId !== null && !isLojaAtual;

{estaBloqueada ? (
  <Badge variant="outline" className="text-xs text-muted-foreground">
    🔒 Aguardando
  </Badge>
) : (
  <Button onClick={() => onIniciarProducaoLoja(loja.id, loja.nome)}>
    {isLojaAtual ? '✓ Em Produção' : 'Iniciar'}
  </Button>
)}
```

---

### 3. `ProductGroupedStacks.tsx`

**Receber nova prop `lojaIniciadaId`:**
```typescript
interface ProductGroupedStacksProps {
  // ... props existentes
  lojaIniciadaId?: string | null;  // NOVO
}
```

**Passar para KanbanCard:**
```typescript
<KanbanCard
  registro={registro}
  producaoHabilitada={lojaIniciadaId === registro.detalhes_lojas?.[0]?.loja_id}
/>
```

---

### 4. `KanbanCard.tsx`

**Nova prop para controlar botão:**
```typescript
interface KanbanCardProps {
  // ... props existentes
  producaoHabilitada?: boolean;  // NOVO: se false, botão "Ir para Preparo" fica desabilitado
}
```

**Desabilitar botão quando não habilitado:**
```typescript
const botaoDesabilitado = columnId === 'a_produzir' && 
  (estaBloqueado || !producaoHabilitada);

<Button
  disabled={botaoDesabilitado}
  className={botaoDesabilitado ? 'opacity-50 cursor-not-allowed' : ''}
>
  {!producaoHabilitada && columnId === 'a_produzir' 
    ? 'Aguardando Iniciar' 
    : buttonConfig.label}
</Button>
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ResumoDaProducao.tsx` | Adicionar estado `lojaIniciada`, lógica de desbloqueio automático, passar props |
| `src/components/kanban/ContagemStatusIndicator.tsx` | Remover "Ver Todos", adicionar lógica de bloqueio entre lojas |
| `src/components/kanban/ProductGroupedStacks.tsx` | Receber e propagar `lojaIniciadaId` |
| `src/components/kanban/KanbanCard.tsx` | Nova prop `producaoHabilitada` para bloquear "Ir para Preparo" |

---

## Fluxo Completo

```text
1. Usuário vê lojas disponíveis
   └── ALEIXO ★ [Iniciar]
   └── JAPIIM [Iniciar]

2. Clica "Iniciar" em ALEIXO
   └── lojaIniciada = ALEIXO
   └── lojaFiltrada = ALEIXO
   └── JAPIIM mostra [🔒 Aguardando]
   └── Cards de ALEIXO mostram [▶ Ir para Preparo]

3. Operador processa cada card
   └── Clica "Ir para Preparo" → card vai para EM PREPARO
   └── Conclui preparo → card vai para EM PORCIONAMENTO

4. Quando TODOS os cards de ALEIXO estão em PORCIONAMENTO
   └── lojaIniciada = null
   └── lojaFiltrada = null
   └── JAPIIM volta a mostrar [Iniciar]
   └── Operador pode iniciar JAPIIM
```

---

## Resultado Visual Final

**Status das Contagens (loja bloqueada):**
```
┌────────────────────────────────────────────────────────┐
│ ★ UNIDADE ALEIXO   📦 8 itens • 1016 un                │
│   [✓ EM PRODUÇÃO]  ← Verde, indicando ativa           │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│ ⏳ UNIDADE JAPIIM   📦 2 itens • 50 un                 │
│   [🔒 Aguardando]  ← Cinza/desabilitado               │
└────────────────────────────────────────────────────────┘
```

**Card antes de Iniciar loja:**
```
┌────────────────────────────────────┐
│ PEPPERONI - PORCIONADO            │
│ [Aguardando Iniciar] ← Desabilitado│
└────────────────────────────────────┘
```

**Card depois de Iniciar loja:**
```
┌────────────────────────────────────┐
│ PEPPERONI - PORCIONADO            │
│ [▶ Ir para Preparo] ← Habilitado  │
└────────────────────────────────────┘
```
