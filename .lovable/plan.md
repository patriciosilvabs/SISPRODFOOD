
# Plano: Corrigir Lógica de "A Produzir" para Modelo Baseado em Vendas

## Problema Identificado

A fórmula atual calcula o que falta para atingir o estoque ideal:
```
a_produzir = ideal - sobra_atual
```

O modelo esperado é baseado em **repor vendas**:
```
a_produzir = vendas_acumuladas (limitado ao ideal)
```

### Exemplo Concreto

| Situação | Lógica Atual | Lógica Esperada |
|----------|--------------|-----------------|
| Ideal = 140 | | |
| Sobra inicial = 210 | | |
| Vendas = 100 | | |
| Sobra atual = 110 | | |
| **A Produzir** | `140 - 110 = 30` | `MIN(140, 100) = 100` |

### Por que a lógica atual está incorreta?

O modelo JIT atual assume que o objetivo é **manter um teto fixo** de estoque. Se a loja tem 210 (acima do ideal), vendas apenas "consomem o excedente" até atingir o ideal novamente.

O modelo correto para este negócio é **repor cada unidade vendida**, independente da sobra física inicial. Cada pizza vendida deve gerar uma pizza a produzir.

## Solução

### Mudança na Fórmula

**Antes:**
```sql
a_produzir = GREATEST(0, ideal_amanha - final_sobra)
```

**Depois:**
```sql
a_produzir = LEAST(
  COALESCE(ideal_amanha, 0),
  COALESCE(cardapio_web_baixa_total, 0)
)
```

Esta fórmula garante:
1. **A produzir = vendas**: Cada unidade vendida gera demanda de produção
2. **Limitado ao ideal**: Nunca produzir mais que o ideal configurado
3. **Simples e previsível**: O operador vê venda = produção

### Alteração no Banco de Dados

Alterar a definição da coluna gerada `a_produzir`:

```sql
ALTER TABLE contagem_porcionados 
DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados
ADD COLUMN a_produzir integer GENERATED ALWAYS AS (
  LEAST(
    COALESCE(ideal_amanha, 0),
    COALESCE(cardapio_web_baixa_total, 0)
  )
) STORED;
```

## Fluxo Corrigido

```text
DIA INICIA:
├── final_sobra = ideal_amanha (ex: 140)
├── cardapio_web_baixa_total = 0
└── a_produzir = 0

VENDA DE 50 PIZZAS:
├── final_sobra decrementado = 90 (140 - 50)
├── cardapio_web_baixa_total = 50
└── a_produzir = MIN(140, 50) = 50 ✓

VENDA DE MAIS 50 PIZZAS:
├── final_sobra decrementado = 40 (90 - 50)
├── cardapio_web_baixa_total = 100
└── a_produzir = MIN(140, 100) = 100 ✓
```

## Considerações

### Contagem Manual
Se o operador fizer contagem manual (botão azul), isso não afeta `a_produzir` no novo modelo, pois a produção é baseada apenas em:
1. Vendas registradas pelo Cardápio Web (`cardapio_web_baixa_total`)
2. Limite do estoque ideal (`ideal_amanha`)

### Lojas sem Cardápio Web
Para lojas que não usam Cardápio Web, `cardapio_web_baixa_total` será 0, então `a_produzir` também será 0. Essas lojas continuarão usando o modelo de demanda manual via contagem.

---

**Resultado esperado**: Com ideal = 140 e 100 pizzas vendidas, `a_produzir` mostrará **100** (não 30).
