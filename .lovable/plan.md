
# Plano: Atualizar Estoque da Loja ao Receber Romaneio

## Problema Identificado

Quando o **usuário da loja recebe o romaneio**, o sistema **NÃO ATUALIZA** o campo `final_sobra` (Sobra) da loja de destino. Isso significa que:

| O que acontece hoje | O que deveria acontecer |
|---------------------|-------------------------|
| Loja recebe 100 unidades | final_sobra da loja aumenta em 100 |
| a_produzir continua alto | a_produzir recalcula e pode zerar |
| Sistema "esquece" que loja foi abastecida | Sistema entende que demanda foi atendida |

### Fluxo Atual (Incompleto)

```text
┌─────────────┐    ENVIA      ┌─────────────┐    RECEBE    ┌─────────────┐
│     CPD     │──────────────►│   ROMANEIO  │─────────────►│    LOJA     │
└─────────────┘               └─────────────┘              └─────────────┘
       │                                                          │
       ▼                                                          ▼
  final_sobra -= X                                      ❌ NADA ACONTECE
  (debita estoque CPD)                                  (estoque loja não muda)
```

### Fluxo Correto (A Implementar)

```text
┌─────────────┐    ENVIA      ┌─────────────┐    RECEBE    ┌─────────────┐
│     CPD     │──────────────►│   ROMANEIO  │─────────────►│    LOJA     │
└─────────────┘               └─────────────┘              └─────────────┘
       │                                                          │
       ▼                                                          ▼
  final_sobra -= X                                      ✅ final_sobra += X
  (debita estoque CPD)                                  (credita estoque loja)
                                                              │
                                                              ▼
                                                        a_produzir recalcula
                                                        (ideal - novo_sobra)
```

## Solução Técnica

### Alteração no Arquivo: `src/pages/Romaneio.tsx`

Na função `handleConfirmarRecebimento` (linhas 1731-1845), após registrar o recebimento do romaneio, adicionar lógica para:

1. Para cada item recebido, buscar/criar a contagem na loja de destino
2. Incrementar o `final_sobra` da loja com a quantidade recebida
3. Como `a_produzir` é coluna gerada no banco (`ideal - final_sobra`), será recalculado automaticamente

### Código a Adicionar

```typescript
// NOVO: Após confirmar recebimento, creditar estoque na loja de destino
for (const item of romaneio.romaneio_itens) {
  const itemId = item.id || `${romaneio.id}-${romaneio.romaneio_itens.indexOf(item)}`;
  const recItem = recebimentosPorItem[itemId];
  const qtdRecebida = recItem?.quantidade_recebida ?? item.quantidade;
  
  // Buscar item_porcionado_id a partir do item
  const { data: romaneioItem } = await supabase
    .from('romaneio_itens')
    .select('item_porcionado_id')
    .eq('id', item.id)
    .single();
  
  if (!romaneioItem?.item_porcionado_id) continue;
  
  // Buscar contagem atual da loja para este item
  const currentDate = new Date().toISOString().split('T')[0];
  const { data: contagemLoja } = await supabase
    .from('contagem_porcionados')
    .select('id, final_sobra')
    .eq('loja_id', romaneio.loja_id)
    .eq('item_porcionado_id', romaneioItem.item_porcionado_id)
    .eq('dia_operacional', currentDate)
    .maybeSingle();
  
  if (contagemLoja?.id) {
    // Atualizar: incrementar final_sobra com quantidade recebida
    const novoSobra = (contagemLoja.final_sobra || 0) + qtdRecebida;
    await supabase
      .from('contagem_porcionados')
      .update({ 
        final_sobra: novoSobra,
        updated_at: new Date().toISOString()
      })
      .eq('id', contagemLoja.id);
  } else {
    // Criar contagem nova para a loja com o estoque recebido
    // Buscar ideal do dia da configuração
    const { data: estoqueIdeal } = await supabase
      .from('estoques_ideais_semanais')
      .select('*')
      .eq('loja_id', romaneio.loja_id)
      .eq('item_porcionado_id', romaneioItem.item_porcionado_id)
      .single();
    
    const diaAtual = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'][new Date().getDay()];
    const idealDoDia = estoqueIdeal?.[diaAtual] ?? 0;
    
    await supabase.from('contagem_porcionados').insert({
      loja_id: romaneio.loja_id,
      item_porcionado_id: romaneioItem.item_porcionado_id,
      final_sobra: qtdRecebida,
      ideal_amanha: idealDoDia,
      dia_operacional: currentDate,
      usuario_id: user.id,
      usuario_nome: userProfile?.nome || 'Usuário',
      organization_id: organizationId
    });
  }
}
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Loja com sobra=0, ideal=100, recebe 100 un | a_produzir = 100 | a_produzir = 0 ✅ |
| Loja com sobra=50, ideal=100, recebe 50 un | a_produzir = 50 | a_produzir = 0 ✅ |
| Loja com sobra=80, ideal=100, recebe 30 un | a_produzir = 20 | a_produzir = 0 (sobra=110) ✅ |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Romaneio.tsx` | Adicionar lógica para creditar `final_sobra` da loja ao confirmar recebimento |

## Benefícios

1. **Ciclo completo**: CPD produz → Envia → Loja recebe → Demanda zerada
2. **Automatização**: Sistema entende que loja foi abastecida
3. **Visibilidade correta**: "A Produzir" reflete a realidade do estoque
4. **Sem produção duplicada**: Evita produzir para lojas já atendidas
