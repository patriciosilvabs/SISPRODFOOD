
# Plano: Botão "Selecionar Todos os Produtos"

## Problema Atual

O botão "Selecionar Todos" só aparece **após buscar** produtos (mínimo 2 caracteres). Para insumos como MASSA e MUSSARELA que são usados em **todos** os produtos, o usuário precisa buscar primeiro para então selecionar.

## Solução Proposta

Adicionar um botão **"Selecionar Todos os Produtos"** que aparece logo após escolher o item porcionado, permitindo vincular todos os produtos de uma vez sem precisar buscar.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  Mapear por Insumo                                                    [X] │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Item Porcionado:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ MASSA - PORCIONADO                                             ▼   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ✓ Selecionar Todos os Produtos (358)          [Limpar Seleção]      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Buscar produtos (opcional):                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Digite para filtrar...                                           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ℹ️ 358 produtos selecionados serão vinculados a MASSA - PORCIONADO       │
│                                                                           │
│                                    [Cancelar]  [Confirmar 358 Vínculos]   │
└───────────────────────────────────────────────────────────────────────────┘
```

## Mudanças no Código

**Arquivo:** `src/components/modals/MapearPorInsumoModal.tsx`

### 1. Nova função `selecionarTodosProdutos`

Seleciona **todos** os produtos disponíveis (não apenas os filtrados):

```typescript
const selecionarTodosProdutos = () => {
  const novaSeleção = new Map<number, ProdutoSelecionado>();
  produtosDisponiveis
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

### 2. Nova função `limparSelecao`

Limpa todos os produtos selecionados:

```typescript
const limparSelecao = () => {
  setProdutosSelecionados(new Map());
};
```

### 3. Verificar se todos estão selecionados

```typescript
const todosProdutosSelecionados = useMemo(() => {
  const disponiveis = produtosDisponiveis.filter(p => !produtoJaVinculado(p));
  return disponiveis.length > 0 && disponiveis.every(p => produtosSelecionados.has(p.cardapio_item_id));
}, [produtosDisponiveis, produtosSelecionados, itemPorcionadoSelecionado]);
```

### 4. UI: Adicionar seção de seleção em massa

Após o select de Item Porcionado, antes da busca:

```tsx
{/* Seleção em Massa - aparece quando item está selecionado */}
{itemPorcionadoSelecionado && produtosDisponiveis.length > 0 && (
  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
    <div className="text-sm">
      <span className="font-medium">{produtosDisponiveis.length}</span>
      <span className="text-muted-foreground"> produtos disponíveis</span>
    </div>
    <div className="flex gap-2">
      {produtosSelecionados.size > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={limparSelecao}
          className="h-8 text-xs"
        >
          <Square className="h-3.5 w-3.5 mr-1.5" />
          Limpar Seleção
        </Button>
      )}
      <Button
        variant={todosProdutosSelecionados ? "secondary" : "default"}
        size="sm"
        onClick={selecionarTodosProdutos}
        disabled={todosProdutosSelecionados}
        className="h-8"
      >
        <CheckSquare className="h-4 w-4 mr-1.5" />
        Selecionar Todos
      </Button>
    </div>
  </div>
)}
```

### 5. Ajustar placeholder da busca

Mudar de "Digite pelo menos 2 caracteres..." para "Digite para filtrar (opcional)..." já que a busca não é mais obrigatória.

## Fluxo de Uso Atualizado

1. Admin abre modal "Mapear por Insumo"
2. Seleciona "MASSA - PORCIONADO"
3. **Novo:** Clica em "Selecionar Todos" → 358 produtos selecionados
4. (Opcional) Usa busca para ajustar quantidades de itens específicos
5. Clica "Confirmar 358 Vínculos"

## Benefícios

- **Menos cliques**: 1 clique para selecionar todos vs. buscar + selecionar
- **Casos de uso cobertos**: MASSA, MUSSARELA, ou qualquer insumo universal
- **Flexível**: Ainda permite buscar e ajustar quantidades individualmente
