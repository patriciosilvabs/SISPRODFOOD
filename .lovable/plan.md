
# Plano: Correção da Importação com Prevenção de Duplicatas

## Problemas Identificados

### 1. Duplicatas Massivas no Banco
Sua organização tem **305 itens únicos** mas **3.106 registros** (10x mais)! Isso ocorre porque cada vez que você importa, todos os itens são inseridos novamente.

### 2. Sem Verificação de Duplicatas
A tabela não possui restrição UNIQUE e a função de importação não verifica se os itens já existem.

---

## Solução

### Parte 1: Limpeza dos Dados Duplicados
Primeiro, vamos remover os registros duplicados mantendo apenas um de cada item por organização.

### Parte 2: Adicionar Constraint UNIQUE
Criar uma constraint UNIQUE para impedir que o mesmo `cardapio_item_id` seja inserido duas vezes na mesma organização.

### Parte 3: Usar UPSERT na Importação
Modificar a função de importação para usar `upsert` - se o item já existe, atualiza; se não existe, insere.

---

## Alterações

### Alteração no Banco de Dados

```sql
-- Passo 1: Remover duplicatas mantendo apenas o registro mais antigo de cada item
DELETE FROM mapeamento_cardapio_itens a
USING mapeamento_cardapio_itens b
WHERE a.organization_id = b.organization_id
  AND a.cardapio_item_id = b.cardapio_item_id
  AND a.created_at > b.created_at;

-- Passo 2: Adicionar constraint UNIQUE para evitar futuras duplicatas
ALTER TABLE mapeamento_cardapio_itens 
ADD CONSTRAINT mapeamento_cardapio_itens_org_item_unique 
UNIQUE (organization_id, cardapio_item_id);
```

### Alteração no Código

**Arquivo:** `src/hooks/useCardapioWebIntegracao.ts`

Modificar a função `importarMapeamentos` para usar `upsert`:

```typescript
// Mutation: Import mappings in batch (com upsert para evitar duplicatas)
const importarMapeamentos = useMutation({
  mutationFn: async (items: ImportarMapeamentoItem[]) => {
    if (!organizationId) throw new Error('Organização não encontrada');
    
    const mappings = items.map(item => ({
      organization_id: organizationId,
      cardapio_item_id: item.codigo_interno,
      cardapio_item_nome: item.nome,
      tipo: item.tipo,
      categoria: item.categoria,
      item_porcionado_id: null,
      quantidade_consumida: 1,
      ativo: true,
    }));

    // Usar upsert para evitar duplicatas
    const { data, error } = await supabase
      .from('mapeamento_cardapio_itens')
      .upsert(mappings, {
        onConflict: 'organization_id,cardapio_item_id',
        ignoreDuplicates: false // Atualiza se já existir
      })
      .select();
    
    if (error) throw error;
    return data;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
    toast.success(`${data.length} itens importados/atualizados com sucesso!`);
  },
  onError: (error) => {
    console.error('Erro ao importar mapeamentos:', error);
    toast.error('Erro ao importar mapeamentos');
  }
});
```

---

## Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| **Banco de Dados** | Remover duplicatas existentes |
| **Banco de Dados** | Adicionar constraint UNIQUE (organization_id, cardapio_item_id) |
| **useCardapioWebIntegracao.ts** | Usar `upsert` em vez de `insert` na importação |

---

## Resultado Esperado

Após as correções:
- **Antes**: 3.106 registros (com duplicatas)
- **Depois**: ~305 registros (apenas itens únicos)
- **Futuro**: Impossível criar duplicatas - importações subsequentes apenas atualizam os dados existentes

---

## Detalhes Técnicos

### Como o UPSERT Funciona
Quando você importar um arquivo com itens que já existem:
1. Itens **novos** → serão inseridos
2. Itens **existentes** → serão atualizados (nome, tipo, categoria)
3. **Vínculos mantidos** → o campo `item_porcionado_id` não será sobrescrito

### Constraint UNIQUE
A constraint `(organization_id, cardapio_item_id)` garante que cada código interno só pode existir uma vez por organização.
