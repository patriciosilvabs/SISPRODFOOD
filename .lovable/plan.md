

# Plano: Limitar Quantidade de Envio ao Estoque Disponível

## Contexto

O romaneio já é manual (usuário informa quantidades e loja), mas o sistema não impede visualmente que o usuário digite uma quantidade maior do que o estoque disponível no CPD. A validação só ocorre no momento do envio, o que causa frustração.

## Objetivo

Limitar em tempo real a quantidade máxima que pode ser enviada, baseado no estoque físico do CPD (contagem_porcionados.final_sobra).

## Alterações

### Arquivo: `src/pages/Romaneio.tsx`

| Componente | Alteração |
|------------|-----------|
| `SecaoLojaRomaneio` | Receber estoque CPD para limitar quantidade |
| Input de quantidade | Adicionar atributo `max` e validação |
| `handleUpdateQuantidadeLoja` | Limitar valor ao máximo disponível |
| Interface visual | Mostrar "Máx: X un" próximo ao input |

### 1. Atualizar Interface `ItemSelecionadoLoja`

Adicionar campo para rastrear o máximo disponível:

```typescript
interface ItemSelecionadoLoja {
  item_id: string;
  item_nome: string;
  quantidade: number;
  quantidade_maxima: number;  // NOVO: limite máximo do estoque
  peso_g: string;
  volumes: string;
  // ... demais campos
}
```

### 2. Atualizar Props do `SecaoLojaRomaneio`

Não é necessário alterar props - os dados já vêm em `demanda.itens` com `quantidade_disponivel`.

### 3. Modificar Input de Quantidade

```tsx
// ANTES: Sem limite máximo
<Input
  type="number"
  value={item.quantidade || ''}
  onChange={(e) => onUpdateQuantidade(demanda.loja_id, item.item_id, parseInt(e.target.value) || 0)}
  min={1}
/>

// DEPOIS: Com limite e indicador visual
const itemOriginal = demanda.itens.find(i => i.item_id === item.item_id);
const maxDisponivel = itemOriginal?.quantidade_disponivel || item.quantidade;

<div className="flex flex-col items-center gap-0.5">
  <Input
    type="number"
    value={item.quantidade || ''}
    onChange={(e) => {
      const valor = parseInt(e.target.value) || 0;
      // Limitar automaticamente ao máximo disponível
      onUpdateQuantidade(demanda.loja_id, item.item_id, Math.min(valor, maxDisponivel));
    }}
    min={1}
    max={maxDisponivel}
  />
  <span className="text-xs text-muted-foreground">
    Máx: {maxDisponivel}
  </span>
</div>
```

### 4. Atualizar `handleUpdateQuantidadeLoja`

```typescript
const handleUpdateQuantidadeLoja = (lojaId: string, itemId: string, quantidade: number) => {
  setDemandasPorLoja(prev => prev.map(d => {
    if (d.loja_id !== lojaId) return d;
    
    // Buscar limite máximo do item original
    const itemOriginal = d.itens.find(i => i.item_id === itemId);
    const maxDisponivel = itemOriginal?.quantidade_disponivel || 999999;
    
    return {
      ...d,
      itensSelecionados: d.itensSelecionados.map(item =>
        item.item_id === itemId 
          ? { ...item, quantidade: Math.max(1, Math.min(quantidade, maxDisponivel)), salvo: false } 
          : item
      )
    };
  }));
};
```

### 5. Visual de Alerta quando Próximo do Limite

Adicionar indicador visual quando quantidade = máximo:

```tsx
const estaNolimite = item.quantidade >= maxDisponivel;

<Input
  className={cn(
    layoutExpandido ? "w-24 h-12 text-center text-lg font-medium" : "w-20 h-10 text-center text-base font-medium",
    estaNolimite && "border-amber-500 bg-amber-50"
  )}
/>
{estaNolimite && (
  <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
    Limite
  </Badge>
)}
```

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────┐
│ ESFIHA DE FRANGO                                            │
│ 📦 10/01 LOTE-20260110-003                                  │
├─────────────────────────────────────────────────────────────┤
│ [  45  ] un  │  [   ] kg  │  [  ] vol  │  ✓  │  🗑️         │
│  Máx: 45     │            │            │     │             │
│  ⚠️ Limite    │            │            │     │             │
└─────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `src/pages/Romaneio.tsx` | ~416-423 | Input com max e indicador visual |
| `src/pages/Romaneio.tsx` | ~1448-1458 | Handler com validação de limite |
| `src/pages/Romaneio.tsx` | ~254 | Props para estoque máximo |

## Benefícios

1. **Feedback imediato**: Usuário vê o limite enquanto digita
2. **Impossível ultrapassar**: Input já limita o valor máximo
3. **Indicador visual**: Cor âmbar quando no limite
4. **Mantém validação no envio**: Backup de segurança

