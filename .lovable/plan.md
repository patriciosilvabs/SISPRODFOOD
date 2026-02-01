
# Plano Concluído: Correção da Fórmula `a_produzir`

## ✅ Status: Implementado

A fórmula da coluna gerada `a_produzir` foi corrigida para:

```sql
a_produzir = GREATEST(0, COALESCE(ideal_amanha, 0) - COALESCE(final_sobra, 0))
```

## Resumo da Correção

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Fórmula** | `(ideal - sobra) + vendas_web` ❌ | `ideal - sobra` ✅ |
| **Sobra=100, Ideal=100** | A Produzir = 102 ❌ | A Produzir = 0 ✅ |

### Por que a correção era necessária?

O campo `final_sobra` representa o **estoque físico real** que existe na loja **neste momento**. 
Vendas anteriores **já foram atendidas** (com estoque anterior ou produção).
O `cardapio_web_baixa_total` é apenas para **auditoria/rastreamento** - não influencia a produção.

### Campos do Cardápio Web (apenas auditoria)

- `cardapio_web_baixa_total` - acumulado de vendas do dia
- `cardapio_web_ultima_baixa_at` - timestamp da última venda
- `cardapio_web_ultima_baixa_qtd` - quantidade da última venda
