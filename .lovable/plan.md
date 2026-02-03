

# Plano: Multi-Seleção de Categorias no Modal "Mapear por Insumo"

## Problema Atual

O seletor de categorias usa um `<Select>` dropdown simples que permite selecionar apenas **uma categoria por vez**:
- Para selecionar produtos de PIZZAS + LANCHES + ESFIHAS, precisa repetir 3x

## Solução Proposta

Substituir o `<Select>` por uma **lista com checkboxes** (igual aos itens porcionados), permitindo:
- Marcar **múltiplas categorias** de uma vez
- Selecionar produtos de todas as categorias marcadas com um único botão

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  337 produtos disponíveis                                                 │
│                                                                           │
│  Categorias:                                       2 selecionada(s)       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ Pizzas (120)                                                     │  │
│  │ ☑ Lanches (45)                                                     │  │
│  │ ☐ Bebidas (30)                                                     │  │
│  │ ☐ Combos (72)                                                      │  │
│  │ ☐ Sobremesas (15)                                                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│     [Limpar Seleção]    [Selecionar Categorias (165)]    [Selecionar Todos]│
└───────────────────────────────────────────────────────────────────────────┘
```

## Mudanças no Código

**Arquivo:** `src/components/modals/MapearPorInsumoModal.tsx`

### 1. Alterar estado para Set de múltiplas categorias

```typescript
// Antes: string única
const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('');

// Depois: Set de múltiplas categorias
const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<Set<string>>(new Set());
```

### 2. Atualizar filtro de produtos por categorias

```typescript
// Antes: filtrava por uma categoria
const produtosDaCategoria = useMemo(() => {
  if (!categoriaSelecionada) return [];
  return produtosDisponiveis.filter(p => p.categoria === categoriaSelecionada);
}, [produtosDisponiveis, categoriaSelecionada]);

// Depois: filtra por múltiplas categorias
const produtosDasCategorias = useMemo(() => {
  if (categoriasSelecionadas.size === 0) return [];
  return produtosDisponiveis.filter(p => 
    p.categoria && categoriasSelecionadas.has(p.categoria)
  );
}, [produtosDisponiveis, categoriasSelecionadas]);
```

### 3. Função toggle para categorias

```typescript
const toggleCategoria = (categoria: string, checked: boolean | 'indeterminate') => {
  setCategoriasSelecionadas(prev => {
    const novo = new Set(prev);
    if (checked === true) {
      novo.add(categoria);
    } else {
      novo.delete(categoria);
    }
    return novo;
  });
};
```

### 4. Substituir Select por lista com checkboxes

```tsx
{/* Lista de categorias com checkboxes */}
{categoriasDisponiveis.length > 0 && (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-sm">Categorias</Label>
      {categoriasSelecionadas.size > 0 && (
        <Badge variant="outline" className="text-xs">
          {categoriasSelecionadas.size} selecionada(s)
        </Badge>
      )}
    </div>
    <ScrollArea className="h-[120px] border rounded-md">
      <div className="p-2 space-y-1">
        {categoriasDisponiveis.map(cat => {
          const qtdDisponiveis = produtosDisponiveis.filter(
            p => p.categoria === cat && !produtoJaVinculado(p)
          ).length;
          return (
            <div 
              key={cat}
              className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                categoriasSelecionadas.has(cat) ? 'bg-primary/10' : ''
              }`}
              onClick={() => toggleCategoria(cat, !categoriasSelecionadas.has(cat))}
            >
              <Checkbox
                checked={categoriasSelecionadas.has(cat)}
                onCheckedChange={(checked) => toggleCategoria(cat, checked)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-sm flex-1">{cat}</span>
              <Badge variant="secondary" className="text-xs">{qtdDisponiveis}</Badge>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  </div>
)}
```

### 5. Atualizar botão de selecionar categorias

```tsx
{categoriasSelecionadas.size > 0 && (
  <Button
    variant="outline"
    size="sm"
    onClick={selecionarPorCategorias}
    className="h-8"
  >
    <CheckSquare className="h-4 w-4 mr-1.5" />
    Selecionar Categorias ({produtosDasCategorias.filter(p => !produtoJaVinculado(p)).length})
  </Button>
)}
```

### 6. Atualizar função de seleção por categorias

```typescript
const selecionarPorCategorias = () => {
  if (categoriasSelecionadas.size === 0) return;
  
  const novaSeleção = new Map(produtosSelecionados);
  produtosDasCategorias
    .filter(p => !produtoJaVinculado(p))
    .forEach(p => {
      novaSeleção.set(p.cardapio_item_id, {
        cardapio_item_id: p.cardapio_item_id,
        cardapio_item_nome: p.cardapio_item_nome,
        tipo: p.tipo,
        categoria: p.categoria,
        quantidade_consumida: 1,
      });
    });
  setProdutosSelecionados(novaSeleção);
};
```

### 7. Atualizar reset ao fechar modal

```typescript
const handleOpenChange = (newOpen: boolean) => {
  if (!newOpen) {
    setItensPorcionadosSelecionados(new Set());
    setTermoBusca('');
    setProdutosSelecionados(new Map());
    setCategoriasSelecionadas(new Set()); // Reset múltiplas categorias
  }
  onOpenChange(newOpen);
};
```

## Fluxo de Uso Atualizado

1. Usuário seleciona itens porcionados: MASSA ☑, MUSSARELA ☑
2. Vê lista de categorias com checkboxes
3. Marca: PIZZAS ☑ (120), LANCHES ☑ (45), COMBOS ☑ (72)
4. Clica **"Selecionar Categorias (237)"**
5. 237 produtos são selecionados
6. Clica **"Confirmar 474 Vínculos"** (2 itens × 237 produtos)

## Benefícios

- **Consistência**: Interface igual aos itens porcionados (checkboxes)
- **Eficiência**: Selecionar múltiplas categorias de uma vez
- **Visibilidade**: Ver quantos produtos cada categoria tem
- **Flexibilidade**: Combinar categorias antes de confirmar

