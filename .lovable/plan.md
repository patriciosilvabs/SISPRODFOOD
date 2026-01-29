

# Plano: Corrigir Erro de Foreign Key para Usuário Sistema

## Problema Identificado

O erro `Key (usuario_id)=(00000000-0000-0000-0000-000000000000) is not present in table "profiles"` ocorre porque:

1. A correção anterior implementou um UUID de sistema como fallback (`00000000-0000-0000-0000-000000000000`)
2. Existe uma constraint de foreign key (`producao_registros_usuario_id_fkey`) que exige que o `usuario_id` exista na tabela `profiles`
3. O UUID de sistema não existe na tabela `profiles`

```text
┌─────────────────────────────┐     ┌──────────────────────────────────┐
│  Trigger com fallback       │────▶│ INSERT usuario_id = 00000...000  │
│  (UUID Sistema)             │     │ FK constraint → profiles ❌       │
└─────────────────────────────┘     └──────────────────────────────────┘
```

---

## Solução Proposta

Criar um perfil de sistema na tabela `profiles` com o UUID reservado, permitindo que registros automáticos (triggers) usem esse usuário.

### Migração SQL

```sql
-- Criar perfil de sistema para suportar registros automáticos
INSERT INTO profiles (id, nome, email)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Sistema',
    'sistema@interno.local'
)
ON CONFLICT (id) DO NOTHING;
```

---

## Alternativas Consideradas

| Opção | Vantagem | Desvantagem |
|-------|----------|-------------|
| **Criar perfil sistema** ✅ | Simples, mantém integridade referencial | Perfil "fantasma" na tabela |
| Remover FK constraint | Permite qualquer UUID | Perde integridade referencial |
| Tornar `usuario_id` nullable | Mais flexível | Quebra código existente, mudança maior |

A opção de criar um perfil de sistema é a mais simples e segura.

---

## Resultado Esperado

| Cenário | Comportamento |
|---------|---------------|
| Chamada do Frontend (usuário logado) | `usuario_id` = ID do usuário real |
| Chamada de Trigger (sistema) | `usuario_id` = `00000000-0000-0000-0000-000000000000` (Sistema) |

Após a migração:
1. Salvar estoques ideais semanais funcionará sem erro
2. Os registros criados por triggers terão `usuario_nome = 'Sistema'`
3. O perfil de sistema será identificável pelo email `sistema@interno.local`

---

## Detalhes Técnicos

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Insere perfil de sistema na tabela `profiles` |

