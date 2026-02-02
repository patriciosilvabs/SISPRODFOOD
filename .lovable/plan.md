

# Plano: Mapeamento de Produtos por Loja

## Situação Atual

| Estrutura Atual | Problema |
|-----------------|----------|
| Mapeamento é **global por organização** | Todas as lojas compartilham o mesmo mapeamento |
| Tabela não tem coluna `loja_id` | Não é possível diferenciar produtos por loja |

```text
┌─────────────────────────────────────────┐
│         ORGANIZAÇÃO EXEMPLO             │
├─────────────────────────────────────────┤
│  mapeamento_cardapio_itens              │
│  (GLOBAL - compartilhado por todas)     │
│                                         │
│  Pizza Grande → Massa G                 │
│  Pizza Média → Massa M                  │
│  ...                                    │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Loja A  │  │ Loja B  │  │ Loja C  │ │
│  │   ↑     │  │   ↑     │  │   ↑     │ │
│  │ (mesmo) │  │ (mesmo) │  │ (mesmo) │ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
```

## Nova Estrutura

```text
┌─────────────────────────────────────────┐
│         ORGANIZAÇÃO EXEMPLO             │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ Loja A - Mapeamento próprio       │  │
│  │ Pizza Grande → Massa G            │  │
│  │ Combo Família → Massa G + Refri   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Loja B - Mapeamento próprio       │  │
│  │ Pizza Grande → Massa G            │  │
│  │ (sem combo família nesta loja)    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Loja C - Mapeamento próprio       │  │
│  │ Pizza Grande → Massa M (diferente)│  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Alterações Necessárias

### 1. Banco de Dados (Migration)

Adicionar coluna `loja_id` à tabela `mapeamento_cardapio_itens`:

```sql
-- Adicionar coluna loja_id (nullable para migração)
ALTER TABLE mapeamento_cardapio_itens 
ADD COLUMN loja_id UUID REFERENCES lojas(id) ON DELETE CASCADE;

-- Atualizar constraint UNIQUE para incluir loja_id
-- (um produto pode ter diferentes mapeamentos por loja)
ALTER TABLE mapeamento_cardapio_itens 
DROP CONSTRAINT IF EXISTS mapeamento_cardapio_itens_organization_id_cardapio_item_id_i_key;

ALTER TABLE mapeamento_cardapio_itens 
ADD CONSTRAINT mapeamento_cardapio_itens_org_loja_item_unique 
UNIQUE(organization_id, loja_id, cardapio_item_id, item_porcionado_id);
```

### 2. Hook: `src/hooks/useCardapioWebIntegracao.ts`

- Adicionar `loja_id` ao tipo `MapeamentoCardapioItem`
- Modificar queries de mapeamento para filtrar por loja selecionada
- Modificar mutations (add, delete, import) para incluir `loja_id`
- Nova query `getMapeamentosPorLoja(lojaId)`

### 3. Página: `src/pages/ConfigurarCardapioWeb.tsx`

- Adicionar seletor de loja na aba "Mapeamento"
- Mostrar mapeamentos apenas da loja selecionada
- Ao importar/adicionar mapeamento, associar à loja selecionada
- Opção para copiar mapeamentos de uma loja para outra

### 4. Interface Atualizada

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Mapeamento de Produtos                                             │
│  Configure quais itens são consumidos para cada produto do cardápio │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📍 Loja: [ Unidade Aleixo ▼ ]                                     │
│                                                                     │
│  ┌───────────────┐  ┌──────────────────┐  ┌─────────────┐          │
│  │ 🗑️ Limpar Tudo│  │ 📤 Importar      │  │ ➕ Adicionar│          │
│  └───────────────┘  └──────────────────┘  └─────────────┘          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ # | Produto                | Vínculo           | Qtd | Ação  │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ 1 | Pizza Mussarela G      | Massa Grande      | 1   | 🗑️   │   │
│  │ 2 | Pizza Calabresa G      | Massa Grande      | 1   | 🗑️   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Mapeamentos desta loja: 2 produtos                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Migration SQL** | Adicionar `loja_id` e atualizar constraints |
| `src/hooks/useCardapioWebIntegracao.ts` | Filtrar mapeamentos por loja, incluir `loja_id` nas mutations |
| `src/pages/ConfigurarCardapioWeb.tsx` | Adicionar seletor de loja na aba Mapeamento |
| `src/components/modals/ImportarMapeamentoCardapioModal.tsx` | Receber `loja_id` como prop |
| `src/components/modals/AdicionarVinculoCardapioModal.tsx` | Receber `loja_id` como prop |

## Benefícios

1. **Flexibilidade**: Cada loja pode ter produtos diferentes no cardápio
2. **Precisão**: Mapeamentos refletem a realidade de cada unidade
3. **Independência**: Alterações em uma loja não afetam outras
4. **Escalabilidade**: Novas lojas começam sem mapeamentos e configuram independentemente

