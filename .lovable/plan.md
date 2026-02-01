
# Plano: Recálculo em Tempo Real da Coluna "A Produzir"

## Problema Identificado

Atualmente, quando a coluna **Sobra** (botão azul) é alterada - seja pelo usuário ou pelo sistema Cardápio Web - a coluna **A Produzir** não reflete a mudança imediatamente na tela.

| Situação | O que acontece | O que deveria acontecer |
|----------|----------------|-------------------------|
| Usuário clica [-] na Sobra | Sobra diminui, A Produzir permanece igual | A Produzir deve aumentar |
| Usuário clica [+] na Sobra | Sobra aumenta, A Produzir permanece igual | A Produzir deve diminuir |
| Webhook decrementa Sobra | Sobra diminui no banco, UI não atualiza | A Produzir deve aumentar |

## Causa Raiz

Na linha 1119 do arquivo `ContagemPorcionados.tsx`:

```tsx
// ATUAL - usa valor do banco (não atualiza em tempo real)
const aProduzir = contagem?.a_produzir ?? 0;
```

O frontend usa o valor `a_produzir` que veio do banco no carregamento inicial, e não recalcula quando o usuário modifica `final_sobra` via interface.

## Solução

Calcular `a_produzir` dinamicamente no frontend usando a **mesma fórmula** do banco de dados:

```tsx
// NOVO - calcula em tempo real
const aProduzir = Math.max(0, idealFromConfig - finalSobra);
```

Desta forma:
- **Sobra = 100, Ideal = 100** → A Produzir = 0
- **Sobra = 97, Ideal = 100** → A Produzir = 3 
- **Sobra = 0, Ideal = 100** → A Produzir = 100 (máximo)

## Fluxo Visual Final

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Item: MASSA - PORCIONADO                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌────────────────────┐                    ┌──────────────────────┐    │
│   │       SOBRA        │                    │      A PRODUZIR      │    │
│   │  ┌───┬──────┬───┐  │   ──────────►      │       (Laranja)      │    │
│   │  │ - │  97  │ + │  │   Recalcula       │          3           │    │
│   │  └───┴──────┴───┘  │   Automatico      │   (100 - 97 = 3)     │    │
│   │  (Botão Azul)      │                    └──────────────────────┘    │
│   └────────────────────┘                                                │
│                                                                         │
│   Se clicar [-] → Sobra vira 96 → A Produzir vira 4                    │
│   Se clicar [+] → Sobra vira 98 → A Produzir vira 2                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Alteração Técnica

### Arquivo: `src/pages/ContagemPorcionados.tsx`

**Localização**: Linhas 1117-1119

```tsx
// ANTES (linha 1119):
const aProduzir = contagem?.a_produzir ?? 0;

// DEPOIS:
// MODELO SIMPLIFICADO: a_produzir = ideal - final_sobra (recalculado em tempo real)
const aProduzir = Math.max(0, idealFromConfig - finalSobra);
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ContagemPorcionados.tsx` | Calcular `aProduzir` dinamicamente usando `Math.max(0, idealFromConfig - finalSobra)` |

## Benefícios

1. **Feedback imediato**: Usuário vê o impacto de cada alteração na Sobra instantaneamente
2. **Consistência**: Frontend e banco usam a mesma fórmula
3. **UX melhorada**: Não precisa salvar para ver o resultado do cálculo
