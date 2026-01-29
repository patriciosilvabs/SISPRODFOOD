

# Plano: Remover Botão "Iniciar" dos Cards de Status

## Objetivo

Remover o botão "Iniciar" dos cards de status das lojas, pois o fluxo de produção deve seguir o procedimento padrão (clicar no card para filtrar por loja, não iniciar diretamente).

## Alterações

### Arquivo: `src/components/kanban/ContagemStatusIndicator.tsx`

| Seção | Mudança |
|-------|---------|
| Imports | Remover `Button` e `Play` (não utilizados mais) |
| Interface Props | Remover `onIniciarProducaoLoja` |
| Componente | Remover toda a seção do botão "Iniciar" (linhas 181-199) |
| Texto de ajuda | Atualizar mensagem para remover menção ao botão "Iniciar" |

### Detalhes das Alterações

**1. Imports (linha 3-5):**
```tsx
// ANTES
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Store, Package, Play, Star, AlertTriangle } from "lucide-react";

// DEPOIS
import { CheckCircle2, Clock, Store, Package, Star, AlertTriangle } from "lucide-react";
```

**2. Interface Props (linhas 23-29):**
```tsx
// ANTES
interface ContagemStatusIndicatorProps {
  lojas: Loja[];
  contagensHoje: ContagemData[];
  onIniciarProducaoLoja?: (lojaId: string, lojaNome: string) => void;
  onSelecionarLoja?: (lojaId: string | null, lojaNome: string) => void;
  lojaFiltradaId?: string | null;
}

// DEPOIS
interface ContagemStatusIndicatorProps {
  lojas: Loja[];
  contagensHoje: ContagemData[];
  onSelecionarLoja?: (lojaId: string | null, lojaNome: string) => void;
  lojaFiltradaId?: string | null;
}
```

**3. Destruturação das props (linhas 31-36):**
```tsx
// ANTES
export function ContagemStatusIndicator({
  lojas,
  contagensHoje,
  onIniciarProducaoLoja,
  onSelecionarLoja,
  lojaFiltradaId,
}: ContagemStatusIndicatorProps) {

// DEPOIS
export function ContagemStatusIndicator({
  lojas,
  contagensHoje,
  onSelecionarLoja,
  lojaFiltradaId,
}: ContagemStatusIndicatorProps) {
```

**4. Remover botão (linhas 181-199):**
```tsx
// REMOVER completamente esta seção:
{onIniciarProducaoLoja && loja.totalItens > 0 && (
  <Button
    size="sm"
    onClick={(e) => {
      e.stopPropagation();
      onIniciarProducaoLoja(loja.id, loja.nome);
    }}
    ...
  >
    <Play className="h-4 w-4" />
    Iniciar
  </Button>
)}
```

**5. Atualizar texto de ajuda (linhas 221-224):**
```tsx
// ANTES
💡 Clique em um card para filtrar a produção por loja ou em "Iniciar" para começar.

// DEPOIS
💡 Clique em um card para filtrar a produção por loja.
```

## Resultado Esperado

Os cards de status mostrarão apenas:
- Ícone circular (estrela ou check)
- Nome da loja
- Estatísticas (X itens • Y un)
- Horário de atualização
- Nota de "Maior demanda" (quando aplicável)

O usuário poderá clicar no card para filtrar o Kanban por loja, seguindo o procedimento padrão.

