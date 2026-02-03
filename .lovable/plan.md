

# Plano: Remover Coluna Peso e Adicionar Coluna Estoque Ideal

## Objetivo

Na página "Contagem de Porcionados", remover o campo "Peso" (que não é mais necessário) e adicionar em seu lugar a coluna **"Estoque Ideal do Dia"** que já existe mas só é exibida para admins com detalhes ativados.

## Mudanças Necessárias

### Arquivo: `src/components/contagem/ContagemItemCard.tsx`

#### 1. Remover campo de Peso

Remover completamente o bloco do campo "Peso":
```tsx
{/* Campo de Peso - SERÁ REMOVIDO */}
<div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 bg-background min-w-[120px]">
  <span className="text-xs text-muted-foreground font-medium">Peso</span>
  <WeightInputInline ... />
  <span className="text-xs text-muted-foreground">g</span>
</div>
```

#### 2. Remover props relacionadas a peso

- Remover `pesoTotal` das props
- Remover `onPesoChange` das props
- Remover import do `WeightInputInline`

#### 3. Exibir "Estoque Ideal" sempre (não apenas para admin)

Atualmente, a coluna "Ideal" só aparece quando `showAdminCols` é `true`:
```tsx
{showAdminCols && (
  <div className="flex flex-col items-center...">
    <span>Ideal ({currentDayLabel})</span>
    ...
  </div>
)}
```

Alterar para aparecer **sempre**, sem a condição `showAdminCols`:
```tsx
{/* Estoque Ideal do Dia - SEMPRE VISÍVEL */}
<div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl border-2 min-w-[80px] ...">
  <span className="text-[10px] text-gray-500 uppercase tracking-wide">
    Ideal ({currentDayLabel})
  </span>
  {idealFromConfig === 0 ? (
    <span className="text-xs flex items-center gap-0.5">
      <AlertTriangle className="h-3 w-3" />
      N/C
    </span>
  ) : (
    <span className="text-base font-bold text-gray-900">{idealFromConfig}</span>
  )}
</div>
```

### Arquivo: `src/pages/ContagemPorcionados.tsx`

#### 4. Remover chamadas relacionadas ao peso

Onde o `ContagemItemCard` é renderizado, remover:
- `pesoTotal={pesoTotal}`
- `onPesoChange={(val) => handleValueChange(...)}`

### Interface atualizada do `ContagemItemCardProps`

```typescript
interface ContagemItemCardProps {
  item: { id: string; nome: string; peso_unitario_g: number; };
  lojaNome?: string;
  finalSobra: number;
  // pesoTotal: string | number;  // REMOVIDO
  idealFromConfig: number;
  aProduzir: number;
  campoTocado: boolean;
  isDirty: boolean;
  isItemNaoPreenchido: boolean;
  sessaoAtiva: boolean;
  isAdmin: boolean;
  showAdminCols: boolean;
  lastUpdate?: string;
  onIncrementSobra: () => void;
  onDecrementSobra: () => void;
  onSobraChange: (value: number) => void;
  // onPesoChange: (value: string) => void;  // REMOVIDO
  currentDayLabel: string;
  ...
}
```

## Layout Resultante

**Antes:**
```
[Nome Item] [- 150 +] [Peso: 0 g] [Ideal] [A Produzir] [Extra]
                          ↑
                      REMOVER
```

**Depois:**
```
[Nome Item] [- 150 +] [Ideal (Seg): 200] [A Produzir: 50] [Extra]
                            ↑
                    SEMPRE VISÍVEL
```

## Arquivos Modificados

1. **`src/components/contagem/ContagemItemCard.tsx`**
   - Remover import `WeightInputInline`
   - Remover props `pesoTotal` e `onPesoChange`
   - Remover bloco de UI do campo de peso
   - Remover condição `showAdminCols` da coluna "Ideal"

2. **`src/pages/ContagemPorcionados.tsx`**
   - Remover `pesoTotal` e `onPesoChange` da chamada do componente

## Benefícios

- Interface mais limpa sem campo de peso não utilizado
- Usuários comuns vêem o estoque ideal do dia, não apenas admins
- Melhor visibilidade do objetivo diário

