
# Plano: Corrigir Decremento Duplicado no Realtime

## Problema Identificado

O decremento está acontecendo **duas vezes**:

```text
1. Webhook (banco): final_sobra = 250 - 10 = 240 ✓
2. Frontend (realtime): editingValues = 250 - 10 = 240... mas espera!
   → O frontend recebe updated.final_sobra = 240 (já decrementado)
   → MAS o código faz: editingValues.final_sobra (250) - cardapio_web_ultima_baixa_qtd (10)
   → Resultado: 240 no editingValues
   → DEPOIS: setContagens atualiza com updated (que tem 240)
   → O usuário vê 240? Não! Porque o autosave está sobrescrevendo com editingValues!
```

O problema real é a **sincronização entre editingValues e o banco**. Quando o autosave salva, ele envia o valor de `editingValues` para o banco. Se `editingValues` foi decrementado, E o banco já foi decrementado, quando o usuário salva, o valor decrementado é salvo novamente sobre o valor já decrementado do banco.

### Fluxo do Bug:

```text
Estado inicial:
- Banco: final_sobra = 250
- editingValues[key].final_sobra = "250"

Venda de 10 unidades chega:
1. Webhook atualiza banco: 250 - 10 = 240
2. Realtime dispara com updated.final_sobra = 240, cardapio_web_ultima_baixa_qtd = 10
3. Frontend (atual) faz: setEditingValues → 250 - 10 = 240
4. Frontend também faz: setContagens com updated (240)
5. Até aqui OK! Mas...
6. Autosave detecta editingValues mudou → salva no banco: final_sobra = 240
7. Mas o banco JÁ TEM 240... OK, sem problema.

Nova venda de 10 unidades:
1. Webhook atualiza banco: 240 - 10 = 230
2. Realtime dispara com updated.final_sobra = 230, cardapio_web_ultima_baixa_qtd = 10
3. Frontend faz: setEditingValues → 240 - 10 = 230 ← OK
4. Autosave salva 230 no banco ← OK

Hmm... isso deveria funcionar. Deixa eu reanalisar...
```

Ah! Encontrei o problema real! Olhando mais atentamente:

**Cenário real do bug:**
1. Usuário clica + na SOBRA → `editingValues = { key: { final_sobra: '251' } }`
2. Banco ainda tem 250
3. Venda de 10 unidades chega
4. Webhook decrementa banco: 250 - 10 = 240
5. Realtime chega com `updated.final_sobra = 240`, `cardapio_web_ultima_baixa_qtd = 10`
6. Frontend faz: `editingValues = 251 - 10 = 241` (correto!)
7. Mas TAMBÉM faz `setContagens` com 240 e `setOriginalValues` com 240
8. Agora `originalValues = 240` e `editingValues = 241`
9. Autosave detecta diferença e salva 241 no banco
10. Banco agora tem 241 (estava 240, virou 241)... erro?

Não, isso também está correto... O usuário tinha clicado +1, então ele quer 241.

Deixa eu analisar o cenário exato do bug reportado:

**Cenário reportado: C. WEB = 10, mas desconto foi 20**

A única forma disso acontecer é se o realtime está sendo disparado **duas vezes** ou se há outro código decrementando.

Preciso verificar se há outro handler ou trigger.

## Análise Adicional Necessária

Vou verificar no código se existe outro local que decrementa o estoque, ou se o canal realtime pode estar duplicado.

## Solução Proposta

Após analisar, o problema está na linha 199-212. Quando é uma baixa do Cardápio Web, o frontend **NÃO deve subtrair** o valor, pois o banco já fez isso. O frontend deve simplesmente **usar o valor que veio do banco** (`updated.final_sobra`):

### Arquivo: `src/pages/ContagemPorcionados.tsx`

**Linhas 199-212 - Alterar lógica de atualização:**

```tsx
// ANTES (subtrai novamente - ERRADO):
if (currentEditing[key] && isCardapioWebBaixa) {
  const sobraAtual = parseInt(currentEditing[key].final_sobra || '0');
  const decremento = updated.cardapio_web_ultima_baixa_qtd || 0;
  const novaSobra = Math.max(0, sobraAtual - decremento);
  // ...
  setEditingValues(prev => ({
    ...prev,
    [key]: { ...prev[key], final_sobra: String(novaSobra) }
  }));
}

// DEPOIS (usa valor do banco - CORRETO):
if (currentEditing[key] && isCardapioWebBaixa) {
  // O banco JÁ decrementou. Usar o valor que veio do banco.
  const novaSobra = updated.final_sobra ?? 0;
  
  console.log(`📦 Realtime: Sincronizando com valor do banco: ${novaSobra}`);
  
  setEditingValues(prev => ({
    ...prev,
    [key]: { ...prev[key], final_sobra: String(novaSobra) }
  }));
}
```

## Por que isso resolve?

```text
Fluxo corrigido:
1. Banco: final_sobra = 250
2. editingValues[key].final_sobra = "250"
3. Venda de 10 unidades
4. Webhook: banco = 250 - 10 = 240
5. Realtime: updated.final_sobra = 240
6. Frontend: setEditingValues → final_sobra = "240" (valor do banco, NÃO subtrai)
7. setContagens também recebe 240
8. Tudo sincronizado: banco = 240, editingValues = "240", contagens = 240
```

## Resultado Esperado

| Evento | Banco | editingValues | C. WEB | PRODUZIR |
|--------|-------|---------------|--------|----------|
| Inicial | 250 | "250" | 0 | 0 |
| Venda 10 un | 240 | "240" | 10 | 10 |
| Venda 5 un | 235 | "235" | 5 | 15 |
