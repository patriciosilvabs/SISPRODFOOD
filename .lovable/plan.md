
# Plano: Uniformizar Espaçamento Entre Colunas

## Problema Identificado

As colunas têm larguras diferentes:
- **SOBRA**: ~118px (2 botões de 40px + input de 56px)
- **EST. IDEAL, C. WEB, PRODUZIR, LOTES**: min-w-[70px] (podem variar)

O CSS Grid com `gap-3` distribui o espaço restante de forma desigual quando as colunas têm tamanhos diferentes.

## Solução

Definir largura fixa para todas as colunas, garantindo que:
1. Cada coluna ocupe exatamente o mesmo espaço
2. O espaçamento entre elas seja uniforme

### Mudanças no Arquivo: `src/components/contagem/ContagemItemCard.tsx`

**1. Aumentar o gap entre colunas** (linha 128):
```tsx
// ANTES
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 flex-1 lg:ml-6">

// DEPOIS
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-6 flex-1 lg:ml-6">
```

**2. Definir largura fixa para cada coluna** - adicionar `w-[120px]` em cada div de coluna:

- Linha 130: `<div className="flex flex-col items-center w-[120px]">` (SOBRA)
- Linha 172: `<div className="flex flex-col items-center w-[120px]">` (EST. IDEAL)
- Linha 193: `<div className="flex flex-col items-center w-[120px]">` (C. WEB)
- Linha 214: `<div className="flex flex-col items-center w-[120px]">` (PRODUZIR)
- Linha 229: `<div className="flex flex-col items-center w-[120px]">` (LOTES)

## Resultado Esperado

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  BACON - PORCIONADO    │   SOBRA   │  EST. IDEAL  │   C. WEB   │  PRODUZIR  │  LOTES   │
│                        │←── 24px ──→←── 24px ────→←── 24px ───→←── 24px ───→│          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                         ↑           ↑              ↑            ↑
                              Espaçamento uniforme de 24px (gap-6)
```

Todas as colunas terão 120px de largura e 24px de espaçamento entre elas.
