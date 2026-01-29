

# Plano: Corrigir Exclusão de Lojas (FK sem CASCADE)

## Problema Identificado

Ao tentar excluir uma loja, o banco de dados retorna **409 Conflict** devido à violação de foreign key:

```
update or delete on table "lojas" violates foreign key constraint 
"contagem_porcionados_audit_loja_id_fkey" on table "contagem_porcionados_audit"
```

A tabela `contagem_porcionados_audit` tem uma FK para `lojas` **sem** `ON DELETE CASCADE`, diferente de todas as outras tabelas que referenciam `lojas`.

## Dados do Problema

- **Loja tentando excluir**: `2e8a2ad8-8e42-4647-939c-4b52ac67e6f0`
- **Registros de auditoria bloqueando**: 184 registros
- **Causa**: FK criada sem `ON DELETE CASCADE`

## Solução Proposta

### Migração SQL

Alterar a constraint da tabela `contagem_porcionados_audit` para incluir `ON DELETE CASCADE`:

```sql
-- 1. Remover a constraint atual (sem CASCADE)
ALTER TABLE public.contagem_porcionados_audit
DROP CONSTRAINT contagem_porcionados_audit_loja_id_fkey;

-- 2. Recriar com ON DELETE CASCADE
ALTER TABLE public.contagem_porcionados_audit
ADD CONSTRAINT contagem_porcionados_audit_loja_id_fkey
FOREIGN KEY (loja_id) REFERENCES public.lojas(id) ON DELETE CASCADE;
```

Esta é a abordagem padrão do projeto - todas as outras 14 tabelas que referenciam `lojas` já usam `ON DELETE CASCADE`:

| Tabela | Status |
|--------|--------|
| contagem_porcionados | ✅ CASCADE |
| destinatarios_email_contagem | ✅ CASCADE |
| erros_devolucoes | ✅ CASCADE |
| estoque_loja_itens | ✅ CASCADE |
| estoque_loja_produtos | ✅ CASCADE |
| estoques_ideais_semanais | ✅ CASCADE |
| incrementos_producao | ✅ CASCADE |
| lojas_acesso | ✅ CASCADE |
| produtos_estoque_minimo_semanal | ✅ CASCADE |
| romaneios | ✅ CASCADE |
| romaneios_avulsos (2 FKs) | ✅ CASCADE |
| romaneios_produtos | ✅ CASCADE |
| solicitacoes_reposicao | ✅ CASCADE |
| **contagem_porcionados_audit** | ❌ **SEM CASCADE** |

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Nova migração SQL | Recriar FK com `ON DELETE CASCADE` |

## Resultado Esperado

- Exclusão de lojas funcionará sem erro 409
- Registros de auditoria serão excluídos junto com a loja (comportamento consistente com política de hard-delete do projeto)
- Nenhuma alteração necessária no código frontend (já deleta corretamente)

## Alternativa Considerada (Rejeitada)

Poderia adicionar a exclusão manual de `contagem_porcionados_audit` no frontend antes de deletar a loja. Porém, isso:
- Seria inconsistente com o padrão do projeto (todas as outras tabelas usam CASCADE)
- Aumentaria complexidade do código
- Poderia falhar em cenários de race condition

A migração SQL é a solução correta e definitiva.

