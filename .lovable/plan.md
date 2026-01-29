
# Plano: Corrigir Erro de `usuario_id` NULL nos Registros de Produção

## Problema Identificado

O erro `null value in column "usuario_id" of relation "producao_registros" violates not-null constraint` ocorre porque:

1. As triggers `trigger_recalcular_producao_apos_estoque_ideal` e `trigger_recalcular_producao_apos_reserva_diaria` chamam a função RPC com `NULL::uuid` como `p_usuario_id`
2. A função `criar_ou_atualizar_producao_registro` usa esse valor diretamente no INSERT sem nenhum tratamento de fallback
3. A coluna `usuario_id` da tabela `producao_registros` tem constraint `NOT NULL`

```text
┌─────────────────────┐     ┌──────────────────────────────────┐
│  Trigger Estoque    │────▶│ criar_ou_atualizar_producao_...  │
│  (NULL::uuid)       │     │ INSERT usuario_id = NULL ❌       │
└─────────────────────┘     └──────────────────────────────────┘
```

---

## Solução Proposta

Atualizar a função `criar_ou_atualizar_producao_registro` para usar um UUID de sistema como fallback quando `p_usuario_id` for NULL:

```sql
-- No início da função, definir fallback
v_usuario_id uuid := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000');
v_usuario_nome_final text := COALESCE(p_usuario_nome, 'Sistema');

-- No INSERT, usar as variáveis com fallback
usuario_id = v_usuario_id,
usuario_nome = v_usuario_nome_final
```

---

## Migração SQL

```sql
CREATE OR REPLACE FUNCTION public.criar_ou_atualizar_producao_registro(
    p_item_id uuid,
    p_organization_id uuid,
    p_usuario_id uuid,
    p_usuario_nome text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    -- Fallback para usuário sistema quando NULL
    v_usuario_id uuid := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000');
    v_usuario_nome_final text := COALESCE(p_usuario_nome, 'Sistema');
    -- ... demais variáveis ...
BEGIN
    -- ... lógica existente ...
    
    INSERT INTO producao_registros (
        -- ...
        usuario_id,
        usuario_nome,
        -- ...
    ) VALUES (
        -- ...
        v_usuario_id,       -- Usar variável com fallback
        v_usuario_nome_final, -- Usar variável com fallback
        -- ...
    );
    
    -- ... resto da lógica ...
END;
$$;
```

---

## Resultado Esperado

| Cenário | Comportamento |
|---------|---------------|
| Chamada do Frontend (usuário logado) | `usuario_id` = ID do usuário real |
| Chamada de Trigger (sistema) | `usuario_id` = `00000000-0000-0000-0000-000000000000` (Sistema) |

Após a migração:
1. Salvar estoques ideais semanais funcionará sem erro
2. Os registros criados por triggers terão `usuario_nome = 'Sistema'`
3. Registros criados pelo frontend manterão o usuário real

---

## Detalhes Técnicos

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Atualiza a função RPC para tratar `NULL` em `usuario_id` e `usuario_nome` usando COALESCE com valores padrão |
