
# Plano: Suporte a Múltiplos Itens Porcionados por Produto

## Contexto

Atualmente, cada produto do Cardápio Web só pode ter **um único item porcionado** vinculado. O usuário precisa vincular **vários itens** ao mesmo produto (ex: 1 Pizza = 1 Massa + 1 Mussarela + 1 Molho).

## Arquitetura Atual

A Edge Function **já suporta** múltiplos vínculos (linhas 147-153 criam um Map de arrays):
```typescript
const mapeamentoMap = new Map<number, MapeamentoItem[]>()
for (const m of mapeamentos) {
  if (!mapeamentoMap.has(m.cardapio_item_id)) {
    mapeamentoMap.set(m.cardapio_item_id, [])
  }
  mapeamentoMap.get(m.cardapio_item_id)!.push(m)
}
```

O problema é a constraint UNIQUE que impede múltiplas linhas com o mesmo `cardapio_item_id`.

---

## Solução

### Parte 1: Alterar Banco de Dados

**1.1 Remover constraint UNIQUE atual**
```sql
ALTER TABLE mapeamento_cardapio_itens 
DROP CONSTRAINT mapeamento_cardapio_itens_org_item_unique;
```

**1.2 Criar nova constraint que permite múltiplos itens**
```sql
ALTER TABLE mapeamento_cardapio_itens 
ADD CONSTRAINT mapeamento_cardapio_itens_unique_combo 
UNIQUE (organization_id, cardapio_item_id, item_porcionado_id);
```

Isso permite:
- Mesmo `cardapio_item_id` com diferentes `item_porcionado_id`
- Impede duplicatas do mesmo par (produto + item porcionado)

### Parte 2: Atualizar Hook

**Arquivo:** `src/hooks/useCardapioWebIntegracao.ts`

**2.1 Atualizar interface para agrupar itens**
```typescript
interface MapeamentoCardapioItemAgrupado {
  cardapio_item_id: number;
  cardapio_item_nome: string;
  tipo: string | null;
  categoria: string | null;
  vinculos: {
    id: string;
    item_porcionado_id: string | null;
    item_porcionado_nome: string | null;
    quantidade_consumida: number;
  }[];
}
```

**2.2 Adicionar função para agrupar mapeamentos**
```typescript
// Agrupa mapeamentos pelo cardapio_item_id
const mapeamentosAgrupados = useMemo(() => {
  const grouped = new Map<number, MapeamentoCardapioItemAgrupado>();
  
  for (const m of mapeamentos) {
    if (!grouped.has(m.cardapio_item_id)) {
      grouped.set(m.cardapio_item_id, {
        cardapio_item_id: m.cardapio_item_id,
        cardapio_item_nome: m.cardapio_item_nome,
        tipo: m.tipo,
        categoria: m.categoria,
        vinculos: []
      });
    }
    
    grouped.get(m.cardapio_item_id)!.vinculos.push({
      id: m.id,
      item_porcionado_id: m.item_porcionado_id,
      item_porcionado_nome: m.item_porcionado?.nome || null,
      quantidade_consumida: m.quantidade_consumida
    });
  }
  
  return Array.from(grouped.values());
}, [mapeamentos]);
```

**2.3 Adicionar mutação para vincular item adicional**
```typescript
const adicionarVinculo = useMutation({
  mutationFn: async ({
    cardapio_item_id,
    cardapio_item_nome,
    tipo,
    categoria,
    item_porcionado_id,
    quantidade_consumida = 1
  }) => {
    const { data, error } = await supabase
      .from('mapeamento_cardapio_itens')
      .insert({
        organization_id: organizationId,
        cardapio_item_id,
        cardapio_item_nome,
        tipo,
        categoria,
        item_porcionado_id,
        quantidade_consumida,
        ativo: true
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
});
```

### Parte 3: Atualizar Interface

**Arquivo:** `src/pages/ConfigurarCardapioWeb.tsx`

**3.1 Nova estrutura da tabela com linhas expansíveis**

Cada produto terá uma linha principal mostrando:
- Tipo, Categoria, Nome, Código
- Botão para adicionar vínculo
- Lista de vínculos existentes como sub-linhas

```
┌─────────┬───────────┬────────────────┬────────┬─────────────────────────┐
│ Tipo    │ Categoria │ Produto        │ Código │ Itens Vinculados        │
├─────────┼───────────┼────────────────┼────────┼─────────────────────────┤
│ PRODUTO │ Pizzas    │ Pizza Marguer. │ 12345  │ ┌─ Massa G (1x)     [X] │
│         │           │                │        │ ├─ Mussarela (2x)   [X] │
│         │           │                │        │ └─ Molho (1x)       [X] │
│         │           │                │        │ [+ Adicionar Item]      │
├─────────┼───────────┼────────────────┼────────┼─────────────────────────┤
│ PRODUTO │ Bebidas   │ Refrigerante   │ 67890  │ (Nenhum item vinculado) │
│         │           │                │        │ [Vincular...]           │
└─────────┴───────────┴────────────────┴────────┴─────────────────────────┘
```

**3.2 Modal de adicionar vínculo**

Ao clicar em "+ Adicionar Item", abre um modal simples:
- Select: Item porcionado
- Input: Quantidade consumida
- Botão: Adicionar

**3.3 Atualizar importação**

A importação continuará criando uma linha por produto SEM vínculo.
O usuário então vincula os itens porcionados manualmente.

---

## Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| **Banco de Dados** | Remover constraint única antiga |
| **Banco de Dados** | Adicionar constraint que permite múltiplos (org + item_cardapio + item_porc) |
| **useCardapioWebIntegracao.ts** | Adicionar função para agrupar mapeamentos |
| **useCardapioWebIntegracao.ts** | Adicionar mutação `adicionarVinculo` |
| **ConfigurarCardapioWeb.tsx** | Redesenhar tabela com sub-linhas de vínculos |
| **ConfigurarCardapioWeb.tsx** | Adicionar modal para adicionar vínculo |

---

## Fluxo de Uso

1. **Importar arquivo** → Cria registros com `item_porcionado_id = null`
2. **Vincular primeiro item** → Atualiza o registro existente
3. **Adicionar mais itens** → Cria novos registros com o mesmo `cardapio_item_id`
4. **Remover vínculo** → Deleta apenas aquele registro específico

---

## Resultado Esperado

Antes:
- Pizza Marguerita → Massa G (1x)

Depois:
- Pizza Marguerita → Massa G (1x), Mussarela (2x), Molho (1x)

A Edge Function já processa todos os vínculos automaticamente!
