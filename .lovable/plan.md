
# Plano: Importação Aditiva (Não Sobrescreve Mapeamentos)

## Problema Identificado

A função `importarMapeamentos` no hook `useCardapioWebIntegracao.ts` (linhas 496-504) está **deletando todos os mapeamentos não vinculados** antes de inserir novos:

```typescript
// ATUAL - Deleta tudo antes de inserir
const { error: deleteError } = await supabase
  .from('mapeamento_cardapio_itens')
  .delete()
  .eq('organization_id', organizationId)
  .eq('loja_id', loja_id)
  .is('item_porcionado_id', null);
```

Isso causa a **perda** de todos os produtos previamente importados que ainda não foram vinculados.

## Solução

Mudar a estratégia de **delete + insert** para **upsert aditivo**:

1. Buscar os códigos de produtos que já existem no mapeamento para a loja
2. Filtrar os itens de importação para incluir apenas os **novos** (que não existem)
3. Inserir apenas os novos itens, mantendo os existentes intactos
4. Opcionalmente, atualizar informações (tipo, categoria, nome) dos itens existentes

## Fluxo Corrigido

```text
ANTES (sobrescreve):
1. Delete todos não vinculados
2. Insert novos
→ Resultado: Perde itens anteriores

DEPOIS (adiciona):
1. Busca códigos existentes na loja
2. Filtra novos itens (que não existem)
3. Insert apenas os novos
4. (Opcional) Atualiza nome/tipo/categoria dos existentes
→ Resultado: Mantém itens anteriores + adiciona novos
```

## Detalhes Técnicos

### Arquivo: `src/hooks/useCardapioWebIntegracao.ts`

**Linhas 483-535 - Alterar função `importarMapeamentos`:**

```typescript
const importarMapeamentos = useMutation({
  mutationFn: async ({ loja_id, items }: { loja_id: string; items: ImportarMapeamentoItem[] }) => {
    if (!organizationId) throw new Error('Organização não encontrada');
    
    // Step 1: Deduplicate items by codigo_interno
    const itemsUnicos = new Map<number, ImportarMapeamentoItem>();
    for (const item of items) {
      itemsUnicos.set(item.codigo_interno, item);
    }
    const itemsDeduplicados = Array.from(itemsUnicos.values());
    
    // Step 2: Buscar códigos que JÁ existem no mapeamento para esta loja
    const { data: existentes, error: queryError } = await supabase
      .from('mapeamento_cardapio_itens')
      .select('cardapio_item_id')
      .eq('organization_id', organizationId)
      .eq('loja_id', loja_id);
    
    if (queryError) throw queryError;
    
    const codigosExistentes = new Set(existentes?.map(e => e.cardapio_item_id) || []);
    
    // Step 3: Filtrar apenas os itens NOVOS (que não existem)
    const itensNovos = itemsDeduplicados.filter(
      item => !codigosExistentes.has(item.codigo_interno)
    );
    
    // Se não há itens novos, retornar early
    if (itensNovos.length === 0) {
      return { inseridos: 0, jaExistiam: itemsDeduplicados.length };
    }
    
    // Step 4: Insert apenas os novos itens
    const mappings = itensNovos.map(item => ({
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
    
    return { 
      inseridos: data.length, 
      jaExistiam: itemsDeduplicados.length - itensNovos.length 
    };
  },
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
    
    if (result.inseridos === 0) {
      toast.info(`Todos os ${result.jaExistiam} itens já existiam no mapeamento`);
    } else if (result.jaExistiam > 0) {
      toast.success(`${result.inseridos} novos itens adicionados! (${result.jaExistiam} já existiam)`);
    } else {
      toast.success(`${result.inseridos} itens importados com sucesso!`);
    }
  },
  onError: (error) => {
    console.error('Erro ao importar mapeamentos:', error);
    toast.error('Erro ao importar mapeamentos');
  }
});
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Importar 100 itens (50 novos) | Perde todos anteriores, fica com 100 | Mantém anteriores + 50 novos |
| Re-importar mesma lista | Deleta e recria (perde ordem) | Ignora existentes, mantém tudo |
| Importar de outra fonte | Substitui tudo | Adiciona os que faltam |

## Feedback ao Usuário

- **Todos novos:** "25 itens importados com sucesso!"
- **Alguns novos:** "15 novos itens adicionados! (10 já existiam)"
- **Nenhum novo:** "Todos os 25 itens já existiam no mapeamento"
