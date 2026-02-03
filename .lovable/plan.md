

# Plano: Corrigir Alinhamento das Colunas

## Problema

Nomes de itens com tamanhos diferentes (ex: "CALABRESA - PORCIONADO" vs "MASSA - PORCIONADO") estão causando desalinhamento das colunas, pois a área do nome não tem uma largura fixa suficiente.

## Solução

Definir uma largura fixa maior para a área do nome do item, garantindo que:
1. Todos os nomes ocupem o mesmo espaço horizontal
2. Nomes longos sejam truncados com reticências (...)
3. As colunas fiquem perfeitamente alinhadas

## Mudança

### Arquivo: `src/components/contagem/ContagemItemCard.tsx`

**Linha 105** - Alterar a área do nome para ter largura fixa:

```tsx
// ANTES
<div className="flex-shrink-0 lg:min-w-[200px] lg:max-w-[250px]">

// DEPOIS
<div className="flex-shrink-0 lg:w-[280px]">
```

Isso define uma largura fixa de `280px` para a área do nome em telas grandes, garantindo que:
- Todos os cards tenham a mesma largura para o nome
- As colunas (SOBRA, EST. IDEAL, etc.) iniciem sempre na mesma posição
- Nomes longos sejam truncados (já existe `truncate` no span do nome)

## Resultado Esperado

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│  BACON - PORCIONADO       │  SOBRA  │  EST. IDEAL  │  C. WEB  │  PRODUZIR  │       │
│  CALABRESA - PORCIONADO   │  SOBRA  │  EST. IDEAL  │  C. WEB  │  PRODUZIR  │       │
│  MUSSARELA - PORCIONADO   │  SOBRA  │  EST. IDEAL  │  C. WEB  │  PRODUZIR  │       │
└────────────────────────────────────────────────────────────────────────────────────┘
                            ↑
                     Colunas alinhadas
```

