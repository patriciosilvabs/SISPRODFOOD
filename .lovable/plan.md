
# Plano: Corrigir Cálculo de Estoque CPD na Função de Trigger

## Problema Identificado

As demandas da loja **UNIDADE ALEIXO** não estão gerando cards de produção no Resumo da Produção.

### Análise de Dados

| Item | Demanda Aleixo | Estoque CPD Real | Estoque CPD Usado | Saldo Líquido | Resultado |
|------|----------------|------------------|-------------------|---------------|-----------|
| MUSSARELA | 99 | 2 | **2838** (erro!) | -2739 | ❌ Não cria card |
| MASSA | 99 | 100 | **3341** (erro!) | -3242 | ❌ Não cria card |

### Causa Raiz

Existem **3 versões** da função `criar_ou_atualizar_producao_registro`:
1. **Versão trigger** (sem parâmetros) - não usada
2. **Versão TABLE** - já corrigida para usar `contagem_porcionados.final_sobra`
3. **Versão UUID** - **ainda usa tabela `estoque_cpd` desatualizada**

O trigger `trg_criar_producao_apos_contagem` chama a **versão UUID**, que busca estoque na tabela errada:

```sql
-- CÓDIGO ATUAL (ERRADO):
SELECT COALESCE(quantidade, 0)::integer
INTO v_estoque_cpd
FROM estoque_cpd  -- ← Tabela desatualizada com valores 1000x maiores!
WHERE item_porcionado_id = p_item_id;
```

---

## Solução

Atualizar a função `criar_ou_atualizar_producao_registro` (versão UUID) para buscar o estoque CPD da fonte correta: `contagem_porcionados.final_sobra` do dia atual.

### Alteração Necessária

**De:**
```sql
-- Buscar estoque CPD atual
SELECT COALESCE(quantidade, 0)::integer
INTO v_estoque_cpd
FROM estoque_cpd
WHERE item_porcionado_id = p_item_id
  AND organization_id = p_organization_id;
```

**Para:**
```sql
-- CORREÇÃO: Buscar estoque CPD da contagem_porcionados (fonte real)
SELECT COALESCE(cp.final_sobra, 0)::integer
INTO v_estoque_cpd
FROM contagem_porcionados cp
JOIN lojas l ON l.id = cp.loja_id
WHERE cp.item_porcionado_id = p_item_id
  AND cp.organization_id = p_organization_id
  AND cp.dia_operacional = v_data_hoje
  AND l.tipo = 'cpd';

v_estoque_cpd := COALESCE(v_estoque_cpd, 0);
```

---

## Implementação

Uma migração SQL será criada para atualizar a função RPC, corrigindo a fonte de estoque CPD de `estoque_cpd` para `contagem_porcionados.final_sobra`.

### Resultado Esperado

Após a correção:

| Item | Demanda | Estoque Real | Saldo Líquido | Gatilho | Resultado |
|------|---------|--------------|---------------|---------|-----------|
| MUSSARELA | 99 | 2 | **97** | 25 | ✅ Cria 97 cards |
| MASSA | 99 | 100 | **-1** | 25 | ✅ Não precisa (correto) |

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Nova migração SQL | Atualizar função `criar_ou_atualizar_producao_registro` |

---

## Resumo

A correção alinha a versão UUID da função (usada pelo trigger) com a versão TABLE (já corrigida), garantindo que ambas usem a fonte de estoque real do CPD. Isso fará com que as demandas do Aleixo e outras lojas gerem cards de produção corretamente quando o estoque do CPD for insuficiente.
