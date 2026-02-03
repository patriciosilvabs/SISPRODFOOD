
# Plano: Corrigir Detecção de Baixa do Cardápio Web no Realtime

## Problema Identificado

O webhook do Cardápio Web **NÃO está atualizando o campo `usuario_nome`** nas operações de UPDATE:

```typescript
// No webhook (linha 686-697):
.update({ 
  final_sobra: novoFinalSobra,
  ideal_amanha: idealDoDia,
  updated_at: agora,
  cardapio_web_baixa_total: novoTotalBaixas,
  cardapio_web_ultima_baixa_at: agora,
  cardapio_web_ultima_baixa_qtd: quantidadeTotal,
  // ❌ NÃO TEM: usuario_nome: 'Cardápio Web'
})
```

Enquanto isso, o frontend verifica:
```typescript
const isCardapioWebBaixa = updated.cardapio_web_ultima_baixa_qtd > 0 &&
                           updated.usuario_nome === 'Cardápio Web'; // ← SEMPRE FALSE!
```

### Fluxo do Bug:

```text
1. Usuário edita: usuario_nome = "DOM HELDER PIZZARIA"
2. Venda chega via Cardápio Web
3. Webhook UPDATE: final_sobra -= 10, cardapio_web_ultima_baixa_qtd = 10
   → NÃO atualiza usuario_nome → permanece "DOM HELDER PIZZARIA"
4. Realtime recebe: usuario_nome = "DOM HELDER PIZZARIA"
5. Frontend: isCardapioWebBaixa = false (porque usuario_nome ≠ "Cardápio Web")
6. Frontend ignora a atualização
7. Autosave envia valor antigo → decrementa novamente
```

Confirmação nos dados do banco:
- `usuario_nome: 'DOM HELDER PIZZARIA'` (não 'Cardápio Web')
- `cardapio_web_ultima_baixa_qtd: 10` (venda foi de 10)
- `final_sobra: 230` (decrementou 20 em vez de 10)

## Solução

Há duas opções. A mais robusta é atualizar o **webhook** para incluir `usuario_nome: 'Cardápio Web'` no UPDATE.

### Opção 1 (Recomendada): Atualizar Webhook

**Arquivo: `supabase/functions/cardapio-web-webhook/index.ts`**

Na linha 688-697, adicionar `usuario_nome`:

```typescript
.update({ 
  final_sobra: novoFinalSobra,
  ideal_amanha: idealDoDia,
  updated_at: agora,
  usuario_nome: 'Cardápio Web', // ← ADICIONAR
  // Campos de rastreamento Cardápio Web (auditoria)
  cardapio_web_baixa_total: novoTotalBaixas,
  cardapio_web_ultima_baixa_at: agora,
  cardapio_web_ultima_baixa_qtd: quantidadeTotal,
})
```

### Opção 2 (Alternativa): Alterar Detecção no Frontend

Se preferir não alterar o webhook, podemos mudar a lógica de detecção no frontend para usar o campo `cardapio_web_ultima_baixa_at` (timestamp da última baixa):

```typescript
// Verificar se é uma baixa recente do Cardápio Web (últimos 5 segundos)
const agora = new Date().getTime();
const timestampBaixa = updated.cardapio_web_ultima_baixa_at 
  ? new Date(updated.cardapio_web_ultima_baixa_at).getTime() 
  : 0;
const baixaRecente = (agora - timestampBaixa) < 5000; // 5 segundos

const isCardapioWebBaixa = updated.cardapio_web_ultima_baixa_qtd > 0 && baixaRecente;
```

## Recomendação

A **Opção 1** é mais robusta e semântica - o campo `usuario_nome` passa a refletir corretamente quem fez a última alteração. Isso também melhora a auditoria.

## Mudanças Técnicas

### Arquivo: `supabase/functions/cardapio-web-webhook/index.ts`

**Linha 688-697 - Adicionar `usuario_nome` e `usuario_id` no UPDATE:**

```typescript
const { error: updateError } = await supabase
  .from('contagem_porcionados')
  .update({ 
    final_sobra: novoFinalSobra,
    ideal_amanha: idealDoDia,
    updated_at: agora,
    usuario_id: '00000000-0000-0000-0000-000000000000', // Sistema
    usuario_nome: 'Cardápio Web', // ← ADICIONAR
    // Campos de rastreamento
    cardapio_web_baixa_total: novoTotalBaixas,
    cardapio_web_ultima_baixa_at: agora,
    cardapio_web_ultima_baixa_qtd: quantidadeTotal,
  })
  .eq('id', contagem.id)
```

## Fluxo Corrigido

```text
1. Usuário edita: usuario_nome = "DOM HELDER PIZZARIA", final_sobra = 250
2. Venda de 10 un chega via Cardápio Web
3. Webhook UPDATE: final_sobra = 240, usuario_nome = "Cardápio Web"
4. Realtime recebe: usuario_nome = "Cardápio Web", final_sobra = 240
5. Frontend: isCardapioWebBaixa = TRUE ✓
6. Frontend: setEditingValues com final_sobra = 240
7. UI mostra: SOBRA = 240, C. WEB = 10, PRODUZIR = 10 ✓
```

## Resultado Esperado

| Evento | Banco | UI SOBRA | C. WEB | PRODUZIR |
|--------|-------|----------|--------|----------|
| Inicial | 250 | 250 | 0 | 0 |
| Venda 10 un | 240 | 240 | 10 | 10 |
| Venda 5 un | 235 | 235 | 5 | 15 |
