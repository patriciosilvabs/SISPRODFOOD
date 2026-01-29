
# Plano: Separar Produção por Loja no Resumo da Produção

## ✅ IMPLEMENTADO

### 1. Função RPC: `criar_ou_atualizar_producao_registro` ✅
Modificada para criar UM registro de produção POR LOJA (não mais agregado).

| Antes | Depois |
|-------|--------|
| 1 card com 80 unidades (Loja A + B) | 2 cards: 30 un (Loja A) + 50 un (Loja B) |
| `detalhes_lojas` contém array com todas as lojas | `detalhes_lojas` contém apenas 1 loja |

### 2. Frontend: Filtro por Loja no Kanban ✅
- `LojaFilterTabs.tsx`: Sistema de abas para filtrar por loja na coluna "A PRODUZIR"
- Estrela (★) indica a loja com maior demanda (recomendada para iniciar primeiro)
- Botão "Iniciar Produção da Loja" para processar todos os cards de uma loja

### 3. Indicador de Status por Loja ✅
- `ContagemStatusIndicator.tsx`: Exibe quais lojas já enviaram contagem
- ✅ Verde = Loja enviou contagem (com total de itens e unidades)
- ⏳ Aguardando = Loja ainda não enviou

### 4. Badge da Loja nos Cards ✅
- `KanbanCard.tsx`: Badge proeminente com nome da loja no header de cada card

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/...` | Nova função RPC que cria cards por loja |
| `src/pages/ResumoDaProducao.tsx` | Integração do filtro e indicador |
| `src/components/kanban/ProductGroupedStacks.tsx` | Agrupamento por loja + filtro |
| `src/components/kanban/KanbanCard.tsx` | Badge com nome da loja |
| `src/components/kanban/LojaFilterTabs.tsx` | **NOVO** - Abas de filtro por loja |
| `src/components/kanban/ContagemStatusIndicator.tsx` | **NOVO** - Indicador de status |

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

## Benefícios Alcançados

| Problema Anterior | Solução Implementada |
|-------------------|----------------------|
| Não sabia se loja enviou contagem | Indicador visual claro (verde/aguardando) |
| Produzia tudo misturado | Produção focada por loja |
| Romaneio complexo | Cada produção já vinculada à loja de destino |
| Priorização manual | Sistema destaca loja com maior demanda (★) |
| Erros de distribuição | Rastreabilidade ponta-a-ponta |
