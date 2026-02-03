

# Plano: Filtro por Categoria no Modal "Mapear por Insumo"

## Problema Atual

O modal mostra "337 produtos disponíveis" com opção de "Selecionar Todos", mas não há como filtrar por **categoria** (ex: Pizzas, Lanches, Bebidas). O usuário quer selecionar apenas produtos de uma categoria específica sem precisar buscá-los um por um.

## Solução Proposta

Adicionar um **dropdown de categorias** entre a contagem de produtos e o botão "Selecionar Todos", permitindo:
- Ver todas as categorias disponíveis
- Selecionar produtos apenas de uma categoria específica
- Manter opção de "Selecionar Todos" para todos os produtos

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  Mapear por Insumo                                                    [X] │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Item Porcionado:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ MASSA - PORCIONADO                                              ▼  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ 337 produtos disponíveis                                           │  │
│  │                                                                     │  │
│  │ Categoria: [Todas ▼]  [Pizza ▼]  [Lanche ▼]  ...                   │  │
│  │                                                                     │  │
│  │     [Limpar Seleção]    [Selecionar Categoria]    [Selecionar Todos]│  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Buscar produtos (opcional):                                              │
│  ...                                                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

## Mudanças no Código

**Arquivo:** `src/components/modals/MapearPorInsumoModal.tsx`

### 1. Extrair categorias únicas

```typescript
// Extrair categorias únicas dos produtos disponíveis
const categoriasDisponiveis = useMemo(() => {
  const categorias = new Set<string>();
  produtosDisponiveis.forEach(p => {
    if (p.categoria) {
      categorias.add(p.categoria);
    }
  });
  return Array.from(categorias).sort();
}, [produtosDisponiveis]);
```

### 2. Estado para categoria selecionada

```typescript
const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('');
```

### 3. Filtrar produtos por categoria

```typescript
// Produtos da categoria selecionada
const produtosDaCategoria = useMemo(() => {
  if (!categoriaSelecionada) return produtosDisponiveis;
  return produtosDisponiveis.filter(p => p.categoria === categoriaSelecionada);
}, [produtosDisponiveis, categoriaSelecionada]);
```

### 4. Função para selecionar por categoria

```typescript
const selecionarPorCategoria = () => {
  if (!categoriaSelecionada) return;
  
  const novaSeleção = new Map(produtosSelecionados);
  produtosDaCategoria
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

### 5. Atualizar UI da seção de seleção em massa

```tsx
{itemPorcionadoSelecionado && produtosDisponiveis.length > 0 && (
  <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
    {/* Contagem total */}
    <div className="text-sm">
      <span className="font-medium">{produtosDisponiveis.filter(p => !produtoJaVinculado(p)).length}</span>
      <span className="text-muted-foreground"> produtos disponíveis</span>
    </div>
    
    {/* Seletor de categoria */}
    <div className="flex items-center gap-2">
      <Label className="text-sm shrink-0">Categoria:</Label>
      <Select value={categoriaSelecionada} onValueChange={setCategoriaSelecionada}>
        <SelectTrigger className="flex-1 h-8">
          <SelectValue placeholder="Selecione uma categoria..." />
        </SelectTrigger>
        <SelectContent>
          {categoriasDisponiveis.map(cat => (
            <SelectItem key={cat} value={cat}>
              {cat} ({produtosDisponiveis.filter(p => p.categoria === cat && !produtoJaVinculado(p)).length})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    
    {/* Botões de ação */}
    <div className="flex flex-wrap gap-2 justify-end">
      {produtosSelecionados.size > 0 && (
        <Button variant="ghost" size="sm" onClick={limparSelecao}>
          <Square className="h-3.5 w-3.5 mr-1.5" />
          Limpar Seleção
        </Button>
      )}
      
      {categoriaSelecionada && (
        <Button variant="outline" size="sm" onClick={selecionarPorCategoria}>
          <CheckSquare className="h-4 w-4 mr-1.5" />
          Selecionar Categoria ({produtosDaCategoria.filter(p => !produtoJaVinculado(p)).length})
        </Button>
      )}
      
      <Button variant="default" size="sm" onClick={selecionarTodosProdutos} disabled={todosProdutosSelecionados}>
        <CheckSquare className="h-4 w-4 mr-1.5" />
        Selecionar Todos
      </Button>
    </div>
  </div>
)}
```

### 6. Resetar categoria ao fechar/trocar item

```typescript
const handleOpenChange = (newOpen: boolean) => {
  if (!newOpen) {
    setItemPorcionadoSelecionado('');
    setTermoBusca('');
    setProdutosSelecionados(new Map());
    setCategoriaSelecionada(''); // Adicionar reset
  }
  onOpenChange(newOpen);
};
```

## Fluxo de Uso

1. Usuário seleciona "MASSA - PORCIONADO"
2. Vê "337 produtos disponíveis"
3. Seleciona categoria "Pizza" no dropdown
4. Clica "Selecionar Categoria (120)"
5. 120 pizzas são marcadas
6. Pode repetir para "Lanche", "Esfiha", etc.
7. Confirma todos os vínculos de uma vez

## Benefícios

- **Seleção inteligente**: Vincular insumos específicos a categorias (ex: CALABRESA só em pizzas)
- **Flexibilidade**: Combinar múltiplas categorias antes de confirmar
- **Visibilidade**: Ver quantos produtos cada categoria tem

