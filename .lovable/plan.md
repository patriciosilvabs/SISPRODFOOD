

# Plano: Sincronização em Tempo Real do Frontend com Baixas do Cardápio Web

## Diagnóstico Confirmado

O webhook `cardapio-web-webhook` **está funcionando corretamente** com a lógica de "Decremento Real". O problema está no **frontend** (`ContagemPorcionados.tsx`) que:

1. **Não atualiza em tempo real** quando baixas automáticas ocorrem
2. **Sobrescreve o `final_sobra` do banco** com valores desatualizados do estado local

### Cenário do Bug

1. Funcionário abre a página às 10:00 → vê `final_sobra = 140`
2. Cardápio Web envia 50 vendas às 12:00 → banco atualiza para `final_sobra = 90`
3. Funcionário (ainda com tela antiga) clica em "Salvar" às 14:00
4. Frontend envia `final_sobra = 140` (valor antigo) → **reseta o estoque!**
5. Nova venda às 15:00 → webhook lê 140 do banco e faz `140 - 5 = 135`

O ciclo se repete: o frontend "reseta" e o webhook desconta do valor resetado.

---

## Solução Proposta: Sincronização com Realtime

### Mudança 1: Adicionar Subscription Realtime

Arquivo: `src/pages/ContagemPorcionados.tsx`

Adicionar uma subscription para atualizar a tela automaticamente quando o Cardápio Web modificar dados:

```typescript
useEffect(() => {
  if (!organizationId) return;
  
  // Subscription para atualizações da contagem (via Cardápio Web ou outro usuário)
  const channel = supabase
    .channel('contagem-realtime')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'contagem_porcionados',
        filter: `organization_id=eq.${organizationId}`,
      },
      (payload) => {
        // Atualizar estado local apenas se não estiver editando este item
        const updated = payload.new as Contagem;
        const key = `${updated.loja_id}-${updated.item_porcionado_id}`;
        
        // Só atualizar se o usuário não estiver editando este campo
        if (!editingValues[key]) {
          setContagens(prev => {
            const lojaContagens = [...(prev[updated.loja_id] || [])];
            const index = lojaContagens.findIndex(
              c => c.item_porcionado_id === updated.item_porcionado_id
            );
            
            if (index >= 0) {
              lojaContagens[index] = { ...lojaContagens[index], ...updated };
            }
            
            return { ...prev, [updated.loja_id]: lojaContagens };
          });
        }
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, [organizationId, editingValues]);
```

### Mudança 2: Habilitar Realtime na Tabela

Arquivo: Nova migration SQL

```sql
-- Habilitar Realtime para contagem_porcionados
ALTER PUBLICATION supabase_realtime ADD TABLE public.contagem_porcionados;
```

### Mudança 3: Preservar `cardapio_web_baixa_total` no Save Manual

Arquivo: `src/pages/ContagemPorcionados.tsx` (função `executeSave`)

Quando o funcionário salvar manualmente, precisamos **preservar** os campos do Cardápio Web:

```typescript
const dataToSave = {
  loja_id: lojaId,
  item_porcionado_id: itemId,
  final_sobra: finalSobra,
  peso_total_g: values?.peso_total_g ? parseFloat(values.peso_total_g) : null,
  ideal_amanha: idealAmanha,
  usuario_id: user.id,
  usuario_nome: profile?.nome || user.email || 'Usuário',
  organization_id: organizationId,
  dia_operacional: diaOperacional,
  // NÃO sobrescrever campos do Cardápio Web - eles são gerenciados pelo webhook
  // cardapio_web_baixa_total: ← NÃO INCLUIR
  // cardapio_web_ultima_baixa_at: ← NÃO INCLUIR  
};
```

### Mudança 4: Indicador Visual de Atualização Remota

Adicionar feedback visual quando uma baixa automática ocorrer:

```typescript
// Dentro do callback do realtime
toast.info(`📦 Venda registrada: ${updated.cardapio_web_ultima_baixa_qtd} unidades de ${itemNome}`, {
  duration: 3000,
  icon: '🍕'
});
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ContagemPorcionados.tsx` | Adicionar subscription Realtime + toast de feedback |
| Nova migration SQL | Habilitar Realtime na tabela `contagem_porcionados` |

---

## Comportamento Final Esperado

| Hora | Ação | Tela do Funcionário | Banco de Dados |
|------|------|---------------------|----------------|
| 10:00 | Abre página | Mostra 140 | `final_sobra = 140` |
| 12:00 | Cardápio Web vende 50 | **Atualiza para 90** + Toast "📦 Venda: 50 un" | `final_sobra = 90` |
| 14:00 | Funcionário clica + | Mostra 95 | (não salva ainda) |
| 14:05 | Salva manualmente | Confirma 95 | `final_sobra = 95` |
| 15:00 | Cardápio Web vende 5 | **Atualiza para 90** + Toast | `final_sobra = 90` |

**Resultado:** O funcionário sempre vê o valor real e ajustes manuais são respeitados.

---

## Detalhes Técnicos

### Por que Realtime resolve o problema?

1. **Evita estado desatualizado**: O frontend sempre mostra o valor atual do banco
2. **Preserva ajustes manuais**: O webhook faz `final_sobra - vendas`, não reseta
3. **Feedback imediato**: Funcionário sabe que vendas estão sendo registradas

### Alternativa sem Realtime (mais simples)

Se Realtime causar problemas de performance, podemos usar polling a cada 30 segundos:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    loadData(); // Recarrega dados do banco
  }, 30000);
  
  return () => clearInterval(interval);
}, []);
```

Porém, isso é menos eficiente e pode causar conflitos se o usuário estiver digitando.

