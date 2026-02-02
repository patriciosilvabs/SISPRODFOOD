
# Plano: Multi-seleção de Itens Porcionados no Modal de Vinculação em Lote

## Problema Atual

O modal de "Vincular em Lote" permite selecionar apenas **um** item porcionado por vez. Para vincular uma pizza a MASSA + BACON + MUSSARELA, você precisaria fazer 3 operações separadas.

## Solução Proposta

Transformar o dropdown de seleção única em uma lista de checkboxes onde você pode marcar **múltiplos itens porcionados** simultaneamente, cada um com sua quantidade individual.

---

## Nova Interface do Modal

```text
┌─────────────────────────────────────────────────────────────────┐
│  ⇆  Vincular em Lote                                        X  │
│  Vincule 5 produto(s) selecionado(s) aos itens porcionados.     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Itens Porcionados                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [✓] BACON - PORCIONADO              Qtd: [1]            │    │
│  │ [ ] CALABRESA - PORCIONADO          Qtd: [1]            │    │
│  │ [ ] CARNE - PORCIONADO              Qtd: [1]            │    │
│  │ [ ] FRANGO - PORCIONADO             Qtd: [1]            │    │
│  │ [✓] MASSA - PORCIONADO              Qtd: [1]            │    │
│  │ [✓] MUSSARELA - PORCIONADO          Qtd: [2]            │    │
│  │ [ ] PEPPERONI - PORCIONADO          Qtd: [1]            │    │
│  │ [ ] PRESUNTO - PORCIONADO           Qtd: [1]            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Resumo:                                                 │    │
│  │ 5 produto(s) serão vinculados a:                        │    │
│  │  • BACON - PORCIONADO (1x)                              │    │
│  │  • MASSA - PORCIONADO (1x)                              │    │
│  │  • MUSSARELA - PORCIONADO (2x)                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│                            [Cancelar]  [Vincular 5 Produtos]    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mudanças no Código

### Arquivo: `src/components/modals/VincularEmLoteModal.tsx`

#### 1. Alterar Interface de Props

```typescript
interface VincularEmLoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quantidadeSelecionados: number;
  itensPorcionados: { id: string; nome: string }[];
  // MUDANÇA: Agora recebe array de vínculos
  onConfirm: (vinculos: { itemPorcionadoId: string; quantidade: number }[]) => Promise<void>;
  isLoading?: boolean;
}
```

#### 2. Alterar Estado Interno

```typescript
// ANTES: Estado único
const [itemPorcionadoId, setItemPorcionadoId] = useState('');
const [quantidade, setQuantidade] = useState('1');

// DEPOIS: Map de seleções com quantidades
const [selecoes, setSelecoes] = useState<Map<string, number>>(new Map());
```

#### 3. Substituir Select por Lista de Checkboxes

Remover o `<Select>` e adicionar uma lista com scroll:

```typescript
<ScrollArea className="h-[300px] border rounded-md p-2">
  <div className="space-y-2">
    {itensPorcionados.map(item => {
      const isSelected = selecoes.has(item.id);
      const quantidade = selecoes.get(item.id) || 1;
      
      return (
        <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => toggleItem(item.id, checked)}
          />
          <span className="flex-1 text-sm">{item.nome}</span>
          {isSelected && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Qtd:</span>
              <Input
                type="number"
                min="1"
                className="w-16 h-8"
                value={quantidade}
                onChange={(e) => updateQuantidade(item.id, parseInt(e.target.value) || 1)}
              />
            </div>
          )}
        </div>
      );
    })}
  </div>
</ScrollArea>
```

#### 4. Funções de Manipulação

```typescript
const toggleItem = (id: string, checked: boolean) => {
  setSelecoes(prev => {
    const novo = new Map(prev);
    if (checked) {
      novo.set(id, 1); // Default quantidade = 1
    } else {
      novo.delete(id);
    }
    return novo;
  });
};

const updateQuantidade = (id: string, quantidade: number) => {
  setSelecoes(prev => {
    const novo = new Map(prev);
    novo.set(id, quantidade);
    return novo;
  });
};
```

#### 5. Atualizar handleConfirm

```typescript
const handleConfirm = async () => {
  if (selecoes.size === 0) return;
  
  const vinculos = Array.from(selecoes.entries()).map(([id, qtd]) => ({
    itemPorcionadoId: id,
    quantidade: qtd
  }));
  
  await onConfirm(vinculos);
  setSelecoes(new Map());
};
```

---

### Arquivo: `src/hooks/useCardapioWebIntegracao.ts`

#### Atualizar Mutation `vincularEmLote`

```typescript
const vincularEmLote = useMutation({
  mutationFn: async ({
    produtos,
    vinculos, // NOVO: Array de { item_porcionado_id, quantidade_consumida }
    loja_id
  }: {
    produtos: MapeamentoCardapioItemAgrupado[];
    vinculos: { item_porcionado_id: string; quantidade_consumida: number }[];
    loja_id: string;
  }) => {
    if (!organizationId) throw new Error('Organização não encontrada');
    
    const operations: Promise<any>[] = [];
    
    for (const produto of produtos) {
      // Para cada item porcionado selecionado
      for (const vinculo of vinculos) {
        // Se produto já tem vínculo vazio, atualiza com o primeiro item
        const vinculoSemItem = produto.vinculos.find(v => !v.item_porcionado_id);
        if (vinculoSemItem?.id && vinculos.indexOf(vinculo) === 0) {
          operations.push(
            supabase
              .from('mapeamento_cardapio_itens')
              .update({ 
                item_porcionado_id: vinculo.item_porcionado_id, 
                quantidade_consumida: vinculo.quantidade_consumida 
              })
              .eq('id', vinculoSemItem.id)
          );
        } else {
          // Cria novo vínculo
          operations.push(
            supabase
              .from('mapeamento_cardapio_itens')
              .insert({
                organization_id: organizationId,
                loja_id,
                cardapio_item_id: produto.cardapio_item_id,
                cardapio_item_nome: produto.cardapio_item_nome,
                tipo: produto.tipo,
                categoria: produto.categoria,
                item_porcionado_id: vinculo.item_porcionado_id,
                quantidade_consumida: vinculo.quantidade_consumida,
                ativo: true
              })
          );
        }
      }
    }
    
    const results = await Promise.all(operations);
    // Verifica erros...
  },
  // ...
});
```

---

### Arquivo: `src/pages/ConfigurarCardapioWeb.tsx`

#### Atualizar Chamada ao Modal

```typescript
const handleVincularEmLote = async (vinculos: { itemPorcionadoId: string; quantidade: number }[]) => {
  if (!lojaIdMapeamento) return;
  
  const produtosSelecionadosArray = mapeamentosFiltrados.filter(
    m => produtosSelecionados.has(m.cardapio_item_id)
  );
  
  await vincularEmLote.mutateAsync({
    produtos: produtosSelecionadosArray,
    vinculos: vinculos.map(v => ({
      item_porcionado_id: v.itemPorcionadoId,
      quantidade_consumida: v.quantidade
    })),
    loja_id: lojaIdMapeamento
  });
  
  setVinculoEmLoteModalOpen(false);
  setModoSelecao(false);
  setProdutosSelecionados(new Set());
};
```

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/components/modals/VincularEmLoteModal.tsx` | Trocar Select por lista de checkboxes com quantidades individuais |
| `src/hooks/useCardapioWebIntegracao.ts` | Atualizar mutation para criar múltiplos vínculos por produto |
| `src/pages/ConfigurarCardapioWeb.tsx` | Ajustar chamada ao modal e handler |

---

## Fluxo do Usuário

1. Ativa modo de seleção
2. Marca várias pizzas (5 produtos)
3. Clica em "Vincular Selecionados"
4. No modal, marca:
   - MASSA - PORCIONADO (Qtd: 1)
   - MUSSARELA - PORCIONADO (Qtd: 2)
   - BACON - PORCIONADO (Qtd: 1)
5. Clica em "Vincular 5 Produtos"
6. Sistema cria 15 registros (5 pizzas × 3 itens porcionados)

---

## Benefícios

1. **Eficiência máxima**: Vincular 5 pizzas a 3 ingredientes em uma única operação
2. **Quantidades individuais**: Cada item pode ter sua própria quantidade (ex: 2x mussarela)
3. **Visual claro**: Lista com checkboxes mostra exatamente o que será vinculado
4. **Resumo antes de confirmar**: Usuário vê exatamente o que vai acontecer
