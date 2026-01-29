

# Plano: Corrigir Fonte de Estoque CPD na Função de Produção

## Problema Identificado

A função `criar_ou_atualizar_producao_registro` usa a tabela **`estoque_cpd`** para verificar o estoque disponível do CPD, mas essa tabela está desatualizada:

| Item | Estoque em `estoque_cpd` | Estoque Real (contagem CPD) | Diferença |
|------|--------------------------|----------------------------|-----------|
| MASSA - PORCIONADO | 3.341 | 100 | +3.241 |
| MUSSARELA | 2.838 | 2-314 | +2.500+ |
| CALABRESA | 1.933 | 1-208 | +1.700+ |

**Resultado**: O sistema pensa que há milhares de unidades em estoque e não cria cards de produção, quando na realidade o estoque é muito menor.

## Causa Raiz

Existem **duas tabelas** para estoque do CPD que não estão sincronizadas:
- `estoque_cpd` (usada pela função de produção) - valores antigos
- `contagem_porcionados.final_sobra` onde loja é CPD (usada pela tela de ajuste) - valores reais

## Solução

Atualizar a função RPC para buscar o estoque do CPD da mesma fonte que a tela de ajuste usa: `contagem_porcionados.final_sobra` onde a loja é do tipo CPD e o `dia_operacional` é a data atual.

---

## Modificação na Função SQL

**Trecho atual** (busca de `estoque_cpd`):
```sql
SELECT COALESCE(quantidade, 0)::integer
INTO v_estoque_cpd
FROM estoque_cpd
WHERE item_porcionado_id = p_item_id
  AND organization_id = p_organization_id;
```

**Trecho corrigido** (busca de `contagem_porcionados` do CPD):
```sql
SELECT COALESCE(cp.final_sobra, 0)::integer
INTO v_estoque_cpd
FROM contagem_porcionados cp
JOIN lojas l ON l.id = cp.loja_id
WHERE cp.item_porcionado_id = p_item_id
  AND cp.organization_id = p_organization_id
  AND l.tipo = 'cpd'
  AND cp.dia_operacional = v_data_hoje;
```

---

## Impacto

Após a correção:

| Item | Demanda Lojas | Estoque CPD Real | Saldo Líquido | Resultado |
|------|---------------|------------------|---------------|-----------|
| MASSA - PORCIONADO | 660 | 100 | **+560** | Cria card de produção |
| CARNE | 27+ | 40-98 | Depende | Pode criar card |
| FRANGO | 45+ | 54-115 | Depende | Pode criar card |

---

## Arquivos Afetados

1. **Migration SQL**: Atualizar função `criar_ou_atualizar_producao_registro` (versão de 4 parâmetros)

---

## Detalhes Técnicos

A correção envolve:

1. Identificar a loja CPD da organização
2. Buscar o `final_sobra` mais recente do dia operacional atual para cada item
3. Usar esse valor como `v_estoque_cpd` no cálculo do saldo líquido
4. Se não houver contagem do CPD para o dia, assumir estoque 0 (ou fallback para `estoque_cpd`)

