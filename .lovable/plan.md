

# Plano: Modelo de Reposição por Consumo de Estoque Meta

## Visão Geral do Problema

O usuário deseja um novo modelo de cálculo onde:
- **Estoque Ideal (E.I.)** = teto diário configurado
- **Vendas Web** consumem esse teto (abatimento visual)
- **A Produzir** = quantidade consumida pelas vendas (para repor)

### Comparação de Modelos

| Modelo | Fórmula `A Produzir` | Exemplo (Ideal=100, Vendas=2) |
|--------|---------------------|-------------------------------|
| Atual (Contagem Física) | `ideal - sobra_física` | Depende da contagem manual |
| Novo (Consumo do Teto) | `vendas_web` | **2** (exato do consumo) ✅ |

---

## Arquitetura da Solução

### Novos Campos na Tabela `contagem_porcionados`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `saldo_atual` | integer (GENERATED) | Estoque virtual = `ideal_amanha - cardapio_web_baixa_total` |
| `a_produzir` | integer (GENERATED) | Quantidade a repor = `cardapio_web_baixa_total` (vendas acumuladas) |

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
│  │          │  │   Total: -2 un   │  │                    │ │
│  └──────────┘  └──────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Mudanças Técnicas

### 1. Migration SQL - Recriar Colunas Geradas

```sql
-- 1. Alterar fórmula de a_produzir para = vendas acumuladas
ALTER TABLE contagem_porcionados DROP COLUMN a_produzir;

ALTER TABLE contagem_porcionados 
ADD COLUMN a_produzir integer 
GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(cardapio_web_baixa_total, 0))
) STORED;

-- 2. Criar nova coluna saldo_atual = ideal - vendas
ALTER TABLE contagem_porcionados 
ADD COLUMN saldo_atual integer 
GENERATED ALWAYS AS (
  GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(cardapio_web_baixa_total, 0))
) STORED;
```

### 2. Atualizar Interface (`ContagemItemCard.tsx`)

Adicionar novo campo visual "Saldo Atual":
- Cor verde quando `saldo_atual` > 0
- Cor vermelha quando `saldo_atual` = 0 (estoque esgotado)

### 3. Atualizar Interface (`ContagemPorcionados.tsx`)

- Adicionar `saldo_atual` ao tipo `Contagem`
- Passar a prop para `ContagemItemCard`

### 4. Edge Function - Sem alterações estruturais

A Edge Function já:
- Incrementa `cardapio_web_baixa_total` a cada venda
- O banco calcula automaticamente `saldo_atual` e `a_produzir`

### 5. Reset de Produção (Dia Novo)

Quando o sistema cria contagens para um novo `dia_operacional`:
- `cardapio_web_baixa_total` começa em 0
- `saldo_atual` = `ideal_amanha` (teto cheio)
- `a_produzir` = 0 (nada a repor ainda)

---

## Fluxo Operacional

### Exemplo: Dia Começa com Ideal = 100

| Hora | Evento | cardapio_web_baixa_total | saldo_atual | a_produzir |
|------|--------|--------------------------|-------------|------------|
| 00:00 | Dia começa | 0 | 100 | 0 |
| 21:30 | Venda de 2 pizzas | 2 | 98 | **2** |
| 22:15 | Venda de 3 pizzas | 5 | 95 | **5** |
| 23:00 | Venda de 1 pizza | 6 | 94 | **6** |
| 06:00 | Produção manhã vê | - | - | **6** |

### Produção da Manhã

O pessoal da manhã verá:
- `A Produzir = 6` (total vendido na noite)
- Ao confirmar produção (no Painel Kanban), o sistema:
  1. Registra a produção concluída
  2. Zera `cardapio_web_baixa_total` para o novo ciclo OU
  3. Aguarda virada automática de `dia_operacional`

---

## Regra de Reset

O reset acontece automaticamente quando:
1. Muda o `dia_operacional` (00:00 horário SP)
2. Nova contagem é criada com `cardapio_web_baixa_total = 0`

Alternativamente, se precisar reset manual ao confirmar produção:
- Adicionar botão/ação que zera `cardapio_web_baixa_total`
- Isso faz `saldo_atual` voltar ao `ideal_amanha`

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Migration SQL** | Recriar `a_produzir` e adicionar `saldo_atual` |
| `src/components/contagem/ContagemItemCard.tsx` | Adicionar coluna visual "Saldo Atual" |
| `src/pages/ContagemPorcionados.tsx` | Incluir `saldo_atual` no tipo e passar como prop |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente após migration |

---

## Considerações

### Sobre o Campo `final_sobra` (Sobra Física)

No novo modelo, o campo `final_sobra` (contagem manual) pode:
1. **Ser mantido** - para auditoria e contagem física real
2. **Ser ocultado** - se o foco for 100% no modelo automático

**Recomendação**: Manter ambos visíveis para permitir comparação entre:
- Estoque virtual (saldo_atual = ideal - vendas)
- Estoque real (final_sobra = contagem física)

---

## Vantagens do Novo Modelo

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Cálculo | Baseado em contagem manual | Automático por vendas |
| Precisão | Depende do funcionário | Exato das vendas web |
| Tempo real | Atualiza só na contagem | Atualiza a cada venda |
| Visual | Apenas "A Produzir" | Saldo + Vendas + A Produzir |

