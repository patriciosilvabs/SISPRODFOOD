
# Plano: Corrigir Atualização de Estoque CPD na Finalização de Produção

## Problema Identificado

Quando uma produção é finalizada, o sistema deveria atualizar o estoque de porcionados do CPD na tabela `contagem_porcionados`. Porém, a atualização está sendo feita **sem filtrar pelo dia operacional atual**, causando:

1. O código busca qualquer registro existente (sem filtro de data)
2. Se encontra um registro de **dia anterior**, atualiza ele
3. Como a página "Estoque Porcionados (CPD)" filtra por `dia_operacional = hoje`, o registro antigo não aparece
4. Resultado: produção finalizada mas estoque aparece como **0 unidades**

## Código Problemático

**Arquivo:** `src/pages/ResumoDaProducao.tsx` - função `handleFinalizarProducao`

**Linhas 1478-1509 (problema):**
```typescript
// PROBLEMA: Não filtra por dia_operacional
const { data: contagemExistente } = await supabase
  .from('contagem_porcionados')
  .select('id, final_sobra')
  .eq('loja_id', cpdLoja.id)
  .eq('item_porcionado_id', selectedRegistro.item_id)
  .maybeSingle(); // ← Pode retornar registro de dia ANTERIOR

// PROBLEMA: Insert sem dia_operacional
await supabase
  .from('contagem_porcionados')
  .insert({
    loja_id: cpdLoja.id,
    item_porcionado_id: selectedRegistro.item_id,
    final_sobra: data.unidades_reais,
    // ← FALTA: dia_operacional
  });
```

## Código Correto (Referência)

O modal `AjustarEstoquePorcionadoModal.tsx` já faz corretamente (linhas 113-163):

```typescript
// 1. Busca data do servidor
const { data: dataServidor } = await supabase.rpc('get_current_date');
const diaOperacional = dataServidor || new Date().toISOString().split('T')[0];

// 2. Busca COM filtro de dia_operacional
.eq('dia_operacional', diaOperacional)

// 3. Insert COM dia_operacional
dia_operacional: diaOperacional,
```

## Solução

Modificar o `handleFinalizarProducao` para:

1. Buscar a data do servidor (`get_current_date`)
2. Adicionar filtro `.eq('dia_operacional', diaOperacional)` na query de busca
3. Incluir `dia_operacional: diaOperacional` no insert de nova contagem

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ResumoDaProducao.tsx` | Adicionar filtro de dia operacional na atualização de estoque CPD |

## Alterações Técnicas

### Dentro de `handleFinalizarProducao` (linhas ~1469-1515)

**Antes:**
```typescript
if (cpdLoja) {
  // Buscar contagem existente (unique por loja_id + item_porcionado_id)
  const { data: contagemExistente } = await supabase
    .from('contagem_porcionados')
    .select('id, final_sobra')
    .eq('loja_id', cpdLoja.id)
    .eq('item_porcionado_id', selectedRegistro.item_id)
    .maybeSingle();
  
  if (contagemExistente) {
    // Incrementar final_sobra
    await supabase
      .from('contagem_porcionados')
      .update({ 
        final_sobra: contagemExistente.final_sobra + data.unidades_reais,
        updated_at: new Date().toISOString()
      })
      .eq('id', contagemExistente.id);
  } else {
    // Criar nova contagem
    await supabase
      .from('contagem_porcionados')
      .insert({
        loja_id: cpdLoja.id,
        item_porcionado_id: selectedRegistro.item_id,
        final_sobra: data.unidades_reais,
        ideal_amanha: 0,
        usuario_id: user?.id || '',
        usuario_nome: profile?.nome || 'Sistema',
        organization_id: organizationId
      });
  }
  console.log(`Contagem CPD atualizada: +${data.unidades_reais} unidades de ${selectedRegistro.item_nome}`);
}
```

**Depois:**
```typescript
if (cpdLoja) {
  // CORREÇÃO: Buscar data do servidor para consistência
  const { data: dataServidor } = await supabase.rpc('get_current_date');
  const diaOperacional = dataServidor || new Date().toISOString().split('T')[0];

  // Buscar contagem existente DO DIA ATUAL
  const { data: contagemExistente } = await supabase
    .from('contagem_porcionados')
    .select('id, final_sobra')
    .eq('loja_id', cpdLoja.id)
    .eq('item_porcionado_id', selectedRegistro.item_id)
    .eq('dia_operacional', diaOperacional)  // ✅ Filtrar pelo dia atual
    .maybeSingle();
  
  if (contagemExistente) {
    // Incrementar final_sobra
    await supabase
      .from('contagem_porcionados')
      .update({ 
        final_sobra: contagemExistente.final_sobra + data.unidades_reais,
        updated_at: new Date().toISOString(),
        usuario_id: user?.id || '',
        usuario_nome: profile?.nome || 'Sistema',
      })
      .eq('id', contagemExistente.id);
  } else {
    // Criar nova contagem PARA O DIA ATUAL
    await supabase
      .from('contagem_porcionados')
      .insert({
        loja_id: cpdLoja.id,
        item_porcionado_id: selectedRegistro.item_id,
        dia_operacional: diaOperacional,  // ✅ Incluir dia operacional
        final_sobra: data.unidades_reais,
        ideal_amanha: 0,
        usuario_id: user?.id || '',
        usuario_nome: profile?.nome || 'Sistema',
        organization_id: organizationId
      });
  }
  console.log(`Contagem CPD atualizada: +${data.unidades_reais} unidades de ${selectedRegistro.item_nome} (dia: ${diaOperacional})`);
}
```

## Fluxo Corrigido

```
Finalizar Produção
        │
        ├─► Buscar data do servidor (get_current_date)
        │         └── Ex: "2026-01-29"
        │
        ├─► Buscar contagem do CPD para HOJE
        │         └── .eq('dia_operacional', '2026-01-29')
        │
        └─► Se encontrou registro de HOJE:
                  └── Incrementar final_sobra
            Se NÃO encontrou:
                  └── Criar novo registro com dia_operacional = '2026-01-29'
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Finalizar MASSA (57 un) | Estoque CPD: 0 un (tela mostra dia atual) | Estoque CPD: 57 un |
| Múltiplas finalizações no dia | Pode atualizar registro de ontem | Sempre incrementa registro de hoje |
| Visualização na página | Inconsistente | Consistente com produção do dia |

## Impacto

- **Zero risco de perda de dados**: Apenas corrige o filtro de busca
- **Consistência garantida**: Alinha com o padrão já usado em `AjustarEstoquePorcionadoModal`
- **Arquitetura respeitada**: Segue o princípio de que `contagem_porcionados.final_sobra` do dia atual é a fonte de verdade
