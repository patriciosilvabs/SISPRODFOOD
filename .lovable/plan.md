
# Plano: Mapeamento por Categoria

## Problema Atual

O sistema atual vincula **item a item**, ou seja:
- Pizza Calabresa (código 3541758) → MASSA-PORCIONADO
- Pizza Portuguesa (código 3541759) → MASSA-PORCIONADO  
- Pizza 4 Queijos (código 3541760) → MASSA-PORCIONADO
- ... (dezenas de itens)

Isso é trabalhoso, especialmente quando **todos os itens de uma categoria** consomem o mesmo ingrediente.

## Solução Proposta

Criar um novo nível de mapeamento: **Mapeamento por Categoria**

```text
┌─────────────────────────────────────────────────────────────────┐
│  Regras de Mapeamento por Categoria                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Categoria                    Item Porcionado       Quantidade  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Pizzas                     MASSA - PORCIONADO        1     ││
│  │ Pizzas                     MUSSARELA - PORCIONADO    1     ││
│  │ Selecione o sabor          (herda item principal)    -     ││
│  │ Massas & Bordas (Grande)   BORDA - PORCIONADO        1     ││
│  │ Bebidas                    (sem mapeamento)          -     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                        [+ Adicionar Regra]      │
└─────────────────────────────────────────────────────────────────┘
```

## Lógica de Processamento (Webhook)

O webhook processaria na seguinte ordem de prioridade:

1. **Mapeamento específico** (por item_id) → maior prioridade
2. **Mapeamento por categoria** → fallback se não houver específico
3. **Sem mapeamento** → ignora o item

### Exemplo de Fluxo:

```text
Pedido: Pizza Calabresa (item_id=3541758, categoria="Pizzas")

1. Busca mapeamento para item_id=3541758 → NÃO ENCONTRADO
2. Busca mapeamento para categoria="Pizzas" → ENCONTRADO!
   → Vinculado a: MASSA-PORCIONADO (1x), MUSSARELA-PORCIONADO (1x)
3. Baixa estoque de MASSA e MUSSARELA
```

## Estrutura de Dados

### Nova Tabela: `mapeamento_cardapio_categorias`

```sql
CREATE TABLE mapeamento_cardapio_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  loja_id UUID REFERENCES lojas(id),
  categoria TEXT NOT NULL,
  tipo TEXT, -- 'PRODUTO' ou 'OPÇÃO' (opcional, para filtrar)
  item_porcionado_id UUID NOT NULL REFERENCES itens_porcionados(id),
  quantidade_consumida INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (organization_id, loja_id, categoria, item_porcionado_id)
);
```

## Mudanças no Código

### 1. Nova Interface na UI

Adicionar uma nova aba "Regras por Categoria" na página de configuração:

```text
┌─────────────────────────────────────────────────────────────────┐
│  [Lojas] [Mapeamento] [Regras por Categoria] [Histórico]        │
└─────────────────────────────────────────────────────────────────┘
```

**Funcionalidades da aba:**
- Listar categorias existentes (extraídas dos mapeamentos)
- Permitir criar regra: Categoria → Item Porcionado (Qtd)
- Editar/remover regras existentes

### 2. Atualização do Webhook

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

Modificar a função `processItem` para buscar também por categoria:

```typescript
const processItem = async (itemId, itemName, quantity, sourceType, categoria) => {
  // 1. Buscar mapeamento específico por item_id
  let mappings = mapeamentoMap.get(itemId);
  
  // 2. Se não encontrou, buscar por categoria
  if (!mappings || mappings.length === 0) {
    mappings = categoriaMapeamentoMap.get(categoria);
    if (mappings) {
      console.log(`[${sourceType}] Usando mapeamento por categoria: ${categoria}`);
    }
  }
  
  // 3. Processar normalmente
  // ...
}
```

### 3. Hook de Integração

**Arquivo:** `src/hooks/useCardapioWebIntegracao.ts`

Adicionar queries e mutations para gerenciar mapeamentos por categoria:

```typescript
// Query para mapeamentos por categoria
const { data: mapeamentosCategorias } = useQuery({
  queryKey: ['cardapio-web-mapeamentos-categorias', organizationId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('mapeamento_cardapio_categorias')
      .select(`*, item_porcionado:itens_porcionados(id, nome)`)
      .eq('organization_id', organizationId);
    return data;
  }
});

// Mutation para criar mapeamento por categoria
const addMapeamentoCategoria = useMutation({
  mutationFn: async ({ categoria, item_porcionado_id, quantidade_consumida }) => {
    // ...
  }
});
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **Novo:** `mapeamento_cardapio_categorias` | Criar tabela via migration |
| `supabase/functions/cardapio-web-webhook/index.ts` | Buscar mapeamentos por categoria como fallback |
| `src/hooks/useCardapioWebIntegracao.ts` | Adicionar queries/mutations para categorias |
| `src/pages/ConfigurarCardapioWeb.tsx` | Adicionar aba "Regras por Categoria" |

## Fluxo de Uso

1. **Admin importa produtos do Cardápio Web** (CSV/Excel)
2. **Admin cria regras por categoria:**
   - Categoria "Pizzas" → MASSA (1x), MUSSARELA (1x)
   - Categoria "Massas & Bordas" → BORDA (1x)
3. **Pedido chega via webhook:**
   - Pizza Calabresa (categoria: Pizzas)
   - Sistema busca mapeamento específico → não encontra
   - Sistema busca mapeamento por categoria → encontra "Pizzas"
   - Baixa MASSA e MUSSARELA automaticamente

## Benefícios

1. **Menos trabalho manual**: Uma regra cobre dezenas de produtos
2. **Manutenção simplificada**: Novo produto na categoria já herda as regras
3. **Flexibilidade**: Ainda permite override específico por produto
4. **Organização**: Separa regras gerais (categoria) de exceções (produto específico)

## Considerações

- **Prioridade**: Mapeamento específico sempre prevalece sobre categoria
- **Loja-específico**: Regras podem ser por loja ou globais (loja_id = NULL)
- **Tipo**: Opcionalmente filtrar por tipo (PRODUTO vs OPÇÃO)
