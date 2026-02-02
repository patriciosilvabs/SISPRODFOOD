

# Plano: Remover Todos os Mapeamentos de Uma Só Vez

## Objetivo

Adicionar um botão que permite ao usuário excluir **todos os mapeamentos** da tabela `mapeamento_cardapio_itens` de uma só vez, com confirmação de segurança.

## Situação Atual

| Funcionalidade | Estado |
|----------------|--------|
| Remover vínculo individual | ✅ Existe (botão lixeira em cada linha) |
| Remover todos de uma vez | ❌ Não existe |

## Mudança Visual Proposta

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Mapeamento de Produtos                                                     │
│  Configure quais itens porcionados são consumidos para cada produto...      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌────────────────────┐  ┌───────────────┐            │
│  │ 🗑️ Limpar Tudo  │  │ 📤 Importar Arquivo│  │ ➕ Adicionar  │            │
│  └─────────────────┘  └────────────────────┘  └───────────────┘            │
│         ↑                                                                   │
│   NOVO BOTÃO (vermelho/destructive)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Fluxo de Confirmação

1. Usuário clica em **"Limpar Tudo"**
2. Modal de confirmação aparece:
   - Título: "Remover todos os mapeamentos?"
   - Mensagem: "Esta ação é PERMANENTE e IRREVERSÍVEL. Todos os X mapeamentos serão excluídos."
   - Botões: [Cancelar] [Confirmar Exclusão]
3. Após confirmação, todos os registros são deletados
4. Toast de sucesso: "X mapeamentos removidos com sucesso"

## Alterações Técnicas

### 1. Hook: `src/hooks/useCardapioWebIntegracao.ts`

Adicionar nova mutation `deleteAllMapeamentos`:

```typescript
// Mutation: Delete ALL mappings at once
const deleteAllMapeamentos = useMutation({
  mutationFn: async () => {
    if (!organizationId) throw new Error('Organização não encontrada');
    
    const { error } = await supabase
      .from('mapeamento_cardapio_itens')
      .delete()
      .eq('organization_id', organizationId);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
    toast.success('Todos os mapeamentos foram removidos');
  },
  onError: (error) => {
    console.error('Erro ao remover mapeamentos:', error);
    toast.error('Erro ao remover mapeamentos');
  }
});
```

Exportar no return do hook.

### 2. Página: `src/pages/ConfigurarCardapioWeb.tsx`

Adicionar botão com AlertDialog de confirmação na seção de mapeamentos:

```tsx
{mapeamentosAgrupados.length > 0 && (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="destructive" size="sm">
        <Trash2 className="h-4 w-4 mr-2" />
        Limpar Tudo
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Remover todos os mapeamentos?</AlertDialogTitle>
        <AlertDialogDescription>
          Esta ação é <strong>PERMANENTE e IRREVERSÍVEL</strong>. 
          Todos os <strong>{mapeamentosAgrupados.length}</strong> produtos mapeados 
          e seus vínculos serão excluídos.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <AlertDialogAction 
          onClick={(e) => {
            e.preventDefault();
            deleteAllMapeamentos.mutate();
          }}
          className="bg-destructive text-destructive-foreground"
        >
          {deleteAllMapeamentos.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Confirmar Exclusão
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCardapioWebIntegracao.ts` | Adicionar mutation `deleteAllMapeamentos` |
| `src/pages/ConfigurarCardapioWeb.tsx` | Adicionar botão "Limpar Tudo" com confirmação |

## Segurança

- Confirmação obrigatória via AlertDialog
- Mensagem explicita que a ação é "PERMANENTE e IRREVERSÍVEL" 
- Uso de `preventDefault()` para aguardar conclusão da operação assíncrona
- Botão só aparece quando existem mapeamentos para remover

