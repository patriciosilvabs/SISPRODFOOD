

# Plano: Verificar e Corrigir Interface de Mapeamento

## Status Atual

| Componente | Status |
|------------|--------|
| Webhook | ✅ Funcionando |
| API CardápioWeb | ✅ Funcionando (Produção + X-API-KEY) |
| Fallback de ambiente | ✅ Implementado |
| Coluna na contagem | ✅ Código existe |
| **Mapeamentos** | ❌ **305 itens sem vínculo** |

## O Problema Real

Os logs mostram claramente:
```
"Mapeamento para item 2791009 não tem item_porcionado_id configurado"
```

Dos 305+ itens importados do CardápioWeb, **apenas 1** tem vínculo configurado:
- "CALABRESA (G)" → vinculado ao item `5071a067-...`

Todos os outros itens como "Calabresa (Grande)", "Combo: Calabresa + Refri", etc. estão com `item_porcionado_id = null`.

## Solução

### Passo 1: Você precisa configurar os vínculos

1. Acesse a aba **Mapeamento** na tela de integração do Cardápio Web
2. Para cada produto que deseja rastrear estoque:
   - Clique no item do cardápio
   - Selecione o **item porcionado do sistema** correspondente
   - Defina a **quantidade consumida** (ex: 1 pizza = 1 bolinha)
3. Salve o vínculo

### Passo 2: Verificar Interface de Mapeamento (técnico)

Vou verificar se a interface de mapeamento permite fazer esse vínculo de forma adequada. Se não permitir ou tiver problemas, farei os ajustes necessários.

## Arquivos a Verificar

1. `src/pages/ConfigurarCardapioWeb.tsx` - Página principal de configuração
2. Componentes de mapeamento relacionados
3. Modal de vínculo de itens

## Resultado Esperado

Após configurar os vínculos:
1. Uma venda no CardápioWeb vai baixar automaticamente o estoque
2. A coluna "Cardápio Web" vai aparecer mostrando: `-1 às 14:30` e `Total: -5 un hoje`
3. O `final_sobra` será decrementado automaticamente

