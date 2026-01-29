
# Plano: Corrigir Lógica do Indicador "Estoque CPD Suficiente"

## Problema

O indicador "Estoque CPD Suficiente" está aparecendo de forma incorreta porque:

1. **Lógica atual**: Mostra o indicador quando a coluna "A PRODUZIR" está vazia e o CPD tem **qualquer** estoque > 0
2. **Lógica correta**: Deveria mostrar apenas quando o estoque CPD é **suficiente para cobrir a demanda das lojas** para cada item

Exemplo do problema:
- CARNE: Demanda da loja = 50 un, Estoque CPD = 30 un → **Deveria produzir 20 un**, mas o indicador mostra "suficiente"

## Solução

### Mudança Conceitual

O indicador deve comparar **por item**:
- `Saldo Líquido = Demanda das Lojas - Estoque CPD`
- Se **todos** os itens com demanda têm `Saldo Líquido <= 0` → Mostrar indicador verde
- Se **qualquer** item tem `Saldo Líquido > 0` → Cards de produção devem existir (não mostrar indicador)

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ResumoDaProducao.tsx` | Buscar demandas das lojas junto com estoque CPD e calcular saldo líquido |
| `src/components/kanban/CPDStockIndicator.tsx` | Mostrar detalhes de demanda vs estoque por item |
| `src/components/kanban/ProductGroupedStacks.tsx` | Receber dados de demanda e verificar se realmente não há produção necessária |

### Alterações Técnicas

#### 1. ResumoDaProducao.tsx - Buscar Demandas e Estoque

Modificar a busca de estoque CPD para incluir comparação com demandas:

```typescript
// Estado ampliado para incluir saldo líquido
interface EstoqueCPDItem {
  item_nome: string;
  item_id: string;
  estoque_cpd: number;
  demanda_lojas: number;
  saldo_liquido: number; // demanda - estoque (negativo = suficiente)
}

const [estoqueCPD, setEstoqueCPD] = useState<EstoqueCPDItem[]>([]);

// Na função loadProducaoRegistros, após buscar estoque CPD:

// 1. Buscar estoque CPD
const { data: estoqueCPDData } = await supabase
  .from('contagem_porcionados')
  .select('item_porcionado_id, final_sobra, itens_porcionados!inner(nome)')
  .eq('loja_id', cpdLoja.id)
  .eq('dia_operacional', hoje);

// 2. Buscar demandas das lojas (tipo != 'cpd')
const lojasNaoCPD = lojasData?.filter(l => l.tipo !== 'cpd').map(l => l.id) || [];
const { data: demandasData } = await supabase
  .from('contagem_porcionados')
  .select('item_porcionado_id, a_produzir, itens_porcionados!inner(nome)')
  .in('loja_id', lojasNaoCPD)
  .eq('dia_operacional', hoje)
  .gt('a_produzir', 0);

// 3. Agregar demandas por item
const demandasPorItem = new Map<string, { nome: string; demanda: number }>();
demandasData?.forEach(d => {
  const itemId = d.item_porcionado_id;
  const nome = (d.itens_porcionados as any).nome;
  if (!demandasPorItem.has(itemId)) {
    demandasPorItem.set(itemId, { nome, demanda: 0 });
  }
  demandasPorItem.get(itemId)!.demanda += d.a_produzir;
});

// 4. Calcular saldo líquido por item
const estoqueCPDMap = new Map<string, number>();
estoqueCPDData?.forEach(e => {
  estoqueCPDMap.set(e.item_porcionado_id, e.final_sobra || 0);
});

// 5. Montar lista final com saldo líquido
const estoqueComSaldo: EstoqueCPDItem[] = [];
demandasPorItem.forEach((dados, itemId) => {
  const estoque = estoqueCPDMap.get(itemId) || 0;
  estoqueComSaldo.push({
    item_id: itemId,
    item_nome: dados.nome,
    estoque_cpd: estoque,
    demanda_lojas: dados.demanda,
    saldo_liquido: dados.demanda - estoque, // negativo = suficiente
  });
});

// Também incluir itens que têm estoque mas sem demanda (100% suficiente)
estoqueCPDData?.forEach(e => {
  const itemId = e.item_porcionado_id;
  if (!demandasPorItem.has(itemId) && e.final_sobra > 0) {
    estoqueComSaldo.push({
      item_id: itemId,
      item_nome: (e.itens_porcionados as any).nome,
      estoque_cpd: e.final_sobra,
      demanda_lojas: 0,
      saldo_liquido: -e.final_sobra, // negativo = sobra de estoque
    });
  }
});

setEstoqueCPD(estoqueComSaldo);
```

#### 2. ProductGroupedStacks.tsx - Lógica de Exibição

Modificar a condição de exibição do indicador:

```typescript
interface EstoqueCPDItem {
  item_nome: string;
  item_id: string;
  estoque_cpd: number;
  demanda_lojas: number;
  saldo_liquido: number;
}

interface ProductGroupedStacksProps {
  // ... props existentes
  estoquesCPD?: EstoqueCPDItem[];
}

// Na renderização:
if (filteredRegistros.length === 0) {
  // Verificar se há itens com estoque suficiente (saldo_liquido <= 0)
  const itensComEstoqueSuficiente = estoquesCPD?.filter(e => 
    e.demanda_lojas > 0 && e.saldo_liquido <= 0
  ) || [];
  
  // Só mostrar indicador se há itens com demanda E estoque cobrindo
  if (columnId === 'a_produzir' && itensComEstoqueSuficiente.length > 0) {
    return <CPDStockIndicator estoquesCPD={itensComEstoqueSuficiente} />;
  }
  
  return (/* mensagem padrão */);
}
```

#### 3. CPDStockIndicator.tsx - Exibir Demanda vs Estoque

Atualizar o componente para mostrar claramente a comparação:

```typescript
interface CPDStockItem {
  item_nome: string;
  item_id: string;
  estoque_cpd: number;
  demanda_lojas: number;
  saldo_liquido: number;
}

// Renderização atualizada:
<div className="flex items-center justify-between px-3 py-2 text-sm">
  <span className="text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
    {item.item_nome}
  </span>
  <div className="flex items-center gap-2 text-xs">
    <span className="text-muted-foreground">
      Demanda: {item.demanda_lojas}
    </span>
    <Badge className="bg-emerald-100 text-emerald-700">
      Estoque: {item.estoque_cpd}
    </Badge>
  </div>
</div>
```

### Fluxo Corrigido

```
loadProducaoRegistros()
       │
       ├─► Buscar estoque CPD (final_sobra)
       │
       ├─► Buscar demandas das lojas (a_produzir onde tipo != 'cpd')
       │
       ├─► Calcular saldo líquido por item
       │         └── saldo = demanda - estoque
       │
       └─► Passar para ProductGroupedStacks
                 │
                 └─► Se coluna vazia + itens com saldo_liquido <= 0:
                           └── Mostrar CPDStockIndicator
                     Se coluna vazia + sem itens ou saldo > 0:
                           └── Mensagem padrão "Nenhum item"
```

### Cenários de Exibição

| Cenário | Demanda | Estoque CPD | Saldo | Indicador |
|---------|---------|-------------|-------|-----------|
| Estoque cobre demanda | 50 | 99 | -49 | **Mostra "Suficiente"** |
| Estoque igual demanda | 50 | 50 | 0 | **Mostra "Suficiente"** |
| Estoque insuficiente | 100 | 50 | +50 | Card de produção existe |
| Sem demanda, com estoque | 0 | 99 | -99 | Mostra (estoque disponível) |
| Sem demanda, sem estoque | 0 | 0 | 0 | Mensagem padrão |

### Informações Exibidas no Indicador

O indicador atualizado mostrará:
- Título: "Estoque CPD Suficiente para Atender Demandas"
- Por item:
  - Nome do item
  - Demanda total das lojas
  - Estoque disponível no CPD
  - Saldo (quanto sobra após atender)
- Total de itens e unidades cobertas

### Resultado Esperado

1. O indicador só aparece quando realmente não há produção necessária
2. Mostra claramente a comparação demanda vs estoque
3. Se algum item precisa ser produzido (saldo > 0), os cards de produção aparecem normalmente
4. Alinhamento com a arquitetura documentada: `Saldo Líquido = Demanda - Estoque CPD`
