

# Plano: Afastar Colunas do Nome do Item

## Problema

As colunas (SOBRA, EST. IDEAL, etc.) estão muito próximas do nome do item no lado esquerdo.

## Solução

Adicionar espaçamento entre a área do nome e o grid de colunas usando `lg:ml-6` (margin-left) no grid de colunas.

## Mudança

### Arquivo: `src/components/contagem/ContagemItemCard.tsx`

**Linha 128** - Adicionar margem esquerda no grid:

```tsx
// ANTES
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 flex-1">

// DEPOIS
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 flex-1 lg:ml-6">
```

Isso adiciona `24px` de espaçamento à esquerda do grid de colunas em telas grandes (lg+), afastando as colunas do nome do item.

