
# Plano: Corrigir Sincronização Cardápio Web → SOBRA

## Problema Identificado

Quando uma venda chega do Cardápio Web, o sistema **deveria** subtrair da coluna SOBRA (ex: 250 → 249). Porém, na situação atual:

1. Usuário clica em +/- → cria entrada em `editingValues`
2. Webhook do Cardápio Web decrementa no banco (250 → 249)
3. Realtime tenta atualizar a UI, mas **ignora** porque `editingValues[key]` existe
4. Auto-save (800ms depois) salva o valor antigo (250) de volta ao banco
5. O decremento do webhook é sobrescrito!

**Resultado**: A coluna SOBRA permanece em 250 mesmo após 524 vendas do Cardápio Web.

## Solução

Em vez de ignorar completamente as atualizações realtime quando há edição, devemos:

1. **Detectar se é uma baixa do Cardápio Web** (campo `cardapio_web_ultima_baixa_qtd` presente)
2. **Aplicar o decremento no `editingValues`** para que o valor seja sincronizado
3. Manter o bloqueio apenas para atualizações que NÃO são do Cardápio Web (evitar conflitos de edição simultânea)

## Mudanças Técnicas

### Arquivo: `src/pages/ContagemPorcionados.tsx`

**Linhas 174-226** - Modificar a lógica do handler realtime:

```tsx
(payload) => {
  const updated = payload.new as Contagem;
  const key = `${updated.loja_id}-${updated.item_porcionado_id}`;
  
  // Verificar se é uma baixa do Cardápio Web
  const isCardapioWebBaixa = updated.cardapio_web_ultima_baixa_qtd && 
                              updated.cardapio_web_ultima_baixa_qtd > 0 &&
                              updated.usuario_nome === 'Cardápio Web';
  
  // Se o usuário está editando E NÃO é baixa do Cardápio Web, ignorar
  if (editingValues[key] && !isCardapioWebBaixa) {
    console.log(`🔒 Realtime: Item ${key} sendo editado, ignorando atualização remota`);
    return;
  }
  
  // Se é baixa do Cardápio Web E usuário está editando, aplicar decremento no editingValues
  if (editingValues[key] && isCardapioWebBaixa) {
    const sobraAtual = parseInt(editingValues[key].final_sobra || '0');
    const decremento = updated.cardapio_web_ultima_baixa_qtd || 0;
    const novaSobra = Math.max(0, sobraAtual - decremento);
    
    console.log(`📦 Realtime: Aplicando decremento Cardápio Web: ${sobraAtual} - ${decremento} = ${novaSobra}`);
    
    setEditingValues(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        final_sobra: String(novaSobra),
      }
    }));
  }
  
  // Atualizar estado local (contagens)
  setContagens(prev => {
    // ... resto do código existente ...
  });
  
  // Atualizar originalValues
  setOriginalValues(prev => ({
    ...prev,
    [key]: {
      final_sobra: String(updated.final_sobra ?? ''),
      peso_total_g: String(updated.peso_total_g ?? ''),
      ideal_amanha: updated.ideal_amanha,
    }
  }));
  
  // Mostrar toast se for baixa do Cardápio Web
  if (isCardapioWebBaixa) {
    const itemNome = itens.find(i => i.id === updated.item_porcionado_id)?.nome || 'Item';
    toast.info(
      `📦 Venda Cardápio Web: -${updated.cardapio_web_ultima_baixa_qtd} un de ${itemNome}`,
      { duration: 4000 }
    );
  }
}
```

## Resultado Esperado

```text
ANTES (bugado):
┌─────────────────────────────────────────────────────┐
│  SOBRA: 250  │  C. WEB: 524  │  (vendas ignoradas)  │
└─────────────────────────────────────────────────────┘

DEPOIS (corrigido):
┌─────────────────────────────────────────────────────┐
│  SOBRA: 0    │  C. WEB: 524  │  (decremento aplicado) │
│  (ou 250-524=0, limitado a 0)                       │
└─────────────────────────────────────────────────────┘
```

A cada venda recebida do Cardápio Web:
- Se SOBRA = 250 e vem 1 venda → SOBRA = 249
- Se SOBRA = 250 e vem 50 vendas → SOBRA = 200
- Se SOBRA = 10 e vem 50 vendas → SOBRA = 0 (nunca negativo)
