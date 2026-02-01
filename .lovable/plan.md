

# Plano: Correção do Problema de Exclusão de Produtos/Itens

## Diagnóstico

O problema está no uso incorreto do componente `AlertDialogAction` do Radix UI. Este componente tem um comportamento padrão que **fecha o dialog imediatamente ao clicar**, independente de se a função `onClick` completou ou não.

Quando você clica em "Excluir":
1. O `AlertDialogAction` dispara o fechamento do modal
2. O `onOpenChange` é chamado com `false`
3. Isso chama `onClose()`, que seta `deletingProduto = null`
4. O modal fecha ANTES de `handleDelete` executar a exclusão

## Solução

Usar `event.preventDefault()` para impedir o fechamento automático do `AlertDialogAction`, permitindo que a função assíncrona complete antes de fechar o modal manualmente.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/modals/DeleteProdutoDialog.tsx` | Adicionar `e.preventDefault()` no onClick e usar `asChild` pattern |
| `src/pages/ItensPorcionados.tsx` | Verificar se o mesmo problema existe no handleDelete |

## Correção Técnica

### DeleteProdutoDialog.tsx

**Antes:**
```tsx
<AlertDialogAction
  onClick={handleDelete}
  disabled={loading}
  className="bg-destructive ..."
>
  {loading ? 'Excluindo...' : 'Excluir'}
</AlertDialogAction>
```

**Depois:**
```tsx
<AlertDialogAction
  onClick={(e) => {
    e.preventDefault(); // Impede o fechamento automático
    handleDelete();
  }}
  disabled={loading}
  className="bg-destructive ..."
>
  {loading ? 'Excluindo...' : 'Excluir'}
</AlertDialogAction>
```

### ItensPorcionados.tsx

O `handleDelete` atual usa `confirm()` nativo do browser, que funciona diferente. No entanto, seria bom padronizar usando o mesmo padrão de dialog com `AlertDialog` para consistência.

## Benefícios

1. **Ação completa**: A exclusão será executada antes do modal fechar
2. **Feedback visual**: O botão mostrará "Excluindo..." durante o processo
3. **Mensagens de erro**: Toast de erro será exibido caso ocorra falha
4. **Padrão consistente**: Mesmo comportamento para produtos e itens porcionados

## Observações

- Esta correção é simples mas crítica para o funcionamento correto
- O mesmo padrão deve ser aplicado em todos os dialogs de exclusão do sistema
- O dialog só fechará após a operação completar (sucesso ou erro)

