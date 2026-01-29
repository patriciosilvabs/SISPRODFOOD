

# Plano: Corrigir Loop Infinito de Atualizações Realtime

## Problema Identificado

A página **Resumo da Produção** está em um loop infinito de atualizações. Os logs mostram dezenas de mensagens alternando rapidamente:

```
[ResumoDaProducao] Estoque ideal alterado - aguardando recálculo
[ResumoDaProducao] Contagem atualizada - recarregando produção
```

Este loop eventualmente causa **perda de conexão com o servidor**.

---

## Causa Raiz: Ciclo de Feedback entre Triggers e Realtime

### Cadeia de Eventos:

```text
1. Alteração em estoques_ideais_semanais
   ↓
2. Trigger trg_recalcular_apos_estoque_ideal dispara
   ↓
3. Trigger ATUALIZA contagem_porcionados.ideal_amanha (UPDATE)
   ↓
4. Trigger trg_criar_producao_apos_contagem dispara (AFTER UPDATE)
   ↓
5. Altera producao_registros
   ↓
6. Frontend recebe 3 eventos realtime simultaneos:
   - estoques_ideais_semanais (mudança original)
   - contagem_porcionados (update do ideal_amanha)
   - producao_registros (novo/atualizado card)
   ↓
7. Cada evento dispara loadProducaoRegistros() com debounce
   ↓
8. Múltiplas chamadas se sobrepõem e podem re-disparar triggers
```

### Por que o loop se sustenta:

1. O trigger `trigger_recalcular_producao_apos_estoque_ideal` faz **UPDATE em contagem_porcionados**
2. Isso dispara o trigger `trg_criar_producao_apos_contagem`
3. O frontend escuta **ambas as tabelas** via realtime
4. Com múltiplos eventos chegando em rápida sucessão, o debounce não é suficiente

---

## Solução Proposta

### Estratégia 1: Consolidar Listeners Realtime (Frontend)

Reduzir os listeners de 4 tabelas para apenas 1 (`producao_registros`), já que os triggers no banco já garantem que as mudanças nas outras tabelas resultem em atualizações nos cards de produção.

**Benefícios:**
- Elimina eventos duplicados
- Simplifica lógica de debounce
- Mantém reatividade (triggers ainda funcionam)

### Estratégia 2: Evitar UPDATE Redundante (Backend)

Modificar `trigger_recalcular_producao_apos_estoque_ideal` para **não atualizar** `contagem_porcionados` se o valor já está correto, evitando disparar o trigger de contagem desnecessariamente.

**Benefícios:**
- Reduz operações no banco
- Quebra o ciclo de feedback na fonte

---

## Implementação Recomendada: Estratégia 1 + 2 (Combinada)

### Parte 1: Atualizar Frontend (ResumoDaProducao.tsx)

Remover os listeners de:
- `contagem_porcionados`
- `estoques_ideais_semanais`
- `itens_reserva_diaria`

Manter apenas o listener de `producao_registros`, que é a tabela final que o Kanban exibe.

**Mudança no código:**

| Ação | Detalhe |
|------|---------|
| Remover | `contagemChannel` (contagem_porcionados) |
| Remover | `estoqueIdealChannel` (estoques_ideais_semanais) |
| Remover | `reservaDiariaChannel` (itens_reserva_diaria) |
| Manter | `producaoChannel` (producao_registros) - único listener |
| Remover | Console logs de debug que geram ruído |

### Parte 2: Migração SQL (Otimização de Trigger)

Atualizar `trigger_recalcular_producao_apos_estoque_ideal` para verificar se o valor mudou antes de fazer UPDATE:

```sql
-- Só atualizar se o valor for diferente
UPDATE contagem_porcionados cp
SET ideal_amanha = v_novo_ideal
WHERE cp.item_porcionado_id = NEW.item_porcionado_id
  AND cp.loja_id = NEW.loja_id
  AND cp.dia_operacional = CURRENT_DATE
  AND cp.organization_id = NEW.organization_id
  AND COALESCE(cp.ideal_amanha, 0) != v_novo_ideal; -- Só se mudou
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/ResumoDaProducao.tsx` | Remover listeners redundantes |
| Nova migração SQL | Otimizar trigger para evitar UPDATEs desnecessários |

---

## Resultado Esperado

- Eliminar loop infinito de atualizações
- Reduzir carga no servidor e no cliente
- Manter reatividade: mudanças nas contagens ainda criam/atualizam cards via triggers
- Interface responde apenas quando há mudanças reais nos cards de produção

