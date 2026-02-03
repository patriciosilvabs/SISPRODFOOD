

# Plano: Multi-Seleção de Itens Porcionados no Modal "Mapear por Insumo"

## Problema Atual

O modal atual usa um **Select dropdown simples** para escolher o item porcionado:
- Permite selecionar apenas **1 item** por vez (ex: só MUSSARELA)
- Para vincular MASSA + MUSSARELA + CALABRESA aos mesmos produtos, precisa repetir 3x

## Solução Proposta

Substituir o Select dropdown por uma **lista com checkboxes**, permitindo:
- Marcar **múltiplos itens porcionados** de uma vez
- Vincular todos os selecionados aos produtos escolhidos
- Criar múltiplos vínculos com uma única confirmação

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  Mapear por Insumo                                                    [X] │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Itens Porcionados:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ MASSA - PORCIONADO                                               │  │
│  │ ☑ MUSSARELA - PORCIONADO                                           │  │
│  │ ☑ CALABRESA - PORCIONADO                                           │  │
│  │ ☐ BACON - PORCIONADO                                               │  │
│  │ ☐ CARNE - PORCIONADO                                               │  │
│  │ ☐ FRANGO - PORCIONADO                                              │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│  ℹ️ 3 itens selecionados                                                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ 337 produtos disponíveis                                           │  │
│  │ Categoria: [PIZZAS ▼]        [Selecionar Categoria] [Selecionar Todos]│
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│                                   [Cancelar]  [Confirmar X Vínculos]      │
└───────────────────────────────────────────────────────────────────────────┘
```

## Mudanças no Código

**Arquivo:** `src/components/modals/MapearPorInsumoModal.tsx`

### 1. Alterar estado de seleção de itens porcionados

```typescript
// Antes: string única
const [itemPorcionadoSelecionado, setItemPorcionadoSelecionado] = useState<string>('');

// Depois: Set de múltiplos IDs
const [itensPorcionadosSelecionados, setItensPorcionadosSelecionados] = useState<Set<string>>(new Set());
```

### 2. Substituir Select por lista com checkboxes

```tsx
{/* Lista de itens porcionados com checkboxes */}
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <Label>Itens Porcionados</Label>
    {itensPorcionadosSelecionados.size > 0 && (
      <Badge variant="secondary">{itensPorcionadosSelecionados.size} selecionado(s)</Badge>
    )}
  </div>
  <ScrollArea className="h-[150px] border rounded-md">
    <div className="p-2 space-y-1">
      {itensPorcionados.map(item => (
        <div 
          key={item.id}
          className={`flex items-center gap-3 p-2 rounded hover:bg-muted/50 ${
            itensPorcionadosSelecionados.has(item.id) ? 'bg-primary/10' : ''
          }`}
        >
          <Checkbox
            checked={itensPorcionadosSelecionados.has(item.id)}
            onCheckedChange={(checked) => toggleItemPorcionado(item.id, checked)}
          />
          <span className="text-sm">{item.nome}</span>
        </div>
      ))}
    </div>
  </ScrollArea>
</div>
```

### 3. Função para toggle de itens porcionados

```typescript
const toggleItemPorcionado = (id: string, checked: boolean | 'indeterminate') => {
  setItensPorcionadosSelecionados(prev => {
    const novo = new Set(prev);
    if (checked === true) {
      novo.add(id);
    } else {
      novo.delete(id);
    }
    return novo;
  });
};
```

### 4. Atualizar lógica de verificação de vínculo existente

```typescript
// Verifica se produto já está vinculado a QUALQUER item selecionado
const produtoJaVinculado = (produto: MapeamentoCardapioItemAgrupado): boolean => {
  if (itensPorcionadosSelecionados.size === 0) return false;
  return produto.vinculos.some(v => 
    v.item_porcionado_id && itensPorcionadosSelecionados.has(v.item_porcionado_id)
  );
};
```

### 5. Atualizar props e callback do onConfirm

```typescript
interface MapearPorInsumoModalProps {
  // ...
  onConfirm: (data: {
    itens_porcionados_ids: string[];  // Array de IDs
    produtos: Array<{...}>;
  }) => Promise<void>;
}

const handleConfirm = async () => {
  if (itensPorcionadosSelecionados.size === 0 || produtosSelecionados.size === 0) return;
  
  await onConfirm({
    itens_porcionados_ids: Array.from(itensPorcionadosSelecionados),
    produtos: Array.from(produtosSelecionados.values()),
  });
  
  // Reset...
};
```

### 6. Atualizar quem chama o modal (ConfigurarCardapioWeb.tsx)

```typescript
const handleMapearPorInsumoConfirm = async (data: {
  itens_porcionados_ids: string[];
  produtos: Array<{...}>;
}) => {
  // Para cada item porcionado selecionado
  for (const itemId of data.itens_porcionados_ids) {
    // Criar vínculo com cada produto
    for (const produto of data.produtos) {
      await adicionarVinculo.mutateAsync({
        loja_id: lojaIdMapeamento!,
        cardapio_item_id: produto.cardapio_item_id,
        cardapio_item_nome: produto.cardapio_item_nome,
        tipo: produto.tipo,
        categoria: produto.categoria,
        item_porcionado_id: itemId,
        quantidade_consumida: produto.quantidade_consumida,
      });
    }
  }
};
```

### 7. Atualizar contagem no botão de confirmar

```tsx
<Button onClick={handleConfirm} disabled={itensPorcionadosSelecionados.size === 0 || produtosSelecionados.size === 0}>
  Confirmar {itensPorcionadosSelecionados.size * produtosSelecionados.size} Vínculos
</Button>
```

### 8. Atualizar resumo

```tsx
{itensPorcionadosSelecionados.size > 0 && produtosSelecionados.size > 0 && (
  <div className="p-3 bg-muted/50 rounded-lg text-sm">
    <p className="font-medium flex items-center gap-2">
      <Link2 className="h-4 w-4" />
      {produtosSelecionados.size} produto(s) serão vinculados a {itensPorcionadosSelecionados.size} item(ns):
    </p>
    <div className="flex flex-wrap gap-1 mt-1">
      {Array.from(itensPorcionadosSelecionados).map(id => {
        const item = itensPorcionados.find(i => i.id === id);
        return item ? <Badge key={id} variant="secondary">{item.nome}</Badge> : null;
      })}
    </div>
    <p className="text-xs text-muted-foreground mt-2">
      Total: {itensPorcionadosSelecionados.size * produtosSelecionados.size} vínculos
    </p>
  </div>
)}
```

## Fluxo de Uso Atualizado

1. Usuário abre "Mapear por Insumo"
2. Vê lista de itens porcionados com **checkboxes**
3. Marca MASSA ☑, MUSSARELA ☑, CALABRESA ☑
4. Seleciona categoria "PIZZAS" → clica "Selecionar Categoria"
5. 120 pizzas são selecionadas
6. Vê resumo: "120 produtos serão vinculados a 3 itens"
7. Clica "Confirmar 360 Vínculos"
8. Sistema cria todos os mapeamentos de uma vez

## Benefícios

- **Eficiência máxima**: Vincular múltiplos insumos a múltiplos produtos de uma vez
- **Menos cliques**: 1 operação vs. 3+ operações separadas
- **Visibilidade**: Ver todos os itens selecionados antes de confirmar
- **Cálculo claro**: Mostra total de vínculos a serem criados

