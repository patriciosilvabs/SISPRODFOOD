
# Plano: Resolver Conflito de Sobrecarga de Função RPC

## Problema Identificado

O erro `function criar_ou_atualizar_producao_registro(uuid, uuid, unknown, unknown) is not unique` ocorre porque existem **4 versões** da mesma função no banco de dados:

| Versão | Argumentos | Uso |
|--------|------------|-----|
| 1 | (nenhum) | Trigger de contagem |
| 2 | 8 parâmetros | Não utilizada |
| 3 | `(p_item_id, p_organization_id, p_usuario_id, p_usuario_nome)` | Frontend (ContagemPorcionados, SolicitarProducaoExtra) |
| 4 | `(p_organization_id, p_item_id, p_data_producao, p_demanda_total)` | Não utilizada |

### Causa do Erro

As triggers `trigger_recalcular_producao_apos_estoque_ideal` e `trigger_recalcular_producao_apos_reserva_diaria` chamam:

```sql
PERFORM criar_ou_atualizar_producao_registro(
    NEW.item_porcionado_id,  -- UUID
    NEW.organization_id,      -- UUID  
    NULL,                     -- AMBÍGUO
    'Sistema - Estoque...'    -- TEXT
);
```

O PostgreSQL não consegue decidir entre a versão 3 e 4 porque `NULL` pode ser interpretado como `uuid` ou `date`.

---

## Solução Proposta

### 1. Remover versões duplicadas não utilizadas

Manter apenas:
- **Versão trigger** (sem parâmetros)
- **Versão 3** (item_id, org_id, usuario_id, usuario_nome) - usada pelo frontend

Remover:
- Versão 2 (8 parâmetros)
- Versão 4 (org_id, item_id, data, demanda)

### 2. Atualizar as triggers para usar cast explícito

Modificar as funções de trigger para usar cast explícito ao chamar a RPC:

```sql
PERFORM criar_ou_atualizar_producao_registro(
    NEW.item_porcionado_id,
    NEW.organization_id,
    NULL::uuid,  -- Cast explícito
    'Sistema - Estoque Ideal Atualizado'
);
```

---

## Migração SQL

```sql
-- 1. Remover versões duplicadas da função
DROP FUNCTION IF EXISTS criar_ou_atualizar_producao_registro(
    uuid, uuid, text, uuid, text, date, integer, integer
);

DROP FUNCTION IF EXISTS criar_ou_atualizar_producao_registro(
    uuid, uuid, date, integer
);

-- 2. Atualizar triggers para usar cast explícito
CREATE OR REPLACE FUNCTION trigger_recalcular_producao_apos_estoque_ideal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE contagem_porcionados cp
    SET ideal_amanha = (
        SELECT CASE EXTRACT(DOW FROM CURRENT_DATE)
            WHEN 0 THEN COALESCE(eis.domingo, 0)
            WHEN 1 THEN COALESCE(eis.segunda, 0)
            WHEN 2 THEN COALESCE(eis.terca, 0)
            WHEN 3 THEN COALESCE(eis.quarta, 0)
            WHEN 4 THEN COALESCE(eis.quinta, 0)
            WHEN 5 THEN COALESCE(eis.sexta, 0)
            WHEN 6 THEN COALESCE(eis.sabado, 0)
        END
        FROM estoques_ideais_semanais eis
        WHERE eis.item_porcionado_id = cp.item_porcionado_id
          AND eis.loja_id = cp.loja_id
    )
    WHERE cp.item_porcionado_id = NEW.item_porcionado_id
      AND cp.loja_id = NEW.loja_id
      AND cp.dia_operacional = CURRENT_DATE
      AND cp.organization_id = NEW.organization_id;

    -- Cast explícito para resolver ambiguidade
    PERFORM criar_ou_atualizar_producao_registro(
        NEW.item_porcionado_id,
        NEW.organization_id,
        NULL::uuid,
        'Sistema - Estoque Ideal Atualizado'::text
    );
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_recalcular_producao_apos_reserva_diaria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Cast explícito para resolver ambiguidade
    PERFORM criar_ou_atualizar_producao_registro(
        NEW.item_porcionado_id,
        NEW.organization_id,
        NULL::uuid,
        'Sistema - Reserva Diária Atualizada'::text
    );
    
    RETURN NEW;
END;
$$;
```

---

## Resultado Esperado

Após a migração:
1. Apenas 2 versões da função existirão (trigger e 4 parâmetros)
2. As triggers funcionarão sem erro de ambiguidade
3. Salvar estoques ideais semanais funcionará normalmente

---

## Detalhes Técnicos

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Remove funções duplicadas e atualiza triggers com cast explícito |
