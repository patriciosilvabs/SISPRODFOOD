
# Plano: Corrigir Status das Contagens - Buscar Diretamente da Tabela

## Problema Identificado

O "Status das Contagens de Hoje" está **incorretamente** calculando quais lojas enviaram contagem.

**Lógica Atual (Errada):**
```
contagensHoje ← Baseado nos CARDS de produção (producao_registros)
             ← Olha detalhes_lojas dos cards a_produzir
```

**Consequência:** Se a loja inseriu contagem mas os cards ainda não foram gerados (ex: falta recalcular, trigger não executou), a loja aparece como "Aguardando" mesmo tendo dados.

**Evidência no banco de dados:**
- Loja `UNIDADE ALEIXO` tem **9 contagens** com `dia_operacional = 2026-01-29`
- Mas os cards existentes têm `data_referencia = 2026-01-28` e são de outras lojas
- Logo, ALEIXO não aparece no status (mostra "Aguardando")

---

## Solução

Calcular `contagensHoje` diretamente da tabela `contagem_porcionados`, **não** dos cards de produção.

**Lógica Nova (Correta):**
```sql
SELECT loja_id, loja_nome, COUNT(*) as totalItens, SUM(a_produzir) as totalUnidades
FROM contagem_porcionados
WHERE dia_operacional = <dia_atual>
  AND a_produzir > 0
GROUP BY loja_id
```

---

## Mudanças Técnicas

### Arquivo: `src/pages/ResumoDaProducao.tsx`

**Substituir** a lógica das linhas ~840-858 por uma consulta direta:

```typescript
// ANTES (errado - baseado em cards):
const contagemStats = new Map();
organizedColumns.a_produzir.forEach(reg => {
  // Olha detalhes_lojas dos cards
});
setContagensHoje(Array.from(contagemStats.values()));

// DEPOIS (correto - baseado na tabela de contagens):
const { data: contagensAgrupadas } = await supabase
  .from('contagem_porcionados')
  .select('loja_id, a_produzir, updated_at')
  .eq('organization_id', organizationId)
  .eq('dia_operacional', diaOperacionalAtual)
  .gt('a_produzir', 0);

// Agregar por loja
const contagemStats = new Map<string, {
  loja_id: string;
  loja_nome: string;
  totalItens: number;
  totalUnidades: number;
  ultimaAtualizacao?: string;
}>();

// Buscar nomes das lojas
const lojasMap = new Map(lojasData?.map(l => [l.id, l.nome]) || []);

contagensAgrupadas?.forEach(c => {
  if (!contagemStats.has(c.loja_id)) {
    contagemStats.set(c.loja_id, {
      loja_id: c.loja_id,
      loja_nome: lojasMap.get(c.loja_id) || 'Loja Desconhecida',
      totalItens: 0,
      totalUnidades: 0,
      ultimaAtualizacao: c.updated_at,
    });
  }
  const stats = contagemStats.get(c.loja_id)!;
  stats.totalItens += 1;
  stats.totalUnidades += c.a_produzir;
  // Atualizar timestamp se for mais recente
  if (c.updated_at > (stats.ultimaAtualizacao || '')) {
    stats.ultimaAtualizacao = c.updated_at;
  }
});

setContagensHoje(Array.from(contagemStats.values()));
```

---

## Fluxo Corrigido

```
┌─────────────────────────────────────────────────────────────┐
│ LOJA INSERE CONTAGEM (contagem_porcionados)                │
│ • a_produzir = 158, dia_operacional = 2026-01-29           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ TELA RESUMO DA PRODUÇÃO                                    │
│ • Busca contagem_porcionados WHERE dia_operacional = hoje  │
│ • Agrupa por loja_id                                       │
│ • Loja aparece como ✅ (enviou contagem)                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ TRIGGER/RECALCULO gera cards em producao_registros         │
│ • Cards aparecem na coluna A PRODUZIR                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Loja aparece só se cards existem | Loja aparece assim que salva contagem |
| Dependente de trigger/recalculo | Independente dos cards |
| Dados podem estar desatualizados | Sempre reflete estado real |

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ResumoDaProducao.tsx` | Alterar lógica de cálculo de `contagensHoje` para buscar diretamente de `contagem_porcionados` |

