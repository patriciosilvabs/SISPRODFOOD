

# Plano: Adaptar Interface para Modelo Just-in-Time (Valores Negativos)

## Contexto do Problema

A imagem mostra o cenário atual na tela de contagem:

| Campo | Valor Atual | Problema |
|-------|-------------|----------|
| Campo Azul (Sobra) | **100** | Deveria ser negativo se só há vendas |
| Cardápio Web | **-50 às 14:54** | Mostra que houve baixa automática |
| A Produzir | **0** | Deveria mostrar demanda real |

### O que aconteceu?

Alguém ajustou manualmente o campo para 100, sobrepondo as vendas automáticas. O sistema calculou: `a_produzir = 100 (ideal) - 100 (sobra) = 0`.

### Por que isso é um problema?

O modelo antigo assumia que o funcionário informava a **sobra física real** (sempre positiva). No modelo Just-in-Time, o webhook decrementa automaticamente a cada venda, podendo gerar valores **negativos** (que representam o acumulado de vendas).

---

## Bloqueios Identificados

| Arquivo | Linha | Bloqueio | Impacto |
|---------|-------|----------|---------|
| `ContagemPorcionados.tsx` | 514 | `finalSobra < 0` impede salvar negativos | Não salva contagens com vendas |
| `ContagemPorcionados.tsx` | 982 | `finalSobra > 0 &&` impede decrementar abaixo de zero | Botão "-" trava em 0 |
| `ContagemItemCard.tsx` | 148 | `pattern="[0-9]*"` só aceita dígitos | Input não aceita "-" |
| `ContagemItemCard.tsx` | 151 | `.replace(/\D/g, '')` remove não-dígitos | Remove o sinal negativo |

---

## Solução Proposta

### 1. Permitir Valores Negativos na Validação

**Arquivo:** `src/pages/ContagemPorcionados.tsx`

```typescript
// Linha 514 - ANTES:
if (isNaN(finalSobra) || finalSobra < 0) {
  toast.error('Valor de Sobra inválido. Insira um número válido (≥ 0).', { id: toastId });
  ...
}

// Linha 514 - DEPOIS:
if (isNaN(finalSobra)) {
  toast.error('Valor de Sobra inválido. Insira um número válido.', { id: toastId });
  ...
}
```

### 2. Permitir Decrementar Abaixo de Zero

**Arquivo:** `src/pages/ContagemPorcionados.tsx`

```typescript
// Linha 982 - ANTES:
onDecrementSobra={() => finalSobra > 0 && handleValueChange(...)}

// Linha 982 - DEPOIS:
onDecrementSobra={() => handleValueChange(loja.id, item.id, 'final_sobra', String(finalSobra - 1))}
```

### 3. Adaptar Input para Aceitar Negativos

**Arquivo:** `src/components/contagem/ContagemItemCard.tsx`

```typescript
// Linha 145-153 - ANTES:
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  value={finalSobra}
  onChange={(e) => {
    const val = e.target.value.replace(/\D/g, '');
    onSobraChange(val === '' ? 0 : parseInt(val, 10));
  }}

// DEPOIS:
<input
  type="text"
  inputMode="text"  // Permitir entrada de "-"
  value={finalSobra}
  onChange={(e) => {
    // Permitir apenas números e sinal negativo
    const val = e.target.value.replace(/[^-\d]/g, '');
    // Garantir que "-" só apareça no início
    const sanitized = val.replace(/(?!^)-/g, '');
    onSobraChange(sanitized === '' || sanitized === '-' ? 0 : parseInt(sanitized, 10));
  }}
```

### 4. Estilização Visual para Valores Negativos

```typescript
// Adicionar destaque visual quando valor é negativo:
className={`... ${
  finalSobra < 0 
    ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-400'
    : isItemNaoPreenchido 
      ? 'bg-amber-50 ...' 
      : 'bg-white ...'
}`}
```

---

## Fluxo Após Implementação

```text
Início do dia (00:00):
├── final_sobra: 0 (sem contagem física)
├── ideal_amanha: 100
└── a_produzir: 100

Após 10 vendas via Cardápio Web:
├── final_sobra: -10 (vermelho, indicando consumo)
├── ideal_amanha: 100  
└── a_produzir: 110 (100 - (-10) = 110)

Funcionário ajusta +5 (encontrou sobra física):
├── final_sobra: -5 (ajustado)
├── ideal_amanha: 100
└── a_produzir: 105
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/ContagemPorcionados.tsx` | Remover validação `< 0`, permitir decremento sem limite |
| `src/components/contagem/ContagemItemCard.tsx` | Aceitar input negativo, estilização visual |

---

## Resultado Visual Esperado

O campo azul exibirá:
- **Valores positivos (azul)**: sobra física real
- **Valores negativos (vermelho)**: déficit acumulado por vendas
- **Botão laranja**: sempre mostra `ideal - final_sobra`, funcionando corretamente com negativos

