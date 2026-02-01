

# Plano: Adicionar Label "Sobra" aos Botões Azuis

## Objetivo

Adicionar um label visual "SOBRA" acima dos botões azuis de quantidade para facilitar a identificação da coluna pelos usuários.

## Situação Atual

| Elemento | Descrição |
|----------|-----------|
| Botões Azuis | Controlam `final_sobra` (quantidade em estoque) |
| Sem Label | Atualmente não há identificação visual da coluna |
| Funcionamento | ✅ Já funciona - usuário e Cardápio Web podem alterar |
| Cálculo | ✅ `a_produzir = ideal - final_sobra` (automático no banco) |

## Mudança Visual Proposta

```text
ANTES:
┌───────────────────┐
│  [-] [99] [+]     │
└───────────────────┘

DEPOIS:
┌───────────────────┐
│     SOBRA         │  ← Label identificador
│  [-] [99] [+]     │
└───────────────────┘
```

## Alteração Técnica

### Arquivo: `src/components/contagem/ContagemItemCard.tsx`

Adicionar um container ao redor dos botões azuis com label "SOBRA":

```tsx
{/* Controle de Quantidade com Label */}
<div className="flex flex-col items-center">
  <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wide font-medium mb-1">
    Sobra
  </span>
  <div className="flex items-center">
    {/* Botões [-] [valor] [+] existentes */}
  </div>
</div>
```

## Fluxo Confirmado

O sistema já está funcionando corretamente:

1. **Usuário altera** → `final_sobra` atualizado → `a_produzir` recalculado automaticamente
2. **Cardápio Web altera** (via webhook) → `final_sobra` decrementado → `a_produzir` recalculado automaticamente

A fórmula no banco garante que `a_produzir = MAX(0, ideal - sobra)` sempre seja atualizado em tempo real.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/contagem/ContagemItemCard.tsx` | Adicionar label "SOBRA" acima dos botões azuis |

