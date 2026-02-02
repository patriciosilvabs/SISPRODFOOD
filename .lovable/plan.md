
# Plano: Aplicar Nova Lógica "A Produzir" ao Frontend

## Problema Identificado

A migração de banco de dados foi aplicada, mas o frontend ainda usa a fórmula antiga em dois lugares:

| Local | Linha | Fórmula Atual (ERRADA) | Nova Fórmula |
|-------|-------|------------------------|--------------|
| Exibição UI | 1119 | `MAX(0, ideal - sobra)` | `MIN(ideal, vendas_web)` |
| Toast | 604-605 | `MAX(0, (ideal - sobra) + vendas_web)` | `MIN(ideal, vendas_web)` |

## Alterações Necessárias

### 1. Arquivo: `src/pages/ContagemPorcionados.tsx`

**Linha 604-605** - Cálculo para toast de confirmação:
```typescript
// DE:
const cardapioWebBaixaTotal = contagemExistente?.cardapio_web_baixa_total || 0;
const aProduzir = Math.max(0, (idealAmanha - finalSobra) + cardapioWebBaixaTotal);

// PARA:
const cardapioWebBaixaTotal = contagemExistente?.cardapio_web_baixa_total || 0;
const aProduzir = Math.min(idealAmanha, cardapioWebBaixaTotal);
```

**Linha 1117-1119** - Cálculo para exibição na UI:
```typescript
// DE:
// MODELO SIMPLIFICADO: a_produzir = ideal - final_sobra (recalculado em tempo real)
// Usa o valor local de finalSobra para feedback imediato na UI
const aProduzir = Math.max(0, idealFromConfig - finalSobra);

// PARA:
// MODELO VENDAS: a_produzir = MIN(ideal, vendas_web)
// Exibe vendas acumuladas limitadas ao ideal configurado
const cardapioWebBaixaTotal = contagem?.cardapio_web_baixa_total || 0;
const aProduzir = Math.min(idealFromConfig, cardapioWebBaixaTotal);
```

## Fluxo Corrigido

Com estas alterações:
- **Ideal = 140**
- **Vendas Web = 100**
- **A Produzir = 100** (não mais 30 ou qualquer outro valor)

O valor exibido na UI agora será consistente com o valor calculado no banco de dados pela coluna gerada.

## Considerações

### Sincronização UI vs Banco
A UI agora precisa do valor `cardapio_web_baixa_total` para calcular localmente. Este valor já está sendo passado ao componente (linhas 1157-1159), então apenas precisamos usá-lo no cálculo.

### Lojas sem Cardápio Web
Para lojas que não usam Cardápio Web, `cardapio_web_baixa_total` será 0, então `a_produzir` também será 0 - comportamento esperado.
