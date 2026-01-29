

# Plano: Corrigir Trigger para Permitir Limpeza das Contagens

## Problema Identificado

Ao clicar em "Limpar Produção", o UPDATE para zerar `ideal_amanha` falha com o erro:

```
"record \"old\" has no field \"estoque_inicial\""
```

### Causa Raiz

O trigger `trigger_criar_producao_apos_contagem` contém uma referência à coluna `estoque_inicial` que **não existe mais** na tabela `contagem_porcionados`:

```sql
-- Linha problemática no trigger
IF (OLD.ideal_amanha IS DISTINCT FROM NEW.ideal_amanha) OR
   (OLD.estoque_inicial IS DISTINCT FROM NEW.estoque_inicial) THEN  -- ❌ Coluna não existe!
```

### Estrutura Atual da Tabela

A tabela `contagem_porcionados` possui estas colunas:
- `id`, `loja_id`, `item_porcionado_id`
- `final_sobra`, `peso_total_g`, `ideal_amanha`, `a_produzir`
- `usuario_id`, `usuario_nome`, `organization_id`
- `preenchido_na_sessao`, `dia_operacional`
- `created_at`, `updated_at`

**Nota:** A coluna `estoque_inicial` foi removida em alguma migração anterior.

## Solução

Atualizar a função do trigger removendo a referência à coluna inexistente `estoque_inicial`.

## Alteração Necessária

### Migração SQL

```sql
-- Atualizar função do trigger removendo referência a estoque_inicial
CREATE OR REPLACE FUNCTION trigger_criar_producao_apos_contagem()
RETURNS TRIGGER AS $$
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
    IF TG_OP = 'UPDATE' THEN
        -- Só recalcular se ideal_amanha mudou (loja atualizou estoque ideal)
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

## Fluxo Corrigido

```text
Antes:
Limpar Produção → UPDATE ideal_amanha = 0 → TRIGGER dispara → 
→ Acessa OLD.estoque_inicial → ❌ ERRO: campo não existe

Depois:
Limpar Produção → UPDATE ideal_amanha = 0 → TRIGGER dispara → 
→ Verifica apenas ideal_amanha → ✅ Funciona → Contagens zeradas
```

## Resultado Esperado

| Ação | Antes | Depois |
|------|-------|--------|
| Clicar "Limpar Produção" | Erro no trigger, contagens mantidas | Contagens zeradas com sucesso |
| Cards do painel de status | Continuam aparecendo | Desaparecem (a_produzir = 0) |
| Próxima contagem | Funciona | Funciona normalmente |

## Arquivos a Modificar

| Tipo | Descrição |
|------|-----------|
| Migração SQL | Atualizar função `trigger_criar_producao_apos_contagem` |

Esta é uma correção de banco de dados que não requer alterações no código frontend.

