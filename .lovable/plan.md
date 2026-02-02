

# Plano: Substituir Sobra pelo Estoque Virtual (Ideal - Vendas Acumuladas)

## Entendimento do Requisito

Quando o Cardápio Web envia uma venda, em vez de decrementar o `final_sobra` atual, o sistema deve **substituir** o valor pela fórmula:

```
final_sobra = ideal_do_dia - vendas_acumuladas
```

Isso significa que o `final_sobra` sempre reflete o "Estoque Virtual" calculado.

### Comparação dos Modelos

| Modelo | Fórmula | Problema |
|--------|---------|----------|
| **Atual (decremento)** | `final_sobra = sobra_atual - venda` | Se usuário ajustou manualmente, pode ficar inconsistente |
| **Novo (substituição)** | `final_sobra = ideal - total_vendas` | Sempre sincronizado com as vendas acumuladas |

### Exemplo Prático

| Ação | `ideal` | `vendas_total` | `final_sobra` (novo) |
|------|---------|----------------|----------------------|
| Início do dia | 140 | 0 | **140** |
| Venda de 10 pizzas | 140 | 10 | **130** |
| Venda de 5 pizzas | 140 | 15 | **125** |
| Usuário ajustou manualmente (-5) | 140 | 15 | *muda para 120* |
| Nova venda de 20 pizzas | 140 | 35 | **105** ← substitui! |

**Observação importante**: Com este modelo, quando uma venda chega pelo Cardápio Web, ela **sobrescreve** qualquer ajuste manual anterior. O `final_sobra` será sempre `ideal - vendas_acumuladas`.

## Alterações Necessárias

### 1. Edge Function: `supabase/functions/cardapio-web-webhook/index.ts`

**Linhas 561-592** - Atualização de contagem existente:

```typescript
// DE (modelo atual - decremento):
const estoqueAtual = contagem.final_sobra ?? 0;
const novoFinalSobra = Math.max(0, estoqueAtual - quantidadeTotal);

// PARA (modelo substituição - baseado em vendas acumuladas):
const novoTotalBaixas = (contagem.cardapio_web_baixa_total || 0) + quantidadeTotal;
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas);
```

**Linhas 523-560** - Criação de nova contagem:

```typescript
// DE (modelo atual):
const estoqueInicial = idealDoDia;
const novoFinalSobra = Math.max(0, estoqueInicial - quantidadeTotal);
const novoTotalBaixas = quantidadeTotal;

// PARA (modelo substituição):
const novoTotalBaixas = quantidadeTotal;
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas);
// (mesma lógica, apenas mais claro semanticamente)
```

## Fluxo Corrigido

```text
DIA INICIA:
├── ideal_amanha = 140
├── cardapio_web_baixa_total = 0
└── final_sobra = 140 (ideal - 0)

VENDA WEB DE 10 PIZZAS:
├── cardapio_web_baixa_total = 10
└── final_sobra = 130 (140 - 10) ← SUBSTITUÍDO!

USUÁRIO AJUSTA MANUALMENTE (-5):
├── final_sobra = 125 (usuário ajustou para 125)
├── cardapio_web_baixa_total = 10 (não muda)
└── a_produzir = 15

NOVA VENDA WEB DE 20 PIZZAS:
├── cardapio_web_baixa_total = 30 (10 + 20)
└── final_sobra = 110 (140 - 30) ← SUBSTITUÍDO!
    (o ajuste manual é ignorado, sobra agora é baseada em vendas)
```

## Impacto

1. **Consistência**: O `final_sobra` sempre reflete `ideal - vendas_acumuladas` quando há vendas do Cardápio Web
2. **Ajustes manuais**: São preservados até a próxima venda automática (quando serão sobrescritos)
3. **Rastreabilidade**: `cardapio_web_baixa_total` continua rastreando vendas para auditoria
4. **A Produzir**: Continua funcionando com a fórmula `MAX(0, ideal - final_sobra)`

## Consideração Técnica

Este modelo assume que o `cardapio_web_baixa_total` é a **fonte da verdade** para vendas automáticas. Qualquer ajuste manual no `final_sobra` será sobrescrito quando uma nova venda chegar do Cardápio Web.

