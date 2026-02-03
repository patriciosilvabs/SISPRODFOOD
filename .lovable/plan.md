
# Plano: Exibir Última Venda na Coluna C. WEB

## Problema

Atualmente a coluna **C. WEB** exibe o total acumulado de vendas (`cardapioWebBaixaTotal = 624`), mas o usuário quer ver apenas a **quantidade da última venda recebida** (`cardapioWebUltimaBaixaQtd`).

## Solução

Alterar o componente `ContagemItemCard` para exibir `cardapioWebUltimaBaixaQtd` em vez de `cardapioWebBaixaTotal`.

## Mudança Técnica

### Arquivo: `src/components/contagem/ContagemItemCard.tsx`

**Linhas 198-210** - Trocar a exibição de `cardapioWebBaixaTotal` para `cardapioWebUltimaBaixaQtd`:

```tsx
// ANTES (linhas 198-210)
<div className={`rounded-lg px-4 py-2 min-w-[70px] text-center border ${
  cardapioWebBaixaTotal && cardapioWebBaixaTotal > 0
    ? 'bg-violet-100 dark:bg-violet-900/50 border-violet-300 dark:border-violet-700'
    : 'bg-muted border-border'
}`}>
  <span className={`text-lg font-bold ${
    cardapioWebBaixaTotal && cardapioWebBaixaTotal > 0
      ? 'text-violet-700 dark:text-violet-300'
      : 'text-muted-foreground'
  }`}>
    {cardapioWebBaixaTotal || 0}
  </span>
</div>

// DEPOIS
<div className={`rounded-lg px-4 py-2 min-w-[70px] text-center border ${
  cardapioWebUltimaBaixaQtd && cardapioWebUltimaBaixaQtd > 0
    ? 'bg-violet-100 dark:bg-violet-900/50 border-violet-300 dark:border-violet-700'
    : 'bg-muted border-border'
}`}>
  <span className={`text-lg font-bold ${
    cardapioWebUltimaBaixaQtd && cardapioWebUltimaBaixaQtd > 0
      ? 'text-violet-700 dark:text-violet-300'
      : 'text-muted-foreground'
  }`}>
    {cardapioWebUltimaBaixaQtd || 0}
  </span>
</div>
```

## Resultado Esperado

```text
ANTES:
┌──────────────────────────────────────────────────────┐
│  SOBRA: 150  │  EST. IDEAL: 250  │  C. WEB: 624  │  ← Total acumulado
└──────────────────────────────────────────────────────┘

DEPOIS:
┌──────────────────────────────────────────────────────┐
│  SOBRA: 150  │  EST. IDEAL: 250  │  C. WEB: 1    │  ← Última venda
└──────────────────────────────────────────────────────┘
```

Quando uma nova venda chega do Cardápio Web:
- Se a última venda foi de **1 unidade** → C. WEB mostra **1**
- Se a última venda foi de **50 unidades** → C. WEB mostra **50**
- Se não houve vendas ainda → C. WEB mostra **0**
