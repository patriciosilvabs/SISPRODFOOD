
# Plano: Corrigir Bloqueio ao Iniciar Produção

## Problema Identificado

Quando o usuário clica "Iniciar" em uma loja que enviou contagem, o sistema mostra "Nenhum item para produzir" porque:

1. A loja aparece corretamente no **Status das Contagens** (contagem foi salva)
2. Mas os **cards de produção** ainda não foram gerados no Kanban
3. O botão "Iniciar" tenta buscar registros em `columns.a_produzir` que está vazio

**Causa raiz:** Há uma desconexão entre:
- O indicador de contagem (lê diretamente de `contagem_porcionados`)
- Os cards de produção (dependem de trigger/recálculo)

---

## Solução Proposta

Quando o usuário clicar "Iniciar" e não houver cards, **disparar automaticamente o recálculo** para gerar os cards antes de prosseguir.

### Fluxo Corrigido

```text
1. Usuário clica "Iniciar" na loja ALEIXO
2. Sistema verifica: columns.a_produzir.filter(loja === ALEIXO)
3. Se vazio → Chamar recalcular_producao_dia automaticamente
4. Aguardar recálculo concluir
5. Recarregar dados
6. Tentar novamente: buscar cards em a_produzir
7. Se ainda vazio → Mostrar mensagem orientando usuário
8. Se encontrou → Prosseguir com handleIniciarTudoLoja
```

---

## Mudanças Técnicas

### Arquivo: `src/pages/ResumoDaProducao.tsx`

**Modificar o handler `onIniciarProducaoLoja` para:**

```typescript
onIniciarProducaoLoja={async (lojaId, lojaNome) => {
  // Buscar registros da loja na coluna a_produzir
  let registrosDaLoja = columns.a_produzir.filter(
    r => r.detalhes_lojas?.[0]?.loja_id === lojaId
  );
  
  // Se não encontrou cards, tentar recalcular produção primeiro
  if (registrosDaLoja.length === 0) {
    toast.info(`Gerando produção para ${lojaNome}...`);
    
    // Chamar recálculo
    const { error } = await supabase.rpc('recalcular_producao_dia', {
      p_organization_id: organizationId,
      p_usuario_id: user?.id,
      p_usuario_nome: profile?.nome || 'Sistema'
    });
    
    if (error) {
      toast.error('Erro ao gerar produção. Tente clicar em "Recalcular".');
      return;
    }
    
    // Recarregar dados
    await loadProducaoRegistros(true);
    
    // Tentar buscar novamente após recálculo
    const novosDados = columns.a_produzir.filter(
      r => r.detalhes_lojas?.[0]?.loja_id === lojaId
    );
    
    if (novosDados.length === 0) {
      toast.warning(`Nenhum item gerado para ${lojaNome}. Verifique as contagens.`);
      return;
    }
    
    registrosDaLoja = novosDados;
  }
  
  handleIniciarTudoLoja(lojaId, lojaNome, registrosDaLoja);
}}
```

**Alternativa mais simples (sem recálculo automático):**

Mostrar um botão "Gerar Produção" ao invés de bloquear silenciosamente.

---

## Problema Secundário: Estado `lojaIniciada` não Persiste

O estado `lojaIniciada` é perdido ao recarregar a página. Isso pode causar confusão mas não é o problema principal reportado.

**Opção futura:** Persistir `lojaIniciada` no localStorage ou detectar automaticamente baseado em cards em `em_preparo`.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ResumoDaProducao.tsx` | Adicionar lógica de recálculo automático quando não há cards ao clicar "Iniciar" |

---

## Benefícios

| Antes | Depois |
|-------|--------|
| "Nenhum item para produzir" mesmo com contagem | Recálculo automático gera os cards |
| Usuário precisa clicar "Recalcular" manualmente | Sistema faz automaticamente |
| Confusão sobre por que não funciona | Feedback claro e ação automática |

---

## Considerações de UX

- Mostrar loading enquanto recalcula ("Gerando produção...")
- Se recálculo falhar, orientar usuário a usar botão "Recalcular"
- Após recálculo bem-sucedido, cards aparecem e produção é iniciada automaticamente
