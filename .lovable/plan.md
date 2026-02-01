

# Plano: Modelo de Três Camadas para Estoque Just-in-Time

## Diagnóstico do Problema Atual

A solução implementada usa valores **negativos** no campo `final_sobra` para representar vendas, o que gera:

| Problema | Impacto |
|----------|---------|
| **Confusão Cognitiva** | Funcionário vê "-10" e não entende - estoque físico não é negativo |
| **Perda de Rastreabilidade** | Impossível distinguir ajuste manual de venda automática |
| **Dificuldade de Auditoria** | Histórico mistura realidade física com fluxo de vendas |

A boa notícia: **os campos já existem no banco de dados!** A tabela `contagem_porcionados` já possui:
- `final_sobra` - para contagem física
- `cardapio_web_baixa_total` - acumulado de vendas do dia
- `cardapio_web_ultima_baixa_at` / `cardapio_web_ultima_baixa_qtd` - última baixa

---

## Arquitetura de Três Camadas Proposta

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         CARD DE CONTAGEM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [MUSSARELA]                                                        │
│                                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────┐ │
│  │  SOBRA      │   │  VENDAS     │   │  IDEAL      │   │   A     │ │
│  │  FÍSICA     │   │  WEB        │   │   DIA       │   │PRODUZIR │ │
│  │ ┌───────┐   │   │             │   │             │   │         │ │
│  │ │  50   │   │   │   -15       │   │    100      │   │   65    │ │
│  │ └───────┘   │   │  às 14:32   │   │   (Seg)     │   │         │ │
│  │  [−] [+]    │   │             │   │             │   │         │ │
│  │  (azul)     │   │  (violeta)  │   │  (cinza)    │   │(laranja)│ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────┘ │
│                                                                     │
│  FUNCIONÁRIO     AUTOMÁTICO          CONFIGURAÇÃO     CALCULADO    │
│  controla        (webhook)           (admin)          (sistema)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Nova Lógica de Cálculo

A fórmula muda de:
```
// ANTES (problemático):
a_produzir = ideal - final_sobra  // onde final_sobra pode ser negativo

// DEPOIS (três camadas):
a_produzir = ideal - sobra_fisica + vendas_pendentes
           = 100   - 50           + 15
           = 65 unidades
```

Ou simplificando:
```
a_produzir = (ideal - sobra_fisica) + cardapio_web_baixa_total
```

---

## Mudanças Necessárias

### 1. Edge Function: NÃO alterar `final_sobra`

**Arquivo:** `supabase/functions/cardapio-web-webhook/index.ts`

O webhook deve atualizar APENAS os campos de rastreamento, sem tocar no `final_sobra`:

```typescript
// ANTES (problemático):
const novoFinalSobra = (contagem.final_sobra || 0) - quantidadeTotal

// DEPOIS (correto):
// NÃO altera final_sobra - isso é campo do funcionário
const novoTotalBaixas = (contagem.cardapio_web_baixa_total || 0) + quantidadeTotal
const sobraFisica = contagem.final_sobra || 0
const novoAProduzir = Math.max(0, (idealDoDia - sobraFisica) + novoTotalBaixas)

await supabase.from('contagem_porcionados').update({
  // final_sobra: NÃO ALTERAR - é campo do funcionário
  ideal_amanha: idealDoDia,
  a_produzir: novoAProduzir,
  cardapio_web_baixa_total: novoTotalBaixas,
  cardapio_web_ultima_baixa_at: agora,
  cardapio_web_ultima_baixa_qtd: quantidadeTotal,
})
```

### 2. Frontend: Restaurar `final_sobra` apenas positivo

**Arquivo:** `src/pages/ContagemPorcionados.tsx`

Reverter as mudanças que permitiam negativos e ajustar o cálculo de `a_produzir`:

```typescript
// Linha 540 - ANTES:
const aProduzir = Math.max(0, idealAmanha - finalSobra);

// DEPOIS (três camadas):
const cardapioWebBaixaTotal = contagem?.cardapio_web_baixa_total || 0;
const aProduzir = Math.max(0, (idealAmanha - finalSobra) + cardapioWebBaixaTotal);
```

```typescript
// Linha 952 - ANTES:
const aProduzir = Math.max(0, idealFromConfig - finalSobra);

// DEPOIS (três camadas):
const cardapioWebBaixaTotal = contagem?.cardapio_web_baixa_total || 0;
const aProduzir = Math.max(0, (idealFromConfig - finalSobra) + cardapioWebBaixaTotal);
```

### 3. Frontend: Restaurar validação >= 0 para sobra física

**Arquivo:** `src/pages/ContagemPorcionados.tsx`

```typescript
// Linha 514 - Restaurar validação:
if (isNaN(finalSobra) || finalSobra < 0) {
  toast.error('Valor de Sobra inválido. Insira um número >= 0.', { id: toastId });
  // ...
}
```

```typescript
// Linha 982 - Restaurar trava no zero:
onDecrementSobra={() => finalSobra > 0 && handleValueChange(...)}
```

### 4. Frontend: Restaurar input apenas numérico positivo

**Arquivo:** `src/components/contagem/ContagemItemCard.tsx`

```typescript
// Restaurar input original:
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  value={finalSobra}
  onChange={(e) => {
    const val = e.target.value.replace(/\D/g, '');
    onSobraChange(val === '' ? 0 : parseInt(val, 10));
  }}
  className={`h-12 w-16 text-center ... ${
    isItemNaoPreenchido 
      ? 'bg-amber-50 ... border-amber-400' 
      : 'bg-white ... text-blue-600 border-blue-500'
  }`}
/>
```

### 5. Ajustar label do campo Cardápio Web

O badge violeta já existe e já mostra as vendas. Apenas garantir que ele sempre apareça quando `cardapio_web_baixa_total > 0`:

```typescript
// Já existe no ContagemItemCard.tsx - linhas 206-223
// O componente já exibe corretamente:
{cardapioWebBaixaTotal && cardapioWebBaixaTotal > 0 && (
  <div className="... bg-violet-100 ...">
    <Smartphone /> Cardápio Web
    -{cardapioWebUltimaBaixaQtd} às {time}
    Total: -{cardapioWebBaixaTotal} un hoje
  </div>
)}
```

---

## Fluxo Operacional Após Implementação

```text
DIA ANTERIOR (20:00):
├── Funcionário fecha contagem: sobra_fisica = 50
├── cardapio_web_baixa_total = 0 (zerado no novo dia)
└── a_produzir = 100 - 50 = 50

INÍCIO DO DIA (00:00):
├── Novo dia operacional
├── sobra_fisica = 0 (não contou ainda)
├── cardapio_web_baixa_total = 0
└── a_produzir = 100

DURANTE A NOITE (vendas):
├── Venda 1: cardapio_web_baixa_total = 5
├── sobra_fisica = 0 (funcionário não mexeu)
├── a_produzir = (100 - 0) + 5 = 105
│
├── Venda 2: cardapio_web_baixa_total = 10
├── a_produzir = (100 - 0) + 10 = 110

MANHÃ (08:00) - Funcionário conta estoque:
├── Vê que tem 30 massas físicas na bandeja
├── Informa: sobra_fisica = 30
├── cardapio_web_baixa_total = 10 (acumulado da noite)
├── a_produzir = (100 - 30) + 10 = 80
└── Interface mostra claramente:
    [Sobra: 30] [Vendas Web: -10] [A Produzir: 80]
```

---

## Resumo dos Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/cardapio-web-webhook/index.ts` | Não alterar `final_sobra`, apenas atualizar campos de rastreamento e recalcular `a_produzir` |
| `src/pages/ContagemPorcionados.tsx` | Restaurar validação >= 0, ajustar fórmula de `a_produzir` para incluir vendas |
| `src/components/contagem/ContagemItemCard.tsx` | Restaurar input numérico positivo, manter estilo azul |

---

## Vantagens da Arquitetura de Três Camadas

| Aspecto | Solução Atual | Modelo Três Camadas |
|---------|---------------|---------------------|
| **Clareza** | "-10" confunde funcionário | "50 sobra + 10 vendas" é claro |
| **Rastreabilidade** | Tudo misturado | Campos separados para auditoria |
| **Auditoria** | Impossível distinguir | Histórico limpo: contagem física vs vendas |
| **Operação** | Funcionário não entende | Funcionário vê realidade física |
| **Escalabilidade** | Cria dívida técnica | Modelo profissional e extensível |

