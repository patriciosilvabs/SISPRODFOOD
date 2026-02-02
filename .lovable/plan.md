
# Plano: Correção do Loop Infinito de Cards "Estoque CPD Suficiente"

## Diagnóstico do Problema

Quando a produção é finalizada:

1. O sistema credita o estoque no CPD via INSERT/UPDATE em `contagem_porcionados`
2. O trigger `trg_criar_producao_apos_contagem` dispara em **INSERT**
3. O trigger chama `criar_ou_atualizar_producao_registro`
4. A função RPC detecta que o CPD agora tem estoque suficiente para cobrir a demanda
5. **Cria cards `estoque_disponivel`** imediatamente - ERRO!

### Por que está errado?

Os cards "Estoque CPD Suficiente" só devem aparecer quando:
- **A loja informa uma nova demanda** (atualiza `ideal_amanha`)
- **E** o CPD já possui estoque para atender essa demanda

Não devem aparecer quando:
- A produção é finalizada (que credita o CPD)
- Porque isso cria um loop visual e confusão operacional

### Dados Atuais (Comprovando o Loop)

| Item | CPD Estoque | Japiim Demanda | Saldo Líquido | Card Criado |
|------|-------------|----------------|---------------|-------------|
| MASSA | 50 | 50 | 0 | ✅ estoque_disponivel |
| MUSSARELA | 50 | 50 | 0 | ✅ estoque_disponivel |

Os cards verdes aparecem imediatamente após finalização, quando deveriam só aparecer se a loja Japiim atualizasse sua contagem **depois** que o CPD já tivesse estoque.

---

## Solução Proposta

### Opção 1: Ignorar INSERTs do CPD no Trigger (Recomendada)

Modificar o trigger para **não disparar** quando o INSERT/UPDATE for da loja CPD:

```sql
CREATE OR REPLACE FUNCTION trigger_criar_producao_apos_contagem()
RETURNS TRIGGER AS $$
DECLARE
  v_loja_tipo TEXT;
BEGIN
    -- Buscar o tipo da loja
    SELECT tipo INTO v_loja_tipo FROM lojas WHERE id = NEW.loja_id;
    
    -- NUNCA recalcular para INSERT/UPDATE de loja CPD
    -- Isso evita loops quando produção finaliza e credita o estoque
    IF v_loja_tipo = 'cpd' THEN
        RETURN NEW;
    END IF;

    -- Para INSERTs (de lojas normais), sempre recalcular
    IF TG_OP = 'INSERT' THEN
        PERFORM criar_ou_atualizar_producao_registro(
            NEW.item_porcionado_id,
            NEW.organization_id,
            NEW.usuario_id,
            NEW.usuario_nome
        );
        RETURN NEW;
    END IF;
    
    -- Para UPDATEs (de lojas normais), verificar se ideal_amanha mudou
    IF TG_OP = 'UPDATE' THEN
        IF OLD.ideal_amanha IS DISTINCT FROM NEW.ideal_amanha THEN
            PERFORM criar_ou_atualizar_producao_registro(
                NEW.item_porcionado_id,
                NEW.organization_id,
                NEW.usuario_id,
                NEW.usuario_nome
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Benefícios

1. **Produção finaliza → CPD creditado → Nenhum trigger dispara**
2. **Loja informa demanda → Trigger dispara → Se CPD tem estoque, cria card verde**
3. **Fluxo lógico correto**: Primeiro a loja pede, depois o sistema verifica se CPD tem

### Fluxo Correto Após Correção

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (ERRADO)                         │
├─────────────────────────────────────────────────────────────────┤
│  Produção Finaliza                                              │
│         ↓                                                       │
│  INSERT contagem CPD (final_sobra = 50)                         │
│         ↓                                                       │
│  Trigger dispara → RPC recalcula → Card verde aparece ❌        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO CORRIGIDO                              │
├─────────────────────────────────────────────────────────────────┤
│  Produção Finaliza                                              │
│         ↓                                                       │
│  INSERT contagem CPD (final_sobra = 50)                         │
│         ↓                                                       │
│  Trigger detecta loja_tipo='cpd' → IGNORA ✅                    │
│                                                                 │
│  Mais tarde: Loja Japiim atualiza ideal_amanha = 140            │
│         ↓                                                       │
│  Trigger dispara → RPC verifica:                                │
│    - Demanda total = 50                                         │
│    - CPD estoque = 50                                           │
│    - Saldo = 0 → Cria card "Estoque Disponível" ✅              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Limpeza dos Cards Incorretos

Além da correção do trigger, precisamos deletar os cards `estoque_disponivel` criados incorretamente hoje:

```sql
-- Deletar cards de estoque_disponivel criados hoje (loop corrigido)
DELETE FROM producao_registros
WHERE status = 'estoque_disponivel'
  AND data_referencia = CURRENT_DATE;
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | Atualizar função `trigger_criar_producao_apos_contagem` para ignorar loja CPD |
| (Opcional) Query única | Limpar cards `estoque_disponivel` existentes de hoje |

---

## Comportamento Final Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Produção finaliza e credita CPD | Card verde aparece (loop) | Nenhum card criado |
| Loja atualiza ideal_amanha com CPD vazio | Card laranja normal | Card laranja normal |
| Loja atualiza ideal_amanha com CPD cheio | Card verde correto | Card verde correto |

---

## Detalhes Técnicos

### Por que verificar `loja_tipo` no trigger?

- O CPD **nunca informa demanda** (ideal_amanha = 0 sempre)
- INSERTs/UPDATEs no CPD são **operacionais** (finalização de produção, ajustes)
- Não faz sentido recalcular produção baseado em mudanças do próprio CPD

### Impacto na Performance

- Adiciona 1 SELECT simples no trigger (buscar tipo da loja)
- Evita execuções desnecessárias da RPC pesada
- Performance geral **melhora** porque menos recálculos
