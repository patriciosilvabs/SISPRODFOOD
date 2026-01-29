

# Plano: Corrigir Romaneios "Fantasmas" Sem Itens

## Problema Identificado

Ao tentar receber porcionados, o usuário de loja vê romaneios vazios (sem itens para conferir). O botão "Confirmar Recebimento" não funciona porque não há itens salvos.

**Causa Raiz:**
- Existem **5 romaneios corrompidos** no banco de dados com status `enviado` mas **zero itens** associados
- Esses romaneios foram criados por um fluxo automático antigo (`observacao: "Criado automaticamente ao finalizar produção"`) que foi removido ou falhou silenciosamente ao inserir itens
- O frontend exibe esses romaneios normalmente, mas a lista de itens está vazia

**Romaneios Afetados:**
| ID | Loja | Data Criação |
|----|------|-------------|
| 5c83f5b6-... | UNIDADE ALEIXO | 23/01/2026 05:19 |
| 225e8472-... | UNIDADE CACHOEIRINHA | 23/01/2026 05:19 |
| e557999d-... | UNIDADE JAPIIM | 23/01/2026 05:19 |
| 65d8c58a-... | UNIDADE ALEIXO | 23/01/2026 04:18 |
| 9c1dfb74-... | UNIDADE JAPIIM | 23/01/2026 04:18 |

---

## Solução Proposta

### 1. Limpeza de Dados Corrompidos (Migração SQL)

Marcar os romaneios sem itens como `cancelado` para que não apareçam mais na aba "Receber":

```sql
UPDATE romaneios
SET status = 'cancelado',
    observacao = COALESCE(observacao, '') || ' [Cancelado automaticamente: romaneio sem itens]'
WHERE status = 'enviado'
AND id NOT IN (SELECT DISTINCT romaneio_id FROM romaneio_itens);
```

### 2. Proteção no Frontend (Opcional mas Recomendado)

Adicionar filtro para ignorar romaneios sem itens na consulta:

```typescript
// Em fetchRomaneiosEnviados - filtrar romaneios vazios
const romaneiosFiltrados = romaneiosFormatados.filter(r => 
  r.romaneio_itens && r.romaneio_itens.length > 0
);
```

Ou exibir mensagem clara quando romaneio não tem itens:

```typescript
{romaneio.romaneio_itens.length === 0 && (
  <div className="p-4 text-center text-muted-foreground bg-amber-50 rounded border border-amber-200">
    <AlertCircle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
    <p className="font-medium">Romaneio sem itens</p>
    <p className="text-sm">Este romaneio foi criado sem itens associados e não pode ser recebido.</p>
  </div>
)}
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Usuário vê cards de romaneio vazios | Romaneios corrompidos marcados como "cancelado" |
| Botão "Confirmar Recebimento" não funciona | Apenas romaneios válidos (com itens) aparecem |
| Confusão e erro de operação | Interface clara e funcional |

---

## Detalhes Técnicos

| Arquivo/Área | Mudança |
|--------------|---------|
| **Migração SQL** | Cancelar romaneios sem itens associados |
| **src/pages/Romaneio.tsx** | Filtrar romaneios vazios ou exibir mensagem explicativa |

