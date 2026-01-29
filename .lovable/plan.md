
# Plano: Melhorar Layout do Resumo da Produção

## Análise da Referência

A imagem de referência mostra um layout aprimorado com:

1. **Header com ações à direita**: Botões "Limpar Produção", "Recalcular" e "Atualizar" agrupados horizontalmente
2. **Painel de Status com cards coloridos de destaque**: Cards das lojas com cores vibrantes (amarelo, verde) e layout mais visual
3. **Cards de loja maiores e mais visuais**: Cada loja com ícone circular, contador grande, horário e botão "Iniciar"
4. **Colunas do Kanban com header colorido**: Cada coluna tem um header com cor de fundo correspondente ao status
5. **Indicador de maior demanda**: Card da loja com maior demanda em destaque amarelo com estrela

## Alterações Propostas

### 1. Componente `ContagemStatusIndicator.tsx`

**Layout atual:** Grid 2 colunas com cards pequenos
**Layout proposto:** Grid 4 colunas (responsivo) com cards maiores e mais visuais

Mudanças:
- Cards maiores com padding aumentado
- Ícone circular à esquerda (CheckCircle ou Star)
- Nome da loja em destaque
- Estatísticas maiores: "X itens • Y un"
- Horário de atualização abaixo
- Botão "Iniciar" dentro do card com ícone de play
- Cores mais vibrantes: amarelo para maior demanda, verde para demais
- Card da loja com maior demanda terá nota "Maior demanda - recomendamos iniciar por aqui"

### 2. Colunas do Kanban na página `ResumoDaProducao.tsx`

**Layout atual:** Cards com background de cor clara
**Layout proposto:** Header de cada coluna com cor de fundo mais marcante

Mudanças:
- Headers das colunas com cores de fundo mais intensas
- Badge de contagem posicionado à direita
- Texto "Nenhum item nesta coluna" centralizado quando vazio

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/kanban/ContagemStatusIndicator.tsx` | Layout completo dos cards de loja |
| `src/pages/ResumoDaProducao.tsx` | Estilos do header e colunas do Kanban |

## Detalhes Técnicos

### ContagemStatusIndicator.tsx - Novo Layout

```tsx
// Grid responsivo: 1 col mobile, 2 cols tablet, 4 cols desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
  {enviaram.map((loja) => (
    <div className={cn(
      "rounded-lg p-4 transition-all cursor-pointer",
      isMaiorDemanda 
        ? "bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-300" 
        : "bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-300"
    )}>
      {/* Ícone circular + Nome */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center",
          isMaiorDemanda ? "bg-amber-500" : "bg-emerald-500"
        )}>
          {isMaiorDemanda ? <Star /> : <Check />}
        </div>
        <span className="font-semibold truncate">{loja.nome}</span>
      </div>
      
      {/* Estatísticas grandes */}
      <div className="text-xl font-bold mb-1">
        {loja.totalItens} itens • {loja.totalUnidades} un
      </div>
      
      {/* Horário */}
      <div className="text-xs text-muted-foreground mb-3">
        Atualizado: {horarioFormatado}
      </div>
      
      {/* Nota de maior demanda */}
      {isMaiorDemanda && (
        <div className="text-xs text-amber-700 mb-2 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Maior demanda - recomendamos iniciar por aqui
        </div>
      )}
      
      {/* Botão Iniciar */}
      <Button className="w-full">
        <Play className="h-4 w-4 mr-2" />
        Iniciar
      </Button>
    </div>
  ))}
</div>
```

### ResumoDaProducao.tsx - Colunas do Kanban

```tsx
// Header das colunas mais visual
const columnConfig: Record<StatusColumn, { title: string; bgColor: string; textColor: string }> = {
  a_produzir: { 
    title: 'A PRODUZIR', 
    bgColor: 'bg-slate-200 dark:bg-slate-700',
    textColor: 'text-slate-700 dark:text-slate-200'
  },
  em_preparo: { 
    title: 'EM PREPARO', 
    bgColor: 'bg-amber-200 dark:bg-amber-800',
    textColor: 'text-amber-800 dark:text-amber-100'
  },
  em_porcionamento: { 
    title: 'EM PORCIONAMENTO', 
    bgColor: 'bg-yellow-200 dark:bg-yellow-800',
    textColor: 'text-yellow-800 dark:text-yellow-100'
  },
  finalizado: { 
    title: 'FINALIZADO', 
    bgColor: 'bg-emerald-200 dark:bg-emerald-800',
    textColor: 'text-emerald-800 dark:text-emerald-100'
  },
};
```

## Resultado Visual Esperado

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Resumo da Produção                    [Limpar] [Recalcular] [Atualizar] │
│  Gerencie o fluxo de produção...                                        │
├────────────────────────────────────────────────────────────────────────┤
│  📦 Status das Contagens de Hoje                              4/4 lojas │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ ⭐ ALEIXO    │ │ ✓ ARMAZÉM   │ │ ✓ CACHOEIRA │ │ ✓ JAPIIM     │   │
│  │ 5 itens•445  │ │ 2 itens•152 │ │ 3 itens•46  │ │ 2 itens•33   │   │
│  │ Atualiz 13:04│ │ Atualiz 14:03│ │ Atualiz 13:33│ │ Atualiz 13:39│   │
│  │ ⚠️ Maior...  │ │             │ │              │ │              │   │
│  │ [▶ Iniciar]  │ │ [▶ Iniciar] │ │ [▶ Iniciar] │ │ [▶ Iniciar] │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
├──────────────────┬────────────────┬─────────────────┬──────────────────┤
│ A PRODUZIR    0  │ EM PREPARO  0  │ EM PORCIO...  0 │ FINALIZADO    0  │
│ (cinza escuro)   │ (amarelo)      │ (amarelo)       │ (verde)          │
│                  │                │                 │                  │
│   Nenhum item    │  Nenhum item   │   Nenhum item   │   Nenhum item    │
│   nesta coluna   │  nesta coluna  │   nesta coluna  │   nesta coluna   │
└──────────────────┴────────────────┴─────────────────┴──────────────────┘
```

## Resumo das Alterações

| Componente | Mudança |
|------------|---------|
| Cards de loja | Grid 4 colunas, cards maiores, cores vibrantes |
| Ícones | Círculo colorido com check/star |
| Estatísticas | Texto maior e mais visível |
| Botão Iniciar | Dentro do card, full-width, com ícone de play |
| Maior demanda | Destaque amarelo com aviso |
| Colunas Kanban | Headers com cores de fundo mais intensas |
