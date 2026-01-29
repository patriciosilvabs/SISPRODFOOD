
# Plano: Indicador Visual de Estoque Suficiente no CPD

## Contexto

O operador do CPD precisa saber quando a coluna "A PRODUZIR" está vazia porque **já existe estoque suficiente no CPD** para atender as demandas das lojas. Atualmente, quando não há cards na coluna, a mensagem genérica "Nenhum item nesta coluna" não fornece essa informação importante.

## Lógica do Sistema (Arquitetura Existente)

Segundo a documentação do projeto:
- **Saldo Líquido** = Demanda das Lojas - Estoque CPD (`final_sobra` do dia atual)
- Cards de produção só são gerados quando Saldo Líquido > 0
- Se o CPD já possui estoque suficiente, **nenhum card é criado**

Portanto, quando a coluna está vazia, pode significar:
1. **Nenhuma loja enviou contagem ainda** (aguardando demandas)
2. **CPD já tem estoque suficiente** (cenário que o operador precisa visualizar)

## Solução Proposta

Adicionar um indicador visual especial na coluna "A PRODUZIR" quando ela está vazia mas o CPD tem estoque registrado. O indicador mostrará:
- Ícone de check verde
- Mensagem: "Estoque CPD suficiente"
- Lista dos itens com estoque disponível no CPD

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/kanban/CPDStockIndicator.tsx` | **CRIAR** - Novo componente de indicador |
| `src/pages/ResumoDaProducao.tsx` | **MODIFICAR** - Buscar estoque CPD e passar ao componente |
| `src/components/kanban/ProductGroupedStacks.tsx` | **MODIFICAR** - Exibir indicador quando coluna vazia + estoque CPD disponível |

## Alterações Técnicas

### 1. Novo Componente: CPDStockIndicator.tsx

```typescript
// Componente que mostra quando CPD tem estoque suficiente
// Exibido quando coluna "A PRODUZIR" está vazia

interface CPDStockItem {
  item_nome: string;
  quantidade: number;
}

interface CPDStockIndicatorProps {
  estoquesCPD: CPDStockItem[];
  totalItens: number;
  totalUnidades: number;
}

// Renderiza:
// - Badge verde "Estoque suficiente"
// - Ícone PackageCheck
// - Lista colapsável com itens e quantidades
// - Total de itens e unidades disponíveis
```

### 2. ResumoDaProducao.tsx

Buscar estoque CPD na função `loadProducaoRegistros`:

```typescript
// Dentro de loadProducaoRegistros, após buscar lojas:

// Buscar estoque atual do CPD (final_sobra > 0 do dia atual)
const { data: estoqueCPDData } = await supabase
  .from('contagem_porcionados')
  .select(`
    item_porcionado_id,
    final_sobra,
    itens_porcionados!inner(nome)
  `)
  .eq('loja_id', cpdLoja?.id)
  .eq('dia_operacional', hoje)
  .gt('final_sobra', 0);

// Transformar em lista para o indicador
const estoquesCPD = estoqueCPDData?.map(e => ({
  item_nome: e.itens_porcionados.nome,
  quantidade: e.final_sobra,
})) || [];

setEstoqueCPD(estoquesCPD);
```

Novo estado:
```typescript
const [estoqueCPD, setEstoqueCPD] = useState<Array<{ item_nome: string; quantidade: number }>>([]);
```

### 3. ProductGroupedStacks.tsx

Adicionar prop e lógica de exibição:

```typescript
interface ProductGroupedStacksProps {
  // ... props existentes
  estoquesCPD?: Array<{ item_nome: string; quantidade: number }>;
}

// Na renderização quando filteredRegistros.length === 0:
if (filteredRegistros.length === 0) {
  // Se tem estoque CPD, mostrar indicador especial
  if (estoquesCPD && estoquesCPD.length > 0) {
    return <CPDStockIndicator estoquesCPD={estoquesCPD} />;
  }
  
  // Caso contrário, mensagem padrão
  return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
      {lojaFiltradaId ? 'Nenhum item para esta loja' : 'Nenhum item nesta coluna'}
    </div>
  );
}
```

## Design Visual do Indicador

```
┌─────────────────────────────────────────────┐
│  ✓ Estoque CPD Suficiente                  │
│  ─────────────────────────────────          │
│  📦 5 itens • 127 unidades disponíveis      │
│                                             │
│  ▼ Ver itens em estoque                     │
│  ┌─────────────────────────────────────┐   │
│  │ BACON PORCIONADO          67 un     │   │
│  │ CALABRESA FATIADA         32 un     │   │
│  │ PRESUNTO FATIA FINA       18 un     │   │
│  │ MUSSARELA RALADA          10 un     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  💡 Nenhuma produção necessária agora       │
└─────────────────────────────────────────────┘
```

Cores: 
- Fundo: `bg-emerald-50 dark:bg-emerald-950/30`
- Borda: `border-emerald-300 dark:border-emerald-700`
- Ícone e texto: `text-emerald-700 dark:text-emerald-300`

## Fluxo de Dados

```
loadProducaoRegistros()
         │
         ├─► Busca producao_registros (cards)
         │
         ├─► Busca contagem_porcionados do CPD
         │      └── Filtra: dia_operacional = hoje
         │      └── Filtra: final_sobra > 0
         │
         └─► Passa estoquesCPD para ProductGroupedStacks
                  │
                  └─► Se coluna vazia + estoque > 0:
                            └── Renderiza CPDStockIndicator
```

## Comportamento Esperado

| Cenário | Coluna "A PRODUZIR" | Exibição |
|---------|---------------------|----------|
| Sem demanda + Sem estoque CPD | Vazia | "Nenhum item nesta coluna" |
| Sem demanda + Com estoque CPD | Vazia | **Indicador verde com lista de estoque** |
| Com demanda (cards gerados) | Cards visíveis | Cards normais |
| Loja filtrada sem itens + CPD tem estoque | Vazia | **Indicador verde** |

## Impacto

- **UX melhorada**: Operador sabe imediatamente que não há trabalho porque o estoque está ok
- **Visibilidade**: Lista mostra exatamente quais itens e quantidades estão disponíveis
- **Zero impacto em lógica existente**: Apenas adiciona visualização
- **Consistente com design**: Usa padrões visuais já existentes (cores emerald para sucesso)
