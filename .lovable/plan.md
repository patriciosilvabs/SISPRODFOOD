
# Plano: Correção da Lógica de Decremento Real no Webhook Cardápio Web

## Diagnóstico Confirmado

Você identificou corretamente o problema na lógica do webhook. Após analisar o código (linhas 620-656), confirmo:

### Problema Atual (Linha 628)
```typescript
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas)
```

**O que faz:** Recalcula o saldo como `Ideal - Total de Vendas Acumuladas`, ignorando qualquer ajuste manual feito pelo funcionário.

**Exemplo do problema:**
1. Ideal = 140, Vendas = 50 → Sistema calcula saldo = 90
2. Funcionário ajusta para 105 (clicou + porque viu mais massa)
3. Nova venda de 5 → Sistema faz `140 - 55 = 85`, sobrescrevendo o 105

### Solução Proposta (Decremento Real)
```typescript
const estoqueAtual = (contagem as any).final_sobra || 0
const novoFinalSobra = Math.max(0, estoqueAtual - quantidadeTotal)
```

**O que fará:** Subtrai apenas a venda atual do valor que está no campo azul (respeitando ajustes manuais).

**Exemplo corrigido:**
1. Ideal = 140, Vendas = 50 → Sistema calcula saldo = 90
2. Funcionário ajusta para 105
3. Nova venda de 5 → Sistema faz `105 - 5 = 100` ✅

---

## Mudanças Necessárias

### Arquivo: `supabase/functions/cardapio-web-webhook/index.ts`

#### 1. Cenário de Atualização (Linhas 626-630)

**Antes:**
```typescript
const vendasAnteriores = ((contagem as unknown as Record<string, number>).cardapio_web_baixa_total || 0)
const novoTotalBaixas = vendasAnteriores + quantidadeTotal
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas)
```

**Depois:**
```typescript
const vendasAnteriores = ((contagem as unknown as Record<string, number>).cardapio_web_baixa_total || 0)
const novoTotalBaixas = vendasAnteriores + quantidadeTotal

// DECREMENTO REAL: Subtrai da sobra atual (respeitando ajustes manuais)
const estoqueAtual = ((contagem as unknown as Record<string, number>).final_sobra || 0)
const novoFinalSobra = Math.max(0, estoqueAtual - quantidadeTotal)
```

#### 2. Atualizar Log de Debug (Linha 630)

**Antes:**
```typescript
console.log(`📦 Atualizando contagem (tanque cheio): ideal=${idealDoDia}, vendas_anteriores=${vendasAnteriores} + novas=${quantidadeTotal} = vendas_total=${novoTotalBaixas} → saldo_restante=${novoFinalSobra}, a_produzir=${idealDoDia - novoFinalSobra}`)
```

**Depois:**
```typescript
console.log(`📦 Atualizando contagem (decremento real): estoque_atual=${estoqueAtual} - vendas_novas=${quantidadeTotal} = saldo_novo=${novoFinalSobra} (vendas_acumuladas=${novoTotalBaixas}, ideal=${idealDoDia})`)
```

#### 3. Cenário de Criação (Linhas 588-591) - Manter Igual

O cenário de criação (primeira venda do dia) continua correto:
```typescript
const novoFinalSobra = Math.max(0, idealDoDia - quantidadeTotal)
```

Isso está certo porque na primeira venda do dia, assumimos que o "tanque estava cheio" (Ideal).

---

## Comportamento Final Esperado

| Hora | Ação | Estoque Anterior | Venda | Estoque Novo | a_produzir |
|------|------|------------------|-------|--------------|------------|
| 08:00 | Início do dia | - | - | 140 (ideal) | 0 |
| 10:00 | Venda 10 pizzas | 140 | 10 | 130 | 10 |
| 12:00 | Ajuste manual +15 | 130 | - | 145 | 0 |
| 14:00 | Venda 5 pizzas | 145 | 5 | 140 | 0 |
| 16:00 | Venda 50 pizzas | 140 | 50 | 90 | 50 |

**Resultado:** O botão laranja sempre mostrará `Ideal - final_sobra`, que representa o que realmente falta para repor.

---

## Detalhes Técnicos da Implementação

1. **Modificar apenas 2-3 linhas** no cenário de atualização (linha 628)
2. **Manter `cardapio_web_baixa_total`** como registro de auditoria (total de vendas do dia)
3. **Manter o log atualizado** para facilitar debugging futuro
4. **Deploy automático** da Edge Function após aprovação

---

## Nota sobre Dados Existentes

Os dados de hoje já estão "corrompidos" pelo cálculo antigo. Após a correção:
- Novas vendas respeitarão o valor atual do campo azul
- O funcionário pode fazer um ajuste manual para "resetar" se necessário
- Amanhã o sistema iniciará com o Ideal correto (tanque cheio)

**Opção adicional:** Podemos criar uma query SQL para recalcular os saldos atuais baseado nas vendas reais de hoje, se necessário.
