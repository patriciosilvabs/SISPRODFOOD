

# Plano: Forçar Deploy com Modificação de Código

## Diagnóstico Final

Após investigação detalhada, confirmei que:

1. **O código fonte está correto** com `.limit(10000)` nas linhas 497 e 521
2. **Os mapeamentos estão corretos** - MILHO VERDE tem 3 mapeamentos (MASSA na posição 126, MUSSARELA na posição 266, NULL na posição 910)
3. **Todos estão dentro do limite de 1000** - o problema NÃO é o limite em si
4. **O deploy NÃO está sendo aplicado** - logs ainda mostram "1000 registros totais"

### Evidência nos Logs:
```
📊 Mapeamentos carregados: 761 produtos distintos, 1000 registros totais
[option] ✅ Atualizou contagem para MILHO VERDE (G)  ← SÓ MASSA
[option] Mapeamento para item 3543853 não tem item_porcionado_id configurado  ← SÓ NULL
← MUSSARELA NUNCA PROCESSADA!
```

O problema: mesmo que os 3 mapeamentos estejam dentro do limite de 1000, a versão deployada antiga não está carregando corretamente.

## Solução

Fazer uma modificação cosmética no código para forçar um novo deploy e garantir que a versão correta seja aplicada.

## Modificação

Adicionar um log de versão para rastrear qual versão está rodando:

```typescript
// Linha ~513 - após o log atual
console.log(`📊 Mapeamentos carregados: ${mapeamentoMap.size} produtos distintos, ${mapeamentos?.length || 0} registros totais`)
console.log(`🔧 Versão do webhook: v2.1 - limit(10000) aplicado`)  // NOVO LOG
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/cardapio-web-webhook/index.ts` | Adicionar log de versão para forçar deploy |

## Resultado Esperado

Após o deploy:

1. Logs mostrarão `🔧 Versão do webhook: v2.1`
2. Registros totais devem ser 1145 (não 1000)
3. MILHO VERDE processará MASSA + MUSSARELA + pular NULL

| Item | Antes | Depois |
|------|-------|--------|
| Versão | Antiga (sem log) | v2.1 |
| Registros | 1000 | 1145+ |
| MASSA | ✅ | ✅ |
| MUSSARELA | ❌ | ✅ |

