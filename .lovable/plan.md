

# Plano: Coluna "Cardápio Web" na Contagem de Porcionados

## Objetivo

Adicionar uma nova coluna no card de contagem que mostra quando e quanto o Cardápio Web movimentou o estoque de cada item, permitindo que os operadores da loja saibam exatamente o horário que o sistema automático fez a baixa.

## Diagrama do Layout Proposto

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ UNIDADE ALEIXO                                                                                              │
│ ✓ MASSA - PORCIONADO                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                             │
│  [- 0 +]  [Peso: 0 g]  ┌─────────────────────────┐  [A PRODUZIR]  [LOTES]  [Extra]                         │
│                        │   📱 Cardápio Web        │      100          2                                     │
│                        │   -15 un às 14:32       │                                                          │
│                        │   Total: -23 un hoje    │                                                          │
│                        └─────────────────────────┘                                                          │
│                                                                                                             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Alterações Necessárias

### Parte 1: Adicionar Campos no Banco de Dados

Adicionar 3 novas colunas na tabela `contagem_porcionados`:

```sql
-- Quantidade total baixada pelo Cardápio Web hoje
cardapio_web_baixa_total INTEGER DEFAULT 0;

-- Horário da última baixa automática
cardapio_web_ultima_baixa_at TIMESTAMPTZ;

-- Quantidade da última baixa individual
cardapio_web_ultima_baixa_qtd INTEGER;
```

### Parte 2: Atualizar Edge Function do Webhook

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

Modificar o UPDATE para gravar os novos campos:

```typescript
// Antes
const { error: updateError } = await supabase
  .from('contagem_porcionados')
  .update({ 
    final_sobra: novoFinalSobra,
    updated_at: new Date().toISOString()
  })
  .eq('id', contagem.id)

// Depois
const agora = new Date().toISOString();
const novoTotalBaixas = (contagem.cardapio_web_baixa_total || 0) + quantidadeTotal;

const { error: updateError } = await supabase
  .from('contagem_porcionados')
  .update({ 
    final_sobra: novoFinalSobra,
    updated_at: agora,
    // Novos campos para rastreamento
    cardapio_web_baixa_total: novoTotalBaixas,
    cardapio_web_ultima_baixa_at: agora,
    cardapio_web_ultima_baixa_qtd: quantidadeTotal
  })
  .eq('id', contagem.id)
```

### Parte 3: Atualizar Interface Contagem

**Arquivo:** `src/components/contagem/ContagemItemCard.tsx`

Adicionar nova coluna visual com as informações do Cardápio Web:

```typescript
// Novas props
interface ContagemItemCardProps {
  // ... props existentes
  cardapioWebBaixaTotal?: number;
  cardapioWebUltimaBaixaAt?: string;
  cardapioWebUltimaBaixaQtd?: number;
}

// Nova coluna no card
{(cardapioWebBaixaTotal && cardapioWebBaixaTotal !== 0) && (
  <div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl min-w-[100px] 
                  bg-violet-100 dark:bg-violet-900/50 border border-violet-300 dark:border-violet-700">
    <span className="text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-400 flex items-center gap-1">
      <Smartphone className="h-3 w-3" />
      Cardápio Web
    </span>
    <span className="text-sm font-bold text-violet-700 dark:text-violet-300">
      -{cardapioWebUltimaBaixaQtd} às {format(cardapioWebUltimaBaixaAt, 'HH:mm')}
    </span>
    <span className="text-[10px] text-violet-500">
      Total: -{cardapioWebBaixaTotal} un hoje
    </span>
  </div>
)}
```

### Parte 4: Atualizar Página de Contagem

**Arquivo:** `src/pages/ContagemPorcionados.tsx`

Passar os novos dados para o componente:

```typescript
// Na interface Contagem, adicionar:
interface Contagem {
  // ... campos existentes
  cardapio_web_baixa_total?: number;
  cardapio_web_ultima_baixa_at?: string;
  cardapio_web_ultima_baixa_qtd?: number;
}

// Na query SELECT, adicionar os novos campos
const { data: contagensData } = await supabase
  .from('contagem_porcionados')
  .select('*, cardapio_web_baixa_total, cardapio_web_ultima_baixa_at, cardapio_web_ultima_baixa_qtd')
  .eq('dia_operacional', today)
```

---

## Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| **Banco de Dados** | 3 novas colunas: `cardapio_web_baixa_total`, `cardapio_web_ultima_baixa_at`, `cardapio_web_ultima_baixa_qtd` |
| **cardapio-web-webhook** | Gravar horário e quantidade de cada baixa automática |
| **ContagemItemCard.tsx** | Nova coluna visual roxa "Cardápio Web" |
| **ContagemPorcionados.tsx** | Carregar e passar os novos dados para os cards |

---

## Comportamento Esperado

1. **Cardápio Web recebe pedido** → Webhook processa
2. **Webhook decrementa estoque** → Grava horário e quantidade nos novos campos
3. **Operador visualiza contagem** → Vê coluna "Cardápio Web" mostrando:
   - Quantidade da última baixa (ex: `-5 às 14:32`)
   - Total baixado no dia (ex: `Total: -23 un hoje`)
4. **Coluna só aparece** quando há movimentação do Cardápio Web (valor diferente de zero)

---

## Benefícios

- Rastreabilidade completa das baixas automáticas
- Horário exato de cada movimentação
- Separação clara entre ajustes manuais e automáticos
- Auditoria facilitada para o gestor

