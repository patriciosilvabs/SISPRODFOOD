

# Plano: Substituir Sobra pelo Estoque Virtual (Ideal - Vendas Acumuladas)

## ✅ Implementado

Quando o Cardápio Web envia uma venda, o sistema agora **substitui** o valor de `final_sobra` pela fórmula:

```
final_sobra = ideal_do_dia - vendas_acumuladas
```

### Mudança no Edge Function

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

**Antes (modelo decremento):**
```typescript
const estoqueAtual = contagem.final_sobra ?? 0;
const novoFinalSobra = Math.max(0, estoqueAtual - quantidadeTotal);
```

**Depois (modelo substituição):**
```typescript
const novoTotalBaixas = (contagem.cardapio_web_baixa_total || 0) + quantidadeTotal;
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas);
```

## Fluxo Atual

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

## Comportamento

1. **Consistência**: O `final_sobra` sempre reflete `ideal - vendas_acumuladas` quando há vendas do Cardápio Web
2. **Ajustes manuais**: São preservados até a próxima venda automática (quando serão sobrescritos)
3. **Rastreabilidade**: `cardapio_web_baixa_total` é a fonte da verdade para vendas automáticas
4. **A Produzir**: Continua funcionando com a fórmula `MAX(0, ideal - final_sobra)`
