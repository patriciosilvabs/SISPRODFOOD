

# Plano: Exibir Itens com Estoque CPD Suficiente na Coluna "A Produzir"

## Objetivo

Quando o estoque do CPD é suficiente para cobrir a demanda das lojas (gatilho atingido), o item deve aparecer na coluna "A PRODUZIR" com um visual diferenciado, permitindo que o usuário **confirme** que essa quantidade já está disponível no CPD - sem precisar produzir.

## Comportamento Atual

```text
Demanda Lojas = 50 un
Estoque CPD = 60 un
Saldo Líquido = 50 - 60 = -10 (suficiente)

Resultado: Nenhum card criado, apenas CPDStockIndicator aparece
```

## Comportamento Proposto

```text
Demanda Lojas = 50 un  
Estoque CPD = 60 un
Saldo Líquido = -10 (suficiente)

Resultado: Card especial aparece em "A PRODUZIR" com:
- Status visual diferenciado (verde/emerald)
- Texto: "Estoque CPD Disponível"
- Botão: "Confirmar Disponibilidade" 
- Ação: Remove o card da lista (confirma que foi verificado)
```

## Alterações Necessárias

### 1. Migração SQL - Criar Cards "estoque_disponivel"

Atualizar a função `criar_ou_atualizar_producao_registro` para, quando o saldo for <= 0, criar um card com status especial `estoque_disponivel` em vez de não criar nada.

**Arquivo:** Nova migração SQL

```sql
-- Quando saldo líquido <= 0, criar card com status especial
IF v_saldo_liquido <= 0 THEN
    -- Criar card informativo para confirmação de estoque
    INSERT INTO producao_registros (
        item_id, 
        item_nome, 
        status,  -- Novo status: 'estoque_disponivel'
        unidades_programadas, 
        demanda_lojas,
        organization_id,
        ...
    ) VALUES (
        p_item_id,
        v_item.nome,
        'estoque_disponivel',  -- Status especial
        0,  -- Nenhuma produção necessária
        v_demanda_total,
        ...
    );
    RETURN v_registro_id;
END IF;
```

### 2. Atualizar Tipagem e Colunas

Adicionar novo status `estoque_disponivel` à configuração das colunas.

**Arquivo:** `src/pages/ResumoDaProducao.tsx`

```typescript
const columnConfig: Record<StatusColumn, { ... }> = {
  a_produzir: { ... },
  // Novo status mapeado para a mesma coluna
};

// No mapeamento de status:
if (status === 'estoque_disponivel') {
  targetColumn = 'a_produzir';  // Aparece na mesma coluna
}
```

### 3. Componente KanbanCard - Visual Diferenciado

Adicionar renderização especial para cards com status `estoque_disponivel`.

**Arquivo:** `src/components/kanban/KanbanCard.tsx`

| Elemento | Card Normal | Card Estoque Disponível |
|----------|-------------|------------------------|
| Borda | Padrão | Verde (emerald) |
| Ícone | Produção | CheckCircle |
| Título | "Item a produzir" | "Estoque CPD Disponível" |
| Quantidade | "X unidades a produzir" | "Demanda: X un • Estoque: Y un" |
| Botão | "Iniciar Preparo" | "Confirmar Disponibilidade" |
| Ação | Inicia produção | Remove card (confirmação) |

### 4. Remover CPDStockIndicator (Redundante)

Como agora os itens aparecem como cards, o indicador separado torna-se redundante.

**Arquivo:** `src/components/kanban/ProductGroupedStacks.tsx`

Remover a lógica que mostra `CPDStockIndicator` quando não há cards.

## Fluxo Visual Final

```text
┌─────────────────────────────────────────────────────────────┐
│ A PRODUZIR                                              [3] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✅ ESFIHA DE FRANGO              [Estoque Disponível]  │ │
│ │ Demanda: 45 un • CPD: 60 un (+15 excedente)            │ │
│ │ Lojas: ALEIXO (25), JAPIIM (20)                        │ │
│ │                                                        │ │
│ │                  [Confirmar Disponibilidade]           │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🍕 PIZZA CALABRESA                    [Loja: ALEIXO]   │ │
│ │ 30 unidades a produzir                                 │ │
│ │                                                        │ │
│ │                    [Iniciar Preparo]                   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Criar cards `estoque_disponivel` quando CPD cobre demanda |
| `src/pages/ResumoDaProducao.tsx` | Mapear novo status, função de confirmação |
| `src/components/kanban/KanbanCard.tsx` | Renderização especial verde para `estoque_disponivel` |
| `src/components/kanban/ProductGroupedStacks.tsx` | Remover CPDStockIndicator redundante |

## Detalhes Técnicos

### Função de Confirmação

Quando o usuário clica em "Confirmar Disponibilidade":

```typescript
const handleConfirmarEstoqueDisponivel = async (registroId: string) => {
  // Atualiza status para 'confirmado_estoque' ou deleta o card
  await supabase
    .from('producao_registros')
    .delete()
    .eq('id', registroId);
  
  toast.success('Disponibilidade confirmada! Item removido da lista.');
  await loadProducaoRegistros();
};
```

### Dados do Card Especial

O card `estoque_disponivel` conterá:
- `demanda_lojas`: Total de unidades demandadas
- `detalhes_lojas`: Breakdown por loja  
- Campo adicional: `estoque_cpd_disponivel` para exibir quantidade no CPD

