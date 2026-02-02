

# Plano: Corrigir Erro de Constraint Única na Importação de Mapeamentos

## Problema Identificado

Ao importar mapeamentos do Cardápio Web, ocorre o erro:
```
duplicate key value violates unique constraint "mapeamento_cardapio_itens_org_loja_item_null_unique"
```

### Causas

1. **Itens duplicados no arquivo de importação**: Se o arquivo Excel/CSV contém duas linhas com o mesmo `codigo_interno`, ambas serão enviadas para inserção, violando a constraint.

2. **Lógica atual não deduplica**: O parsing em `parseCSV()` e `parseExcel()` não remove duplicados antes de enviar para o banco.

---

## Solução

Adicionar **deduplicação por `codigo_interno`** antes de inserir os registros no banco de dados.

---

## Mudanças no Código

### Arquivo: `src/hooks/useCardapioWebIntegracao.ts`

Modificar a mutation `importarMapeamentos` para remover duplicados antes da inserção:

```typescript
const importarMapeamentos = useMutation({
  mutationFn: async ({ loja_id, items }: { loja_id: string; items: ImportarMapeamentoItem[] }) => {
    if (!organizationId) throw new Error('Organização não encontrada');
    
    // NOVO: Deduplicar itens por codigo_interno (cardapio_item_id)
    // Se houver duplicados, manter apenas o último (sobrescreve)
    const itemsUnicos = new Map<number, ImportarMapeamentoItem>();
    for (const item of items) {
      itemsUnicos.set(item.codigo_interno, item);
    }
    const itemsDeduplicados = Array.from(itemsUnicos.values());
    
    // Step 1: Delete all unlinked mappings (item_porcionado_id IS NULL) for this store
    const { error: deleteError } = await supabase
      .from('mapeamento_cardapio_itens')
      .delete()
      .eq('organization_id', organizationId)
      .eq('loja_id', loja_id)
      .is('item_porcionado_id', null);
    
    if (deleteError) throw deleteError;
    
    // Step 2: Insert deduplicated mappings
    const mappings = itemsDeduplicados.map(item => ({
      organization_id: organizationId,
      loja_id,
      cardapio_item_id: item.codigo_interno,
      cardapio_item_nome: item.nome,
      tipo: item.tipo,
      categoria: item.categoria,
      item_porcionado_id: null,
      quantidade_consumida: 1,
      ativo: true,
    }));

    const { data, error } = await supabase
      .from('mapeamento_cardapio_itens')
      .insert(mappings)
      .select();
    
    if (error) throw error;
    return data;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
    toast.success(`${data.length} itens importados com sucesso!`);
  },
  onError: (error) => {
    console.error('Erro ao importar mapeamentos:', error);
    toast.error('Erro ao importar mapeamentos');
  }
});
```

---

## Alternativa: Deduplicar no Modal (opcional)

Também podemos mostrar um aviso no modal quando o arquivo contém duplicados:

```typescript
// Em ImportarMapeamentoCardapioModal.tsx, após o parsing
const codigosUnicos = new Set(items.map(i => i.codigo_interno));
if (codigosUnicos.size < items.length) {
  const duplicados = items.length - codigosUnicos.size;
  toast.warning(`${duplicados} item(s) duplicado(s) foram removidos`);
}
```

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useCardapioWebIntegracao.ts` | Adicionar deduplicação por `codigo_interno` antes de inserir |

---

## Benefícios

1. **Robustez**: Arquivos com duplicados não causam mais erro
2. **Simplicidade**: Resolve no backend, sem exigir que o usuário corrija o arquivo
3. **Transparência**: O toast de sucesso mostra quantos itens únicos foram importados

