
# Plano: Corrigir Inconsistências no Estoque CPD e Lotes que Desaparecem

## Problemas Identificados

### Problema 1: Indicador "Estoque CPD Suficiente" mostra dados incorretos

**Causa raiz**: O `loadProducaoRegistros` busca o estoque CPD corretamente, MAS o problema está em outro lugar. Ao finalizar uma produção, o código nas **linhas 1549-1565** faz:

```typescript
// Resetar a_produzir das contagens relacionadas zerando-as via ideal_amanha = final_sobra
const { data: contagensAtuais } = await supabase
  .from('contagem_porcionados')
  .select('id, final_sobra')
  .eq('item_porcionado_id', selectedRegistro.item_id); // SEM FILTRO!

for (const contagem of contagensAtuais) {
  await supabase
    .from('contagem_porcionados')
    .update({ ideal_amanha: contagem.final_sobra }) // Zera a_produzir = ideal - sobra = 0
    .eq('id', contagem.id);
}
```

Isso **zera a demanda (`a_produzir`) de TODAS as lojas e TODOS os dias** para aquele item! Resultado:
- A loja UNIDADE ALEIXO que tinha demanda de 99 unidades agora mostra 0
- O sistema interpreta que não há demanda pendente
- O indicador "Estoque CPD Suficiente" aparece mesmo quando as lojas precisam de itens

### Problema 2: Segundo lote de MASSA desaparece

**Causa raiz**: Quando o primeiro lote é finalizado:
1. O código zera o `ideal_amanha` de todas as contagens
2. Isso faz `a_produzir = 0` para todas as lojas
3. O trigger `trg_criar_producao_apos_contagem` é disparado
4. A função `criar_ou_atualizar_producao_registro` recalcula: demanda = 0, portanto **deleta os cards pendentes**
5. O segundo lote de MASSA (que ainda não foi produzido) é deletado!

**Evidência no banco de dados**:
```
MASSA - PORCIONADO: total_tracos_lote = 2, mas só existe 1 registro (status: finalizado)
```

O segundo lote foi deletado pela função RPC quando ela verificou que `saldo_liquido <= 0`.

## Solução

### O que NÃO deve acontecer

O código de "resetar a_produzir" após finalizar produção **NÃO deveria existir**. Essa lógica foi introduzida incorretamente e causa os dois problemas.

A arquitetura correta é:
- A demanda das lojas (`ideal_amanha`) deve permanecer inalterada até nova contagem
- O estoque produzido é creditado no CPD
- O Romaneio debita o estoque CPD e envia para as lojas
- Após receber, a loja faz nova contagem atualizando `final_sobra`

### Alteração Necessária

**Arquivo**: `src/pages/ResumoDaProducao.tsx`

**Remover completamente** as linhas 1549-1565 que fazem o reset incorreto do `ideal_amanha`.

**Antes (linhas 1549-1565)**:
```typescript
// Resetar a_produzir das contagens relacionadas zerando-as via ideal_amanha = final_sobra
// (a_produzir é coluna gerada, não pode ser atualizada diretamente)
const { data: contagensAtuais, error: fetchError } = await supabase
  .from('contagem_porcionados')
  .select('id, final_sobra')
  .eq('item_porcionado_id', selectedRegistro.item_id);

if (fetchError) {
  console.error('Erro ao buscar contagens para reset:', fetchError);
} else if (contagensAtuais) {
  for (const contagem of contagensAtuais) {
    await supabase
      .from('contagem_porcionados')
      .update({ ideal_amanha: contagem.final_sobra })
      .eq('id', contagem.id);
  }
}
```

**Depois**: Remover completamente esse bloco de código.

## Fluxo Correto Após Correção

```
Finalizar Produção
       │
       ├─► Atualiza estoque CPD (tabela estoque_cpd)
       │
       ├─► Atualiza contagem_porcionados do CPD (final_sobra += unidades_reais)
       │
       └─► NÃO toca nas contagens das lojas (ideal_amanha permanece inalterado)
       
       ↓ Resultado:
       
- Demanda das lojas permanece visível
- Cards pendentes NÃO são deletados
- Saldo líquido é calculado corretamente: demanda - estoque_cpd
- Segundo lote continua aguardando produção
```

## Por Que Essa Lógica Estava Incorreta

O código parece ter sido adicionado com a intenção de "limpar" a demanda após produzir. Mas isso quebra o modelo:

| Aspecto | Comportamento Incorreto | Comportamento Correto |
|---------|------------------------|----------------------|
| Demanda da loja | Zerada imediatamente | Permanece até romaneio/recebimento |
| Lotes pendentes | Deletados pelo trigger | Mantidos para produção |
| Indicador CPD | Mostra "suficiente" incorretamente | Compara demanda real vs estoque |
| Romaneio | Não tem mais demandas | Mostra itens pendentes para envio |

## Impacto da Correção

- ✅ Cards de produção não serão mais deletados incorretamente
- ✅ Lotes múltiplos (ex: 2/2 de MASSA) permanecerão para produção
- ✅ Indicador "Estoque CPD Suficiente" só aparecerá quando realmente não há demanda pendente
- ✅ Demandas das lojas permanecerão corretas para o fluxo de Romaneio
- ✅ Alinhamento com a arquitetura documentada do sistema
