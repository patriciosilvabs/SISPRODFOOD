
# Plano: Separar Produção por Loja no Resumo da Produção

## Entendimento do Problema

Atualmente, o sistema **agrega as demandas de TODAS as lojas** em um único card de produção para cada item. Isso significa:
- Se Loja A precisa de 30 unidades de Frango e Loja B precisa de 50, o sistema cria 1 card com 80 unidades
- O CPD inicia a produção de TUDO de uma vez
- Não há como visualizar/controlar qual loja já enviou contagem
- Não há como priorizar a produção de uma loja específica

## Nova Arquitetura Proposta

O sistema passará a **criar cards individuais por loja**, permitindo:
1. Visualizar quais lojas já enviaram suas contagens
2. Iniciar produção priorizando a loja com maior demanda
3. Garantir que cada loja seja atendida independentemente
4. Manter rastreabilidade por loja (romaneio, conferência)

---

## Mudanças Necessárias

### 1. Função RPC: `criar_ou_atualizar_producao_registro`

**Mudança principal:** Criar UM registro de produção POR LOJA (não mais agregado)

| Antes | Depois |
|-------|--------|
| 1 card com 80 unidades (Loja A + B) | 2 cards: 30 un (Loja A) + 50 un (Loja B) |
| `detalhes_lojas` contém array com todas as lojas | `detalhes_lojas` contém apenas 1 loja |
| Loop cria traços por capacidade masseira | Loop cria por LOJA primeiro, depois traços |

**Nova lógica SQL:**
```sql
-- Para cada loja com contagem > 0
FOR v_contagem IN 
    SELECT cp.loja_id, l.nome as loja_nome, GREATEST(cp.a_produzir, 0) as demanda
    FROM contagem_porcionados cp
    JOIN lojas l ON l.id = cp.loja_id
    WHERE cp.item_porcionado_id = p_item_id
      AND cp.a_produzir > 0
      AND cp.dia_operacional = v_data_hoje
LOOP
    -- Criar card(s) para ESTA loja
    -- Desmembrar em traços se necessário (masseira)
    ...
END LOOP;
```

### 2. Frontend: Agrupamento por Loja no Kanban

**Arquivo:** `src/pages/ResumoDaProducao.tsx`

Adicionar sistema de abas/filtro por loja na coluna "A PRODUZIR":

```
┌─────────────────────────────────────────────────┐
│  A PRODUZIR                              [12]   │
├─────────────────────────────────────────────────┤
│  [TODAS] [JAPIIM ★] [CACHOEIRINHA] [ALEIXO]     │ ← Abas por loja
│                                                 │
│  ★ = Maior demanda (recomendado iniciar por)   │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐      │
│  │ FRANGO - PORCIONADO                   │      │
│  │ Loja: UNIDADE JAPIIM                  │      │
│  │ Demanda: 64 unidades                  │      │
│  │ [▶ INICIAR PREPARO]                   │      │
│  └───────────────────────────────────────┘      │
│                                                 │
│  ┌───────────────────────────────────────┐      │
│  │ BACON - PORCIONADO                    │      │
│  │ Loja: UNIDADE JAPIIM                  │      │
│  │ Demanda: 70 unidades                  │      │
│  │ [▶ INICIAR PREPARO]                   │      │
│  └───────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

### 3. Botão "Iniciar Produção da Loja"

Novo botão que permite iniciar TODOS os cards de uma loja de uma vez:

```
[🚀 Iniciar Tudo - JAPIIM (5 itens)]
```

Ao clicar:
- Confirma separação de insumos consolidada
- Move todos os cards da loja para "EM PREPARO"
- Debita estoque proporcional

### 4. Indicador de Status por Loja

Exibir visualmente quais lojas já enviaram contagem:

```
┌────────────────────────────────────────┐
│ STATUS DAS CONTAGENS DE HOJE           │
├────────────────────────────────────────┤
│ ✅ JAPIIM        - 9 itens, 231 un     │
│ ⏳ CACHOEIRINHA  - Aguardando          │
│ ⏳ ALEIXO        - Aguardando          │
└────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **Nova migração SQL** | Reescrever `criar_ou_atualizar_producao_registro` para criar por loja |
| **src/pages/ResumoDaProducao.tsx** | Adicionar filtro por loja, indicador de status, botão batch |
| **src/components/kanban/ProductGroupedStacks.tsx** | Agrupar por loja ao invés de item |
| **src/components/kanban/KanbanCard.tsx** | Exibir badge com nome da loja de forma proeminente |

---

## Fluxo Operacional Resultante

```
1. Lojas enviam contagens individualmente
   ├── JAPIIM envia às 15:00 → Cards JAPIIM aparecem no Kanban
   ├── CACHOEIRINHA envia às 16:00 → Cards CACHOEIRINHA aparecem
   └── ALEIXO envia às 17:00 → Cards ALEIXO aparecem

2. CPD visualiza cards separados por loja
   ├── Aba "JAPIIM" mostra: Frango (64), Bacon (70), Pepperoni (75)...
   └── Aba "CACHOEIRINHA" mostra: Carne (27), Mussarela (19)...

3. Operador clica "Iniciar Produção - JAPIIM"
   ├── Confirma insumos consolidados
   ├── Todos os cards JAPIIM movem para EM PREPARO
   └── Após finalizar, romaneio fica vinculado à JAPIIM

4. Operador clica "Iniciar Produção - CACHOEIRINHA"
   └── Mesma lógica, separado
```

---

## Benefícios

| Problema Atual | Solução |
|----------------|---------|
| Não sabe se loja enviou contagem | Indicador visual claro |
| Produz tudo misturado | Produção focada por loja |
| Romaneio complexo | Cada produção já está vinculada à loja de destino |
| Priorização manual | Sistema sugere loja com maior demanda |
| Erros de distribuição | Rastreabilidade ponta-a-ponta |
