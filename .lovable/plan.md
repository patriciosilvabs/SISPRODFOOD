
# Plano: Correção de Webhooks Duplicados e Lógica do Modelo Tanque Cheio

## Problemas Identificados

### Problema 1: Webhooks Duplicados Dobrando Vendas
Descobri que os pedidos estão sendo processados **múltiplas vezes**, causando inflação artificial das vendas:

| Order ID | Vezes Processado | Intervalo | Tipo |
|----------|------------------|-----------|------|
| 179919610 | 2x | 6h51min | ORDER_CREATED + ORDER_STATUS_UPDATED |
| 179964837 | 2x | 21 seg | 2x ORDER_CREATED (duplicado) |
| 179971611 | 2x | 2.6 seg | 2x ORDER_CREATED (race condition) |

**Impacto:** 606 vendas registradas quando deveriam ser aproximadamente 303 (metade).

### Problema 2: Race Condition na Verificação de Idempotência
A verificação atual faz:
1. SELECT para verificar se existe log com `sucesso = true`
2. Se não existe, processa o webhook
3. INSERT do log após processar

**Falha:** Quando 2 webhooks chegam simultaneamente, ambos passam pelo passo 1 antes de qualquer um chegar ao passo 3.

### Problema 3: Vendas Ultrapassando o Ideal
Com vendas = 606 e ideal = 140:
- `final_sobra = MAX(0, 140 - 606) = 0`
- `a_produzir = 140 - 0 = 140`

Isso está **correto** segundo a regra aprovada (Opção B - limitado ao teto). O problema é que as vendas estão **infladas** por causa dos duplicados.

---

## Soluções Propostas

### Solução 1: Constraint UNIQUE no Banco de Dados
Adicionar uma constraint UNIQUE na tabela `cardapio_web_pedidos_log` para impedir duplicatas:

```sql
ALTER TABLE cardapio_web_pedidos_log 
ADD CONSTRAINT unique_order_per_org_event UNIQUE (organization_id, order_id, evento);
```

### Solução 2: Usar INSERT ... ON CONFLICT na Edge Function
Modificar a Edge Function para usar INSERT com ON CONFLICT:

```typescript
// Antes de processar, tentar inserir registro pendente
const { data: inserted, error: insertErr } = await supabase
  .from('cardapio_web_pedidos_log')
  .insert({
    organization_id,
    loja_id,
    order_id: orderId,
    evento,
    payload,
    sucesso: false, // Ainda não processado
    itens_processados: null,
    erro: 'processando'
  })
  .select('id')
  .single()

// Se der conflito (UNIQUE violation), significa que já existe
if (insertErr?.code === '23505') {
  console.log(`⏭️ Pedido ${orderId} já em processamento ou processado.`)
  return // Sair sem processar
}
```

### Solução 3: Adicionar Verificação de Evento no Webhook
O código atual processa `ORDER_STATUS_UPDATED` e baixa estoque novamente. Devemos evitar isso:

```typescript
// Adicionar verificação ANTES de processar itens
if (evento === 'ORDER_STATUS_UPDATED') {
  // Apenas registrar, não baixar estoque
  await supabase.from('cardapio_web_pedidos_log').insert({
    organization_id,
    loja_id,
    order_id: orderId,
    evento,
    payload,
    sucesso: true,
    itens_processados: null,
    erro: 'Status update - estoque não processado'
  })
  return new Response(JSON.stringify({ success: true, message: 'Status logged' }))
}
```

### Solução 4: Corrigir Dados Existentes
Após implementar as correções, recalcular os dados corretos:

```sql
-- Recalcular vendas reais (sem duplicados)
WITH vendas_reais AS (
  SELECT DISTINCT ON (order_id) 
    order_id,
    (itens_processados::jsonb->0->'itens_baixados'->0->>'quantidade_baixada')::integer as massa
  FROM cardapio_web_pedidos_log
  WHERE loja_id = 'a6dfb4f5-23db-4a36-b104-6db03e5917ea'
  AND sucesso = true
  AND created_at >= CURRENT_DATE
  AND itens_processados IS NOT NULL
),
total AS (
  SELECT SUM(massa) as total_vendas FROM vendas_reais
)
-- Atualizar contagem com valor correto
UPDATE contagem_porcionados cp
SET 
  cardapio_web_baixa_total = t.total_vendas,
  final_sobra = GREATEST(0, cp.ideal_amanha - t.total_vendas)
FROM total t
WHERE cp.id = '69621904-cadc-4530-89bc-536be8b766c5';
```

---

## Detalhes Técnicos

### Arquivos a Modificar

1. **`supabase/functions/cardapio-web-webhook/index.ts`** (linhas 272-299 e 300-350)
   - Melhorar verificação de idempotência com INSERT ON CONFLICT
   - Adicionar tratamento específico para ORDER_STATUS_UPDATED

2. **Migração SQL**
   - Adicionar UNIQUE constraint na tabela `cardapio_web_pedidos_log`

### Mudanças Específicas no Edge Function

**Antes (atual):**
```typescript
// Verificação via SELECT
const { data: existingLog } = await supabase
  .from('cardapio_web_pedidos_log')
  .select('id')
  .eq('order_id', orderId)
  .eq('organization_id', organization_id)
  .eq('sucesso', true)
  .maybeSingle()
```

**Depois (proposto):**
```typescript
// Verificação via INSERT atômico
const { error: lockErr } = await supabase
  .from('cardapio_web_pedidos_log')
  .insert({
    organization_id,
    loja_id,
    order_id: orderId,
    evento,
    payload,
    sucesso: false, // Reserva o slot
  })

if (lockErr?.code === '23505') {
  return { message: 'Já processado' } // UNIQUE violation
}
```

---

## Ordem de Implementação

1. Criar migração SQL com UNIQUE constraint
2. Atualizar Edge Function com nova lógica de idempotência
3. Adicionar filtro para ORDER_STATUS_UPDATED
4. Corrigir dados duplicados existentes no banco
5. Testar com webhook simulado

---

## Resultado Esperado

Após as correções:
- Para JAPIIM com ideal=140 e apenas 50 vendas (sem duplicatas):
  - `final_sobra = 140 - 50 = 90`
  - `a_produzir = 140 - 90 = 50` ✅

- Webhooks duplicados serão rejeitados automaticamente
- Race conditions serão evitadas com INSERT atômico
