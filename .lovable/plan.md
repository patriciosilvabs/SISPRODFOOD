
# Plano: Botão "Remover Todos os Vínculos por Categoria"

## Objetivo

Adicionar um botão de exclusão em cada grupo de categoria para remover todos os mapeamentos daquela categoria específica, sem afetar outras categorias.

## Mudanças Necessárias

### 1. Hook `useCardapioWebIntegracao.ts`

Criar nova mutation `deleteVinculosByCategoria`:

```typescript
// Mutation: Delete all mappings by category for a specific store
const deleteVinculosByCategoria = useMutation({
  mutationFn: async ({ lojaId, categoria }: { lojaId: string; categoria: string }) => {
    if (!organizationId) throw new Error('Organização não encontrada');
    
    const { error } = await supabase
      .from('mapeamento_cardapio_itens')
      .delete()
      .eq('organization_id', organizationId)
      .eq('loja_id', lojaId)
      .eq('categoria', categoria);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
    toast.success('Vínculos da categoria removidos');
  },
  onError: (error) => {
    console.error('Erro ao remover vínculos:', error);
    toast.error('Erro ao remover vínculos da categoria');
  }
});
```

### 2. Página `ConfigurarCardapioWeb.tsx`

Adicionar botão no header de cada grupo colapsável (apenas no modo "Por Categoria"):

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ▼  Combo: Pizza G + Refri - Massas & Bordas    7 produtos    [🗑️ Remover]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Tipo     │ Produto                │ Código   │ Itens Vinculados           │
│  OPÇÃO    │ # Borda de Catupiry    │ 3543765  │ ✓ MASSA  ✓ MUSSARELA       │
│  OPÇÃO    │ # Borda de Cheddar     │ 3543763  │ ✓ MASSA  ✓ MUSSARELA       │
│  ...                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

O botão terá:
- Ícone de lixeira (`Trash2`)
- Confirmação via `AlertDialog` antes de excluir
- Exibição da contagem de produtos que serão afetados
- Desabilitado enquanto a exclusão estiver em andamento

### Layout do Botão

```tsx
{modoVisualizacao === 'categoria' && (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={(e) => e.stopPropagation()}
      >
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        Remover
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Remover todos os vínculos desta categoria?</AlertDialogTitle>
        <AlertDialogDescription>
          Esta ação irá remover <strong>X produtos</strong> da categoria 
          "<strong>Nome da Categoria</strong>" e seus vínculos.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <AlertDialogAction onClick={...} className="bg-destructive">
          Confirmar Exclusão
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

## Arquivos Modificados

1. **`src/hooks/useCardapioWebIntegracao.ts`**
   - Adicionar mutation `deleteVinculosByCategoria`
   - Exportar a nova mutation no retorno do hook

2. **`src/pages/ConfigurarCardapioWeb.tsx`**
   - Importar `deleteVinculosByCategoria` do hook
   - Adicionar botão com `AlertDialog` no header do grupo colapsável
   - Passar `lojaIdMapeamento` e `grupoNome` (categoria) para a mutation

## Fluxo de Uso

1. Usuário visualiza mapeamentos no modo "Por Categoria"
2. Localiza a categoria que deseja limpar (ex: "Combo: Pizza G + Refri")
3. Clica no botão "Remover" no header do grupo
4. Confirmação aparece mostrando quantos produtos serão removidos
5. Ao confirmar, todos os mapeamentos daquela categoria são deletados
6. Lista é atualizada automaticamente

## Considerações

- Botão aparece **apenas** no modo de visualização "Por Categoria"
- No modo "Por Tipo" não faz sentido, pois tipos são mais genéricos (PRODUTO, OPÇÃO)
- A exclusão é por `categoria` (string exata no banco)
- Afeta apenas a loja selecionada
