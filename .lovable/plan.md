

# Plano: Limpar Contagens ao Limpar Produção

## Problema Identificado

Quando o usuário clica em "Limpar Produção", apenas os registros de `producao_registros` são deletados. Porém, o **painel de status das contagens** continua mostrando as informações das lojas (itens, unidades, última atualização) porque esses dados vêm da tabela `contagem_porcionados`.

## Fluxo Atual

```
Botão "Limpar Produção"
       │
       └─► DELETE producao_registros
                 │
                 └─► Recarrega dados
                           │
                           └─► Painel status AINDA mostra contagens
                               (pois contagem_porcionados mantém a_produzir > 0)
```

## Solução

Atualizar a função `handleLimparProducao` para **também zerar** o campo `a_produzir` da tabela `contagem_porcionados` do dia operacional atual.

## Alterações Propostas

### Arquivo: `src/pages/ResumoDaProducao.tsx`

**Modificar a função `handleLimparProducao` (linhas 285-313):**

```typescript
const handleLimparProducao = async () => {
  if (!organizationId) return;
  
  setIsLimpando(true);
  try {
    // 1. Buscar data atual do servidor
    const { data: dataServidor } = await supabase.rpc('get_current_date');
    const hoje = dataServidor || new Date().toISOString().split('T')[0];
    
    // 2. Deletar todos os registros de produção
    const { error, count } = await supabase
      .from('producao_registros')
      .delete()
      .eq('organization_id', organizationId);
    
    if (error) throw error;
    
    // 3. NOVO: Zerar a_produzir nas contagens do dia atual
    // Isso limpa o painel de status das contagens
    const { error: errorContagem } = await supabase
      .from('contagem_porcionados')
      .update({ a_produzir: 0 })
      .eq('organization_id', organizationId)
      .eq('dia_operacional', hoje);
    
    if (errorContagem) {
      console.error('Erro ao limpar contagens:', errorContagem);
    }
    
    // 4. Registrar no audit log
    await log('producao.limpar', 'producao_registros', null, { 
      acao: 'limpar_tudo',
      registros_removidos: String(count || 0),
      contagens_zeradas: hoje,
    });
    
    toast.success(`Produção limpa! ${count || 0} registros removidos.`);
    await loadProducaoRegistros();
  } catch (error) {
    console.error('Erro ao limpar produção:', error);
    toast.error('Erro ao limpar produção');
  } finally {
    setIsLimpando(false);
  }
};
```

## Fluxo Corrigido

```
Botão "Limpar Produção"
       │
       ├─► DELETE producao_registros
       │
       └─► UPDATE contagem_porcionados SET a_produzir = 0 WHERE dia_operacional = hoje
                 │
                 └─► Recarrega dados
                           │
                           └─► Painel status VAZIO
                               (pois não há contagens com a_produzir > 0)
```

## Impacto

| Cenário | Antes | Depois |
|---------|-------|--------|
| Limpar Produção | Cards removidos, painel status mantém contagens | Cards removidos E painel status limpo |
| Lojas que salvaram contagem | Continuam aparecendo no painel | Não aparecem mais (a_produzir = 0) |
| Próxima contagem da loja | Funciona normalmente | Funciona normalmente |

## Observação

A limpeza zera apenas o campo `a_produzir`, mantendo o registro de `contagem_porcionados` intacto. Isso significa que:
- O histórico de `final_sobra` e `ideal_amanha` é preservado
- As lojas podem refazer a contagem normalmente
- Não há perda de dados estruturais

