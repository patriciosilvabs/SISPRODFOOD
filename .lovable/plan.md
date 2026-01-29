
# Plano: Corrigir Exclusão de Itens Porcionados

## Problema Identificado

Ao tentar excluir o item `f4002717-6808-4da8-8401-25041fd49279`, o sistema retorna:

```
Foreign key constraint violation:
Key is still referenced from table "contagem_porcionados_audit"
```

### Causa Raiz

1. **Tabelas faltando na cascata**: A função `handleDelete` atual só deleta de **6 tabelas**, mas existem **16 tabelas** que referenciam `itens_porcionados`

2. **Bloqueio de RLS**: A tabela `contagem_porcionados_audit` não permite DELETE por políticas RLS - apenas INSERT e SELECT

### Tabelas que referenciam `itens_porcionados`:

| Tabela | Status Atual | Coluna |
|--------|--------------|--------|
| insumos_extras | ✅ Tratada | item_porcionado_id |
| estoque_cpd | ✅ Tratada | item_porcionado_id |
| itens_reserva_diaria | ✅ Tratada | item_porcionado_id |
| estoques_ideais_semanais | ✅ Tratada | item_porcionado_id |
| estoque_loja_itens | ✅ Tratada | item_porcionado_id |
| contagem_porcionados | ✅ Tratada | item_porcionado_id |
| **contagem_porcionados_audit** | ❌ **Faltando** | item_porcionado_id |
| producao_lotes | ❌ Faltando | item_id |
| producao_registros | ❌ Faltando | item_id |
| romaneio_itens | ❌ Faltando | item_porcionado_id |
| romaneios_avulsos_itens | ❌ Faltando | item_porcionado_id |
| consumo_historico | ❌ Faltando | item_id |
| perdas_producao | ❌ Faltando | item_id |
| producao_massa_historico | ❌ Faltando | item_id |
| incrementos_producao | ❌ Faltando | item_porcionado_id |
| backlog_producao | ❌ Faltando | item_id |

---

## Solução

Criar uma **Edge Function** `excluir-item-porcionado` usando `service_role` para bypass de RLS, seguindo o padrão já estabelecido para `excluir-usuario`.

### Vantagens desta abordagem:
- Contorna restrições de RLS
- Centraliza lógica de cascata
- Consistente com política de hard-delete existente
- Transação atômica (tudo ou nada)

---

## Implementação

### 1. Criar Edge Function `excluir-item-porcionado`

A função irá:
1. Validar autenticação e permissão Admin
2. Deletar em ordem reversa de dependências (tabelas filhas primeiro)
3. Finalmente deletar o item principal

**Ordem de exclusão:**
```text
1. contagem_porcionados_audit
2. perdas_producao
3. consumo_historico
4. producao_massa_historico
5. romaneio_itens
6. romaneios_avulsos_itens
7. producao_registros
8. producao_lotes
9. incrementos_producao
10. backlog_producao
11. contagem_porcionados
12. estoque_loja_itens
13. estoques_ideais_semanais
14. itens_reserva_diaria
15. estoque_cpd
16. insumos_extras
17. itens_porcionados (item principal)
```

### 2. Atualizar `ItensPorcionados.tsx`

Substituir chamadas diretas ao Supabase por chamada à Edge Function:

```typescript
const handleDelete = async (id: string) => {
  // ... validações existentes ...
  
  const { error } = await supabase.functions.invoke('excluir-item-porcionado', {
    body: { item_id: id }
  });
  
  if (error) throw error;
  toast.success('Item excluído permanentemente!');
};
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/excluir-item-porcionado/index.ts` | Criar |
| `src/pages/ItensPorcionados.tsx` | Modificar handleDelete |

---

## Resumo

Esta correção garante exclusão completa e permanente de itens porcionados, deletando todos os dados relacionados em 16 tabelas, respeitando a política de hard-delete estabelecida para o sistema.
