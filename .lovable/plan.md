
# Plano: Correção da Lógica do Modelo Tanque Cheio

## Problema Identificado

O sistema está com dois erros críticos:

### Erro 1: Vendas Acumuladas Muito Altas
O campo `cardapio_web_baixa_total` tem **556 vendas** enquanto o ideal é apenas **140**. Isso significa que as vendas acumuladas já ultrapassaram o teto. O cálculo atual faz:
```
final_sobra = MAX(0, 140 - 556) = 0
a_produzir = 140 - 0 = 140  ❌ (deveria mostrar 556 ou limitar ao ideal)
```

### Erro 2: O Modelo Tanque Cheio Está Invertido
**Lógica ATUAL (errada):**
```typescript
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas)
// Se ideal=140 e vendas=50 → sobra=90 → a_produzir=50
// Se ideal=140 e vendas=556 → sobra=0 → a_produzir=140 ❌
```

**Lógica que você quer:**
- `A PRODUZIR` deve SEMPRE mostrar as VENDAS (o que foi consumido)
- O teto máximo de `A PRODUZIR` é o `IDEAL`

---

## Solução Proposta

### Nova Lógica do Cálculo
Para o modelo "Tanque Cheio" funcionar corretamente, precisamos garantir que:

```
final_sobra = MAX(0, ideal_do_dia - vendas_totais)
a_produzir = MIN(vendas_totais, ideal_do_dia)
```

**Mas o banco calcula** `a_produzir = GREATEST(0, ideal - final_sobra)`, então precisamos ajustar o `final_sobra` para que a fórmula produza o resultado correto.

### Tabela de Cenários

| Cenário | Ideal | Vendas | final_sobra (calc) | a_produzir (banco) |
|---------|-------|--------|-------------------|-------------------|
| Vendas < Ideal | 140 | 50 | 140 - 50 = 90 | 140 - 90 = **50** |
| Vendas = Ideal | 140 | 140 | 140 - 140 = 0 | 140 - 0 = **140** |
| Vendas > Ideal | 140 | 556 | 140 - 556 = -416 → 0 | 140 - 0 = **140** |

**Problema:** Quando vendas > ideal, o sistema mostra `a_produzir = 140` (o ideal inteiro), mas deveria limitar as vendas ao ideal ou mostrar as vendas reais.

---

## Duas Opções de Correção

### Opção A: A Produzir = Vendas (sem limite)
Se você quer que `A PRODUZIR` mostre EXATAMENTE o que foi vendido, mesmo acima do ideal:
- Mudar a coluna gerada no banco para: `a_produzir = cardapio_web_baixa_total`
- Ou usar `final_sobra` para armazenar o NEGATIVO do consumo

### Opção B: A Produzir = MIN(Vendas, Ideal) - Limitado ao teto
Se você quer que `A PRODUZIR` mostre as vendas, mas limitado ao ideal máximo:
- Manter a lógica atual do banco
- O sistema já está funcionando para esse cenário quando vendas < ideal

---

## Alterações Necessárias

### Arquivo: `supabase/functions/cardapio-web-webhook/index.ts`

**Cenário de Criação (linhas 556-557):**
```typescript
// ATUAL:
const novoFinalSobra = Math.max(0, idealDoDia - quantidadeTotal)

// PROPOSTA (fazer final_sobra = ideal - vendas, permitindo negativo internamente):
// Mas como usamos Math.max, precisa de ajuste na lógica
```

**Cenário de Atualização (linhas 594-596):**
```typescript
// ATUAL:
const novoTotalBaixas = vendasAnteriores + quantidadeTotal
const novoFinalSobra = Math.max(0, idealDoDia - novoTotalBaixas)

// PROPOSTA: Se queremos que a_produzir = vendas (limitado ao ideal)
// Quando vendas > ideal, a_produzir será o ideal (teto)
// Isso já está acontecendo - é o comportamento esperado?
```

---

## Esclarecimento Necessário

Preciso confirmar qual comportamento você espera:

| Ideal | Vendas | O que deve aparecer em "A PRODUZIR"? |
|-------|--------|--------------------------------------|
| 140 | 50 | **50** (as vendas) |
| 140 | 140 | **140** (as vendas = ideal) |
| 140 | 556 | **140** (limitado ao ideal) ou **556** (vendas reais)? |

Se o funcionário vendeu 556 unidades mas o ideal é 140, ele deve:
- **Opção A:** Produzir 556 (tudo que vendeu, mesmo acima do ideal)
- **Opção B:** Produzir 140 (o máximo configurado)

---

## Problema Adicional: Lojas Sem Ideal Configurado

Para CACHOEIRINHA e ALEIXO, o `ideal_amanha = 0` indica que a função `getIdealDoDia` não encontrou configuração de estoque ideal. Isso precisa ser verificado:

1. Confirmar se há registro em `estoques_ideais_semanais` para essas lojas
2. Verificar se o `loja_id` do webhook corresponde ao `loja_id` da tabela de estoques

---

## Detalhes Técnicos

**Arquivos a modificar:**
- `supabase/functions/cardapio-web-webhook/index.ts` - Linhas 550-625

**Mudanças específicas** (dependem da opção escolhida):

Para **Opção B** (A Produzir limitado ao Ideal):
1. Manter a lógica atual - ela já está correta para esse cenário
2. Quando vendas > ideal, `a_produzir = ideal` (teto)

Para **Opção A** (A Produzir = Vendas sem limite):
1. Mudar a coluna gerada no banco para usar `cardapio_web_baixa_total`
2. Ou armazenar `final_sobra` como o valor negativo (ideal - vendas)

**Recomendação:** Opção B é mais segura para controle de produção, evitando superprodução.
