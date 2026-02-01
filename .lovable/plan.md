

# Plano: Modelo Simplificado - Webhook Alimenta o Botão Azul ✅ IMPLEMENTADO

## Resumo da Solução

O sistema agora usa o **Modelo Simplificado** onde:
- O webhook do Cardápio Web **decrementa `final_sobra` diretamente**
- `a_produzir = MAX(0, ideal_amanha - final_sobra)` (coluna gerada no banco)
- Isso garante que `a_produzir` **nunca excede o ideal**

---

## Fluxo Operacional

| Hora | Evento | final_sobra | a_produzir |
|------|--------|-------------|------------|
| 00:00 | Dia começa (ideal = 100) | 100 | 0 |
| 21:30 | Venda de 2 pizzas | 98 | **2** |
| 22:15 | Venda de 3 pizzas | 95 | **5** |
| 00:30 | Mais 100 vendas (esgotou) | 0 | **100** ✅ (máximo!) |

### Antes (Modelo Antigo - Problemático)

```
a_produzir = cardapio_web_baixa_total (vendas acumuladas)
→ Podia mostrar 105 a produzir quando ideal era 100 ❌
```

### Depois (Modelo Simplificado - Correto)

```
final_sobra = MAX(0, estoque_atual - venda)
a_produzir = MAX(0, ideal - final_sobra)
→ Sempre limitado ao ideal ✅
```

---

## Mudanças Implementadas

### 1. Migration SQL
- Removida coluna `saldo_atual` (não necessária)
- Recriada coluna `a_produzir` como: `GREATEST(0, ideal_amanha - final_sobra)`

### 2. Edge Function (`cardapio-web-webhook`)
- Agora **decrementa** `final_sobra` diretamente a cada venda
- Ao criar contagem nova, inicializa `final_sobra = ideal_amanha` (estoque cheio)
- Mantém `cardapio_web_baixa_total` apenas para auditoria

### 3. Frontend
- Removida coluna "Saldo Atual" (redundante com o botão azul)
- Botão azul (`final_sobra`) agora reflete o estoque virtual

---

## Vantagens

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Complexidade | 3 camadas, cálculo JS | 1 campo, cálculo no banco |
| Limite | Podia exceder ideal | Limitado automaticamente |
| Visual | Funcionário não via vendas | Botão azul decresce em tempo real |
| Auditoria | Campos separados | `cardapio_web_baixa_total` para histórico |

---

## Contagem Manual

O funcionário ainda pode ajustar `final_sobra` manualmente:
- Se a contagem física diferir do virtual, ele corrige
- O sistema aceita o valor informado
- Útil para ajustes/correções
