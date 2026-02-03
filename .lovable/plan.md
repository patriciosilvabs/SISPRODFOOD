
# Plano: Vínculo Múltiplo no Dropdown Individual

## Problema Atual

O dropdown "Vincular item..." na linha de cada produto:
- Permite selecionar apenas **1 item** por vez
- Fixa a quantidade em **1** automaticamente
- Para vincular MASSA + MUSSARELA + CALABRESA, o usuário precisa clicar 3 vezes em "Adicionar item"

## Solução Proposta

Substituir o dropdown por um **botão que abre um modal** permitindo:
- Marcar **múltiplos itens** de uma vez (checkboxes)
- Definir **quantidade individual** para cada item selecionado
- Confirmar todos os vínculos com **1 clique**

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  Vincular Itens ao Produto                                            [X] │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Produto: Pizza Calabresa Grande (3572283)                                │
│                                                                           │
│  Selecione os itens porcionados:                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ MASSA - PORCIONADO                                    Qtd: [1]   │  │
│  │ ☑ MUSSARELA - PORCIONADO                                Qtd: [1]   │  │
│  │ ☑ CALABRESA - PORCIONADO                                Qtd: [2]   │  │
│  │ ☐ BACON - PORCIONADO                                               │  │
│  │ ☐ CARNE - PORCIONADO                                               │  │
│  │ ☐ FRANGO - PORCIONADO                                              │  │
│  │ ☐ PEPPERONI - PORCIONADO                                           │  │
│  │ ☐ PRESUNTO - PORCIONADO                                            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ℹ️ 3 itens selecionados: MASSA (1x), MUSSARELA (1x), CALABRESA (2x)      │
│                                                                           │
│                                    [Cancelar]  [Confirmar 3 Vínculos]     │
└───────────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/modals/AdicionarVinculoCardapioModal.tsx` | Reescrever para suportar múltiplos itens com checkboxes e quantidades |
| `src/pages/ConfigurarCardapioWeb.tsx` | Ajustar chamada do modal e callback `onConfirm` para múltiplos vínculos |

## Detalhes Técnicos

### 1. Atualizar `AdicionarVinculoCardapioModal.tsx`

**Props atualizadas:**
```typescript
interface AdicionarVinculoCardapioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoNome: string;
  itensPorcionados: { id: string; nome: string }[];
  vinculosExistentes?: string[]; // IDs dos itens já vinculados
  onConfirm: (vinculos: { itemPorcionadoId: string; quantidade: number }[]) => Promise<void>;
  isLoading?: boolean;
}
```

**Estado interno:**
```typescript
// Map: itemPorcionadoId -> quantidade
const [selecoes, setSelecoes] = useState<Map<string, number>>(new Map());
```

**Lógica de toggle e quantidade:**
```typescript
const toggleItem = (id: string, checked: boolean) => {
  setSelecoes(prev => {
    const novo = new Map(prev);
    if (checked) {
      novo.set(id, 1); // Quantidade padrão = 1
    } else {
      novo.delete(id);
    }
    return novo;
  });
};

const updateQuantidade = (id: string, quantidade: number) => {
  setSelecoes(prev => {
    const novo = new Map(prev);
    if (quantidade > 0) {
      novo.set(id, quantidade);
    }
    return novo;
  });
};
```

**Confirmação retorna array:**
```typescript
const handleConfirm = async () => {
  if (selecoes.size === 0) return;
  
  const vinculos = Array.from(selecoes.entries()).map(([id, qtd]) => ({
    itemPorcionadoId: id,
    quantidade: qtd
  }));
  
  await onConfirm(vinculos);
  // Reset e fechar...
};
```

**Interface com checkboxes:**
```tsx
<ScrollArea className="h-[300px] border rounded-md">
  {itensPorcionados.map(item => {
    const isSelected = selecoes.has(item.id);
    const isExistente = vinculosExistentes?.includes(item.id);
    const quantidade = selecoes.get(item.id) || 1;
    
    return (
      <div className={`flex items-center gap-3 p-2 ${isSelected ? 'bg-primary/10' : ''}`}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => toggleItem(item.id, checked)}
          disabled={isExistente}
        />
        <span className="flex-1">{item.nome}</span>
        {isExistente && <Badge variant="secondary">Já vinculado</Badge>}
        {isSelected && (
          <Input
            type="number"
            min="0.1"
            step="0.1"
            className="w-16 h-7"
            value={quantidade}
            onChange={(e) => updateQuantidade(item.id, parseFloat(e.target.value) || 1)}
          />
        )}
      </div>
    );
  })}
</ScrollArea>
```

### 2. Atualizar `ConfigurarCardapioWeb.tsx`

**Callback ajustado para múltiplos vínculos:**
```typescript
const handleAdicionarVinculosMultiplos = async (
  produto: MapeamentoCardapioItemAgrupado,
  vinculos: { itemPorcionadoId: string; quantidade: number }[]
) => {
  for (const vinculo of vinculos) {
    await adicionarMapeamento.mutateAsync({
      loja_id: lojaIdMapeamento!,
      cardapio_item_id: produto.cardapio_item_id,
      cardapio_item_nome: produto.cardapio_item_nome,
      tipo: produto.tipo,
      categoria: produto.categoria,
      item_porcionado_id: vinculo.itemPorcionadoId,
      quantidade_consumida: vinculo.quantidade,
    });
  }
};
```

**Substituir dropdown por botão:**
```tsx
// Antes: Select dropdown
// Depois: Botão que abre o modal
<Button
  variant="outline"
  size="sm"
  className="h-8 border-dashed"
  onClick={() => onAbrirModalVinculo(produto)}
>
  <Plus className="h-3.5 w-3.5 mr-1.5" />
  Vincular itens...
</Button>
```

## Fluxo de Uso Atualizado

1. Usuário vê produto "Pizza Calabresa G" sem vínculos
2. Clica em **"Vincular itens..."**
3. Modal abre mostrando **todos os itens porcionados** com checkboxes
4. Usuário marca MASSA (1x), MUSSARELA (1x), CALABRESA (2x)
5. Clica em **"Confirmar 3 Vínculos"**
6. Sistema cria os 3 registros de mapeamento de uma vez
7. Produto agora mostra os 3 vínculos na interface

## Benefícios

- **Menos cliques**: 1 interação vs. 3+ para vincular múltiplos itens
- **Visão completa**: usuário vê todos os itens disponíveis de uma vez
- **Flexibilidade**: cada item pode ter quantidade diferente (0.5, 1, 2, etc.)
- **Consistência**: interface similar ao "Vincular em Lote" já existente
