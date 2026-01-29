
# Plano: Evitar Loop do Romaneio no Trigger de Produção

## Problema Identificado

Quando o romaneio envia itens, ele debita o estoque do CPD atualizando `contagem_porcionados.final_sobra`. Isso dispara o trigger `trg_criar_producao_apos_contagem` que recalcula toda a produção, causando um loop infinito:

```
Romaneio enviado
    │
    ├─► UPDATE contagem_porcionados SET final_sobra = X
    │
    └─► Trigger dispara criar_ou_atualizar_producao_registro()
              │
              ├─► Deleta/cria cards de produção
              │
              └─► Listener realtime atualiza tela
                        │
                        └─► Loop visual + possível re-trigger
```

## Causa Raiz

O trigger atual dispara em **qualquer** INSERT ou UPDATE:

```sql
CREATE TRIGGER trg_criar_producao_apos_contagem
AFTER INSERT OR UPDATE ON contagem_porcionados
FOR EACH ROW
EXECUTE FUNCTION trigger_criar_producao_apos_contagem();
```

Mas o romaneio só atualiza `final_sobra` e `updated_at` - ele NÃO deveria disparar recálculo de produção porque:
- O estoque CPD diminuiu, mas isso não afeta a DEMANDA das lojas
- A demanda é calculada pelo campo `a_produzir`, que é gerado a partir de `ideal_amanha - final_sobra`
- O trigger serve para quando a LOJA envia sua contagem (alterando `ideal_amanha`)

## Solução

Modificar a **função do trigger** para verificar se a mudança é relevante antes de recalcular a produção.

### Lógica de Bypass

Apenas recalcular produção se:
1. É um INSERT (nova contagem), OU
2. É um UPDATE que alterou campos relevantes (`ideal_amanha`, `a_produzir`)

NÃO recalcular se:
- Apenas `final_sobra` ou `updated_at` mudaram (típico de romaneio ou finalização de produção)

## Migração SQL

```sql
-- Atualizar função do trigger para ignorar updates irrelevantes
CREATE OR REPLACE FUNCTION trigger_criar_producao_apos_contagem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Para INSERTs, sempre recalcular
    IF TG_OP = 'INSERT' THEN
        PERFORM criar_ou_atualizar_producao_registro(
            NEW.item_porcionado_id,
            NEW.organization_id,
            NEW.usuario_id,
            NEW.usuario_nome
        );
        RETURN NEW;
    END IF;
    
    -- Para UPDATEs, verificar se campos relevantes mudaram
    -- Ignorar se apenas final_sobra ou updated_at mudou (típico de romaneio/produção)
    IF TG_OP = 'UPDATE' THEN
        -- Só recalcular se ideal_amanha mudou (loja atualizou estoque ideal)
        -- ou se a_produzir mudou diretamente
        IF (OLD.ideal_amanha IS DISTINCT FROM NEW.ideal_amanha) OR
           (OLD.estoque_inicial IS DISTINCT FROM NEW.estoque_inicial) THEN
            PERFORM criar_ou_atualizar_producao_registro(
                NEW.item_porcionado_id,
                NEW.organization_id,
                NEW.usuario_id,
                NEW.usuario_nome
            );
        END IF;
        -- Se apenas final_sobra mudou, NÃO recalcular
        -- (romaneio debitando estoque ou produção creditando)
    END IF;
    
    RETURN NEW;
END;
$$;
```

## Fluxo Corrigido

### Romaneio (SEM trigger)
```
Romaneio enviado
    │
    └─► UPDATE contagem_porcionados SET final_sobra = X
              │
              └─► Trigger verifica: apenas final_sobra mudou?
                        │
                        └─► SIM → Ignora (não recalcula produção)
```

### Contagem de Loja (COM trigger)
```
Loja salva contagem
    │
    └─► UPDATE contagem_porcionados SET ideal_amanha = Y, final_sobra = Z
              │
              └─► Trigger verifica: ideal_amanha mudou?
                        │
                        └─► SIM → Recalcula produção
```

## Alterações

| Tipo | Descrição |
|------|-----------|
| Migração SQL | Atualizar `trigger_criar_producao_apos_contagem` com lógica condicional |

## Impacto

| Cenário | Antes | Depois |
|---------|-------|--------|
| Romaneio debita CPD | Dispara recálculo de produção | **Ignora** (sem loop) |
| Loja salva contagem | Recalcula produção | Recalcula produção (mantém) |
| Produção credita CPD | Dispara recálculo | **Ignora** (correto) |
| Reserva diária atualizada | Recalcula via outro trigger | Mantém (outro trigger) |

## Testes Recomendados

1. Enviar romaneio → Verificar que Resumo da Produção NÃO pisca/atualiza
2. Salvar contagem de loja → Verificar que cards de produção são recalculados normalmente
3. Finalizar produção → Verificar que estoque CPD aumenta SEM loop
