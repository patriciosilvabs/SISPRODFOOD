
# Plano: Importação em Massa do Mapeamento Cardápio Web

## Objetivo

Criar uma funcionalidade de importação de arquivo CSV/Excel para cadastrar automaticamente os itens do Cardápio Web no sistema de mapeamento. O arquivo segue o formato:

| Tipo | Categoria/Complemento | Nome | Código interno | Preço |
|------|----------------------|------|----------------|-------|
| PRODUTO | As + Vendidas | Combo: Calabresa + Refri 1 litro | 2108351 | |
| OPÇÃO | Massas & Bordas (Grande) | # Massa Tradicional | 2001010 | |

## Alterações no Banco de Dados

Adicionar duas novas colunas na tabela `mapeamento_cardapio_itens`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| tipo | text | PRODUTO ou OPÇÃO |
| categoria | text | Categoria/Complemento do item |

Isso permitirá organizar melhor os mapeamentos e filtrar por tipo/categoria.

## Fluxo da Importação

```text
1. Usuário faz upload do arquivo (CSV ou Excel exportado como CSV/TXT)
2. Sistema parseia o arquivo e extrai as colunas
3. Exibe preview dos itens a serem importados
4. Usuário vincula cada item (ou grupo) a um item porcionado
5. Sistema insere os mapeamentos no banco
```

## Componentes a Criar/Modificar

### 1. Migração SQL

Adicionar colunas `tipo` e `categoria` à tabela `mapeamento_cardapio_itens`.

### 2. Hook: `useCardapioWebIntegracao.ts`

- Adicionar mutation `importarMapeamentos` para inserção em lote
- Atualizar interface `MapeamentoCardapioItem` com novos campos

### 3. Página: `ConfigurarCardapioWeb.tsx`

Adicionar nova funcionalidade no tab "Mapeamento":

- Botão "Importar Arquivo"
- Modal/Dialog de importação com:
  - Área de upload/drag-and-drop para arquivo
  - Preview dos itens parseados em tabela
  - Coluna adicional para selecionar item porcionado
  - Opção de importar em lote

### 4. Componente: `ImportarMapeamentoModal.tsx`

Modal dedicado para a importação com:
- Upload de arquivo CSV/TXT
- Parser que detecta delimitador (tab, vírgula, ponto-e-vírgula)
- Tabela editável com os itens parseados
- Select para vincular item porcionado a cada linha
- Botão de importar todos

## Estrutura do Parser

O arquivo pode vir em diferentes formatos:
- CSV com vírgula
- CSV com ponto-e-vírgula
- TXT com tab (padrão Excel)

O parser detectará automaticamente o delimitador analisando a primeira linha.

Colunas esperadas:
1. Tipo (PRODUTO/OPÇÃO)
2. Categoria/Complemento
3. Nome
4. Código interno (será usado como `cardapio_item_id`)
5. Preço (opcional, não usado no mapeamento)

## Interface do Modal de Importação

```text
┌────────────────────────────────────────────────────────────────┐
│ Importar Itens do Cardápio Web                            [X] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📄 Arraste o arquivo aqui ou clique para selecionar     │  │
│  │     Formatos aceitos: CSV, TXT (separado por tab)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ✓ 15 itens encontrados no arquivo                             │
│                                                                │
│  ┌─────────────────────────────────────────────────────────────┤
│  │ Tipo    │ Categoria         │ Nome              │ Código   ││
│  ├─────────┼───────────────────┼───────────────────┼──────────┤│
│  │ PRODUTO │ As + Vendidas     │ Combo Calabresa   │ 2108351  ││
│  │ OPÇÃO   │ Massas & Bordas   │ # Massa Tradicional│ 2001010 ││
│  │ OPÇÃO   │ Massas & Bordas   │ # Borda de Cheddar│ 2001011  ││
│  │ ...     │ ...               │ ...               │ ...      ││
│  └─────────────────────────────────────────────────────────────┘
│                                                                │
│  Estes itens serão cadastrados SEM vínculo a item porcionado.  │
│  Você poderá vincular cada um individualmente depois.          │
│                                                                │
│                      [Cancelar]  [Importar 15 itens]           │
└────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar colunas `tipo` e `categoria` |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |
| `src/hooks/useCardapioWebIntegracao.ts` | Adicionar mutation de importação em lote |
| `src/pages/ConfigurarCardapioWeb.tsx` | Adicionar botão e modal de importação |
| `src/components/modals/ImportarMapeamentoCardapioModal.tsx` | Criar modal de importação |

## Fluxo após Importação

1. Itens são importados com `item_porcionado_id = NULL`
2. Na tabela de mapeamentos, itens sem vínculo aparecem destacados
3. Usuário clica em cada item para vincular ao item porcionado
4. Alternativamente: botão "Vincular em Lote" para associar vários itens de uma vez

## Detalhes Técnicos

### Parser de Arquivo

```typescript
function parseCSV(content: string): ParsedItem[] {
  const lines = content.split('\n');
  const delimiter = detectDelimiter(lines[0]); // tab, comma, or semicolon
  
  return lines.slice(1) // Skip header
    .filter(line => line.trim())
    .map(line => {
      const [tipo, categoria, nome, codigo] = line.split(delimiter);
      return {
        tipo: tipo?.trim(),
        categoria: categoria?.trim(),
        nome: nome?.trim(),
        codigo_interno: parseInt(codigo?.trim()),
      };
    })
    .filter(item => item.codigo_interno && item.nome);
}
```

### Insert em Lote

```typescript
await supabase
  .from('mapeamento_cardapio_itens')
  .insert(items.map(item => ({
    organization_id: organizationId,
    cardapio_item_id: item.codigo_interno,
    cardapio_item_nome: item.nome,
    tipo: item.tipo,
    categoria: item.categoria,
    item_porcionado_id: null, // Vinculado depois
    quantidade_consumida: 1,
    ativo: true,
  })));
```

## Observação sobre Nullabilidade

A coluna `item_porcionado_id` atualmente é `NOT NULL`. Precisamos decidir:
1. **Opção A**: Alterar para nullable, permitindo itens sem vínculo
2. **Opção B**: Exigir que o usuário selecione um item porcionado na importação

Recomendo a **Opção A** para maior flexibilidade - o usuário pode importar tudo e vincular depois.
