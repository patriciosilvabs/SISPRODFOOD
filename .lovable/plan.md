

# Plano: Estoque Dinâmico Just-in-Time (Baixa por Venda)

## Contexto Atual vs. Modelo Desejado

| Aspecto | Modelo Atual | Modelo Just-in-Time |
|---------|-------------|---------------------|
| **Gatilho** | Funcionário registra sobra manualmente | Cada venda do Cardápio Web |
| **Campo Azul (Sobra)** | Valor positivo (ex: 50 un) | Acumulado negativo (ex: -101) |
| **Cálculo A Produzir** | `ideal - sobra` manual | `ideal + |vendas_acumuladas|` automático |
| **Atualização** | Apenas quando salva contagem | Em tempo real (webhook) |

## Diagnóstico

A integração já baixa o estoque corretamente! Os dados mostram:

```
UNIDADE ALEIXO - MUSSARELA:
├── final_sobra: -101 (negativo = vendas)
├── cardapio_web_baixa_total: 101
├── a_produzir: 101 ✅
└── ideal_amanha: 0 ❌ (deveria ser 100)
```

**Problema:** O webhook não busca o `ideal_amanha` da configuração semanal ao criar/atualizar a contagem.

## Solução Técnica

### 1. Atualizar Edge Function `cardapio-web-webhook`

Modificar para:
1. Buscar o `ideal` da tabela `estoques_ideais_semanais` baseado no dia da semana
2. Calcular automaticamente: `a_produzir = ideal + |vendas_acumuladas|` (quando final_sobra é negativo)
3. Atualizar o campo `a_produzir` junto com `final_sobra`

```typescript
// Ao processar cada item:

// 1. Buscar estoque ideal semanal para esta loja/item
const { data: estoqueIdeal } = await supabase
  .from('estoques_ideais_semanais')
  .select('segunda, terca, quarta, quinta, sexta, sabado, domingo')
  .eq('loja_id', loja_id)
  .eq('item_porcionado_id', mapping.item_porcionado_id)
  .single()

// 2. Calcular ideal do dia
const diaSemana = new Date().getDay()
const diasMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const idealDia = estoqueIdeal?.[diasMap[diaSemana]] || 0

// 3. Calcular a_produzir após baixa
const novoFinalSobra = (contagem.final_sobra || 0) - quantidadeTotal
const novoAProduzir = Math.max(0, idealDia - novoFinalSobra)

// 4. Atualizar com ambos os campos
await supabase
  .from('contagem_porcionados')
  .update({ 
    final_sobra: novoFinalSobra,
    ideal_amanha: idealDia,
    a_produzir: novoAProduzir,
    // ... outros campos
  })
```

### 2. Criar Contagem com Ideal Configurado

Quando não existe contagem e o webhook precisa criar uma:

```typescript
// Ao criar nova contagem:
const novoFinalSobra = -quantidadeTotal // Negativo = vendido
const novoAProduzir = idealDia + quantidadeTotal // 100 + 1 = 101

await supabase.from('contagem_porcionados').insert({
  loja_id,
  item_porcionado_id: mapping.item_porcionado_id,
  final_sobra: novoFinalSobra,    // -1
  ideal_amanha: idealDia,          // 100
  a_produzir: novoAProduzir,       // 101
  // ...
})
```

### 3. Interface (Já Funciona!)

A interface já:
- Mostra o campo azul com valor (positivo ou negativo)
- Permite ajustes manuais com + e -
- Exibe o botão laranja "A PRODUZIR" com o valor calculado

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/cardapio-web-webhook/index.ts` | Buscar `estoques_ideais_semanais` e calcular `a_produzir` automaticamente |

---

## Fluxo Após Implementação

```text
1. Cliente faz pedido no Cardápio Web
         ↓
2. Webhook recebe notificação
         ↓
3. Sistema busca ideal do dia (ex: 100)
         ↓
4. Sistema atualiza:
   - final_sobra: -1 (era 0, vendeu 1)
   - ideal_amanha: 100
   - a_produzir: 101 (100 - (-1) = 101)
         ↓
5. Tela de Contagem mostra:
   [Botão Azul: -1] [Botão Laranja: 101]
         ↓
6. Produção vê demanda em tempo real
```

---

## Resultado Esperado

A equipe da produção verá no botão laranja exatamente quantas unidades precisam ser produzidas para:
1. Repor as vendas da noite anterior
2. Atingir o estoque ideal de 100 unidades

**Exemplo:**
- Estoque ideal: 100
- Vendas da noite: 15 pizzas
- Tela mostrará: `[-15]` no azul e `[115]` no laranja

