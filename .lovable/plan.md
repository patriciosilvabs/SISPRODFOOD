

# Plano: Modelo de Reposição por Consumo de Estoque Meta

## ✅ Status: IMPLEMENTADO

## Visão Geral

O sistema agora utiliza o **Modelo de Reposição por Consumo**, onde:
- **Estoque Ideal (E.I.)** = teto diário configurado por dia da semana
- **Vendas Web** consomem esse teto (via webhook do Cardápio Web)
- **A Produzir** = quantidade consumida pelas vendas (para repor)
- **Saldo Atual** = estoque virtual restante (Ideal - Vendas)

### Comparação de Modelos

| Modelo | Fórmula `A Produzir` | Exemplo (Ideal=100, Vendas=2) |
|--------|---------------------|-------------------------------|
| Antigo (Contagem Física) | `ideal - sobra_física` | Depende da contagem manual |
| **Novo (Consumo do Teto)** | `vendas_web` | **2** (exato do consumo) ✅ |

---

## Arquitetura Implementada

### Colunas na Tabela `contagem_porcionados`

| Campo | Tipo | Fórmula |
|-------|------|---------|
| `saldo_atual` | integer (GENERATED) | `GREATEST(0, ideal_amanha - cardapio_web_baixa_total)` |
| `a_produzir` | integer (GENERATED) | `GREATEST(0, cardapio_web_baixa_total)` |

### Fluxo Visual na Interface

```text
┌─────────────────────────────────────────────────────────────┐
│  Item: PIZZA CALABRESA                                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ Saldo    │  │   Cardápio Web   │  │    A PRODUZIR      │ │
│  │  Atual   │  │   (Vendas do Dia)│  │   (Laranja)        │ │
│  │ ──────── │  │  ──────────────  │  │ ───────────────    │ │
│  │    98    │  │   -2 às 14:32    │  │        2           │ │
│  │  (verde) │  │   Total: -2 un   │  │                    │ │
│  └──────────┘  └──────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Cores do Saldo Atual

| Condição | Cor |
|----------|-----|
| `saldo_atual` > 30% do Ideal | 🟢 Verde (estoque OK) |
| `saldo_atual` < 30% do Ideal | 🟡 Amarelo (baixo) |
| `saldo_atual` = 0 | 🔴 Vermelho (esgotado) |

---

## Fluxo Operacional

### Exemplo: Dia Começa com Ideal = 100

| Hora | Evento | vendas_web | saldo_atual | a_produzir |
|------|--------|------------|-------------|------------|
| 00:00 | Dia começa | 0 | 100 | 0 |
| 21:30 | Venda de 2 pizzas | 2 | 98 | **2** |
| 22:15 | Venda de 3 pizzas | 5 | 95 | **5** |
| 23:00 | Venda de 1 pizza | 6 | 94 | **6** |
| 06:00 | Produção manhã vê | - | - | **6** |

### Reset Automático

O reset acontece quando muda o `dia_operacional` (00:00 horário SP):
- Nova contagem criada com `cardapio_web_baixa_total = 0`
- `saldo_atual` = `ideal_amanha` (teto cheio)
- `a_produzir` = 0 (nada a repor ainda)

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| **Migration SQL** | Recriou `a_produzir` e adicionou `saldo_atual` como colunas geradas |
| `src/components/contagem/ContagemItemCard.tsx` | Adicionou coluna visual "Saldo" com ícone Package |
| `src/pages/ContagemPorcionados.tsx` | Incluiu `saldo_atual` no tipo e passa como prop |

---

## Considerações

### Sobre o Campo `final_sobra` (Sobra Física)

O campo `final_sobra` (contagem manual) foi mantido para:
- Auditoria e contagem física real
- Comparação entre estoque virtual vs estoque real

### Sobre `cardapio_web_baixa_total`

Este campo é usado apenas para:
- Rastreamento de vendas web acumuladas
- Cálculo automático de `a_produzir` e `saldo_atual` pelo banco
- **NÃO** influencia mais a contagem manual

---

## Vantagens do Novo Modelo

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Cálculo | Baseado em contagem manual | Automático por vendas |
| Precisão | Depende do funcionário | Exato das vendas web |
| Tempo real | Atualiza só na contagem | Atualiza a cada venda |
| Visual | Apenas "A Produzir" | Saldo + Vendas + A Produzir |
