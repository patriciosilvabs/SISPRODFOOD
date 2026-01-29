
# Plano: Mover Botões de Iniciar Produção para o Status das Contagens

## Problema Atual

Atualmente existem dois elementos de UI duplicados:
1. **LojaFilterTabs** (dentro da coluna "A PRODUZIR") - mostra abas de filtro por loja + botão "Iniciar Produção da Loja"
2. **ContagemStatusIndicator** (acima do Kanban) - mostra status das contagens por loja

O usuário quer consolidar: os botões de iniciar produção devem estar junto ao status das contagens, não dentro da coluna A PRODUZIR.

## Solução Proposta

Integrar o botão "Iniciar Produção da Loja" diretamente nos cards de status das contagens:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🏪 Status das Contagens de Hoje                           2/3 lojas   │
├────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ ✅ UNIDADE JAPIIM         📦 6 itens • 423 un                    │  │
│ │    Atualizado: 14:32                                             │  │
│ │                                     [🚀 Iniciar Produção]        │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ ✅ UNIDADE CACHOEIRINHA   📦 2 itens • 46 un                     │  │
│ │    Atualizado: 15:10                                             │  │
│ │                                     [🚀 Iniciar Produção]        │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐  │
│ │ ⏳ UNIDADE ALEIXO                                   [Aguardando] │  │
│ └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

## Mudanças Necessárias

### 1. `ContagemStatusIndicator.tsx` - Adicionar botões de ação

**Modificações:**
- Receber nova prop `onIniciarProducaoLoja?: (lojaId: string, lojaNome: string) => void`
- Adicionar botão "Iniciar Produção" em cada card de loja que já enviou contagem
- Destacar visualmente a loja com maior demanda (★) com sugestão de prioridade
- O botão só aparece se a loja tiver itens a produzir (totalItens > 0)

```typescript
interface ContagemStatusIndicatorProps {
  lojas: Loja[];
  contagensHoje: ContagemData[];
  onIniciarProducaoLoja?: (lojaId: string, lojaNome: string) => void; // NOVO
}
```

### 2. `LojaFilterTabs.tsx` - Simplificar para filtro puro

**Modificações:**
- Remover prop `onIniciarTudoLoja`
- Remover botão "Iniciar Produção da Loja"
- Manter apenas as abas de filtro por loja (para navegação nos cards)
- Manter a dica visual de qual loja tem maior demanda

### 3. `ProductGroupedStacks.tsx` - Remover handler de batch

**Modificações:**
- Remover prop `onIniciarTudoLoja`
- Atualizar chamada do `LojaFilterTabs` sem o handler de iniciar

### 4. `ResumoDaProducao.tsx` - Conectar novo handler

**Modificações:**
- Passar `onIniciarProducaoLoja` para `ContagemStatusIndicator`
- Remover `onIniciarTudoLoja` de `ProductGroupedStacks`

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kanban/ContagemStatusIndicator.tsx` | Adicionar prop e botão de iniciar produção por loja |
| `src/components/kanban/LojaFilterTabs.tsx` | Remover botão e prop de iniciar tudo |
| `src/components/kanban/ProductGroupedStacks.tsx` | Remover prop `onIniciarTudoLoja` |
| `src/pages/ResumoDaProducao.tsx` | Conectar handler ao novo local |

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Botões duplicados em 2 lugares | Um único local de ação por loja |
| Usuário precisa navegar para coluna | Ação visível logo no topo da página |
| Status e ação separados | Status + ação integrados logicamente |
| Confusão sobre onde clicar | Fluxo claro: ver status → iniciar produção |
