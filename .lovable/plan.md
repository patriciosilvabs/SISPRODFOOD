
# Plano: Forçar Re-deploy da Edge Function cardapio-web-webhook

## Diagnóstico Confirmado

A análise revelou que:

1. **O código fonte está correto** - O arquivo `supabase/functions/cardapio-web-webhook/index.ts` tem `.limit(10000)` nas linhas 497 e 521

2. **O deploy NÃO foi aplicado** - Os logs ainda mostram `802 produtos distintos, 1000 registros totais`

3. **O mapeamento da MUSSARELA existe e está ativo** - ID `badb0a8c-4796-488a-a263-5fab66496684` com `ativo: true` e `item_porcionado_id` preenchido

4. **A versão 87 está rodando mas com código antigo** - O deploy da correção `.limit(10000)` não foi efetivado

### Logs que comprovam o bug:
```
📊 Mapeamentos carregados: 802 produtos distintos, 1000 registros totais
[option] ✅ Atualizou contagem para MILHO VERDE (G) (MASSA)
[option] Mapeamento para item 3543853 não tem item_porcionado_id configurado (NULL)
← MUSSARELA NUNCA É MENCIONADA (está no registro 1052+)
```

## Solução

Forçar um novo deploy da edge function `cardapio-web-webhook`. O código já está correto, precisamos apenas garantir que a versão deployada corresponda ao código fonte.

### Passos:

1. **Fazer um deploy manual** da edge function `cardapio-web-webhook`

2. **Verificar nos logs** se agora mostra mais de 1000 registros

3. **Testar** com um novo pedido de MILHO VERDE (G) e confirmar que tanto MASSA quanto MUSSARELA são decrementados

## Resultado Esperado

Após o deploy correto:

| Item | Antes | Depois |
|------|-------|--------|
| Registros carregados | 1000 | 1264+ |
| MASSA decrementada | ✅ | ✅ |
| MUSSARELA decrementada | ❌ | ✅ |

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/cardapio-web-webhook/index.ts` | Re-deploy (código já correto) |
