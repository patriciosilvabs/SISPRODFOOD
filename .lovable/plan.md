
# Plano: Corrigir Romaneio - Evitar Loop e Restringir Acesso

## Problemas Identificados

### Problema 1: Romaneio NÃO Deve Movimentar Contagem de Loja Destino

**Situação Atual:**
- O envio de romaneio **debita** do estoque CPD (`contagem_porcionados` do CPD) - linhas 1368-1389
- Isso dispara o trigger `trg_criar_producao_apos_contagem` no banco de dados
- O trigger recalcula demandas e pode criar/deletar cards de produção
- Isso causa um loop: romaneio → debita CPD → trigger → cria cards → listener realtime → atualiza tela

**Solução:**
O débito do estoque CPD via contagem_porcionados ESTÁ correto (é a fonte de verdade do estoque físico). O problema é que esse update dispara um trigger que não deveria ser disparado para updates feitos pelo romaneio.

Opções:
1. **Opção A**: Criar uma flag temporária ou usar uma coluna de "bypass" para indicar que o update veio do romaneio
2. **Opção B**: Modificar o trigger no banco para ignorar updates que apenas alteram `final_sobra`
3. **Opção C** (RECOMENDADA): Remover o listener de `estoque_cpd` e `estoque_loja_itens` do realtime, pois eles causam loops desnecessários

---

### Problema 2: Usuário de Loja Vê Romaneios de Outras Lojas

**Situação Atual:**
O filtro `fetchRomaneiosEnviados` usa `userLojasIds` que contém TODAS as lojas que o usuário tem acesso via `lojas_acesso`. Se um usuário foi vinculado a múltiplas lojas, ele verá romaneios de todas elas.

**Mas o comportamento esperado é:**
Usuário de loja (role "Loja") deve ver APENAS romaneios da SUA loja principal (a loja onde ele trabalha).

**Código Atual (linha 942-944):**
```typescript
if (!isAdmin() && userLojasIds.length > 0) {
  query = query.in('loja_id', userLojasIds);
}
```

**Problema:**
- `userLojasIds` inclui todas as lojas do usuário
- Se usuário tem acesso a "Loja A" e "Loja B", ele vê romaneios de ambas

**Solução:**
Para usuários com role "Loja", filtrar APENAS pela loja principal (`primaryLoja`) e não por todas as lojas.

---

## Alterações Propostas

### Arquivo: `src/pages/Romaneio.tsx`

| Alteração | Descrição |
|-----------|-----------|
| Linha 602-616 | Remover listeners de `estoque_cpd` e `estoque_loja_itens` para evitar loops |
| Linha 942-944 | Modificar filtro para usar `primaryLoja` em vez de `userLojasIds` para role "Loja" |
| Linha 988-990 | Aplicar mesma correção no histórico |

### Mudanças Técnicas

#### 1. Remover Listeners que Causam Loop (linhas 602-616)

```typescript
// ANTES - Causa loops
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'estoque_cpd'
}, (payload) => {
  fetchDemandasTodasLojas();
})
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'estoque_loja_itens'
}, (payload) => {
  fetchDemandasTodasLojas();
})

// DEPOIS - Removidos (produção e romaneios já cobrem as necessidades)
// Apenas manter:
// - producao_registros
// - romaneios
// - romaneio_itens
```

#### 2. Filtrar Romaneios por Loja Principal (linha 942-944)

```typescript
// ANTES
if (!isAdmin() && userLojasIds.length > 0) {
  query = query.in('loja_id', userLojasIds);
}

// DEPOIS
// Para usuário de LOJA, filtrar APENAS pela loja principal
// Para usuário de PRODUÇÃO, mantém o comportamento atual
if (!isAdmin()) {
  if (hasRole('Loja') && primaryLoja) {
    // Loja vê apenas romaneios da SUA loja
    query = query.eq('loja_id', primaryLoja.loja_id);
  } else if (userLojasIds.length > 0) {
    // Produção vê todas as lojas que tem acesso
    query = query.in('loja_id', userLojasIds);
  }
}
```

#### 3. Aplicar Mesma Lógica no Histórico (linha 988-990)

```typescript
// Mesma lógica para fetchRomaneiosHistorico
if (!isAdmin()) {
  if (hasRole('Loja') && primaryLoja) {
    query = query.eq('loja_id', primaryLoja.loja_id);
  } else if (userLojasIds.length > 0) {
    query = query.in('loja_id', userLojasIds);
  }
}
```

---

## Fluxo Corrigido

### Envio de Romaneio (sem loop)
```
Operador CPD envia romaneio
       │
       ├─► Debita contagem_porcionados do CPD (final_sobra -= quantidade)
       │
       └─► SEM listener de estoque_cpd/estoque_loja_itens
                 │
                 └─► Apenas listeners de romaneios atualizam a tela
```

### Visualização para Usuário de Loja
```
Usuário logado (role: Loja, primaryLoja: "ARMAZÉM")
       │
       └─► fetchRomaneiosEnviados()
                 │
                 └─► WHERE loja_id = "ARMAZÉM"
                           │
                           └─► Vê APENAS romaneios destinados ao ARMAZÉM
```

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Enviar romaneio | Dispara loop infinito via listeners | Apenas atualiza tela do romaneio |
| Loja ARMAZÉM logada | Vê romaneios de todas as lojas vinculadas | Vê APENAS romaneios do ARMAZÉM |
| Produção logada | Vê romaneios de todas as lojas | Mantém comportamento (correto) |
| Admin logado | Vê todos os romaneios | Mantém comportamento (correto) |

---

## Observação sobre Triggers

O trigger `trg_criar_producao_apos_contagem` pode ainda disparar quando o romaneio debita o estoque. Se isso continuar causando problemas, será necessário modificar o trigger no banco para:
- Ignorar updates que apenas alteram `final_sobra`
- Ou adicionar uma condição que só recria cards quando `ideal_amanha` ou `a_produzir` muda

Essa modificação de trigger seria um passo adicional se os problemas persistirem após as correções no frontend.
