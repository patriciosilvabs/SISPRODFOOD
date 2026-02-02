
# Plano: Corrigir Query Keys de Invalidação

## Problema Identificado

As mutations do hook `useCardapioWebIntegracao` estão invalidando a query key **errada**, causando a falha no recarregamento da lista após criar/atualizar integrações.

| Mutation | Query Key Invalidada | Query Key Correta |
|----------|---------------------|-------------------|
| `createIntegracao` | `cardapio-web-integracao` | `cardapio-web-integracoes` |
| `updateIntegracaoStatus` | `cardapio-web-integracao` | `cardapio-web-integracoes` |
| `regenerateToken` | `cardapio-web-integracao` | `cardapio-web-integracoes` |

## Por que isso acontece?

1. Usuário clica em "Configurar Integração" em uma loja
2. A mutation `createIntegracao` insere o registro no banco
3. Toast "Integração configurada com sucesso!" aparece
4. `invalidateQueries({ queryKey: ['cardapio-web-integracao'] })` é chamado (SINGULAR)
5. A query real usa `['cardapio-web-integracoes']` (PLURAL)
6. Como as keys não correspondem, os dados **NÃO são recarregados**
7. O card da loja permanece no estado "Não configurada" mesmo após a criação

## Solução

Corrigir as 3 mutations para usar a query key correta `cardapio-web-integracoes`:

### Arquivo: `src/hooks/useCardapioWebIntegracao.ts`

**Linha 248** - createIntegracao:
```typescript
// ANTES
queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracao'] });

// DEPOIS
queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracoes'] });
```

**Linha 268** - updateIntegracaoStatus:
```typescript
// ANTES
queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracao'] });

// DEPOIS
queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracoes'] });
```

**Linha 294** - regenerateToken:
```typescript
// ANTES
queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracao'] });

// DEPOIS
queryClient.invalidateQueries({ queryKey: ['cardapio-web-integracoes'] });
```

## Resultado Esperado

Após a correção:
1. Usuário configura integração para "UNIDADE ALEIXO"
2. Card atualiza mostrando URL, Token e API Key
3. Usuário configura integração para outra loja
4. **Card também atualiza corretamente** mostrando todos os campos

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCardapioWebIntegracao.ts` | Corrigir 3 query keys de `cardapio-web-integracao` para `cardapio-web-integracoes` |
