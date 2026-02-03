
# Plano: Mapeamento Inverso (Insumo → Produtos)

## Problema Atual

O fluxo atual é **Produto → Insumo**:
1. Usuário vê lista de 500+ produtos do cardápio
2. Para cada produto, escolhe qual item porcionado vincular
3. Se 100 pizzas consomem "CALABRESA", precisa fazer 100 cliques

## Solução Proposta

Adicionar um **fluxo inverso: Insumo → Produtos**:
1. Usuário seleciona "CALABRESA - PORCIONADO"
2. Digita "calabresa" na busca
3. Sistema mostra todos os produtos que contêm "calabresa" no nome
4. Usuário marca os desejados e define quantidade
5. Com 1 clique, vincula todos

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  Mapear por Insumo                                                    [X] │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Item Porcionado:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ CALABRESA - PORCIONADO                                         ▼   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Buscar produtos:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 calabresa                                                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Produtos encontrados (8):                             [✓ Selecionar Todos]│
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ Pizza Calabresa G          [Código: 3541758]        Qtd: [1]      │  │
│  │ ☑ Pizza Calabresa M          [Código: 3541759]        Qtd: [1]      │  │
│  │ ☑ Pizza Calabresa P          [Código: 3541760]        Qtd: [0.5]    │  │
│  │ ☐ Brotinho Calabresa         [Código: 3541801]        Qtd: [1]      │  │
│  │ ☑ Pizza Calabresa c/ Cebola  [Código: 3541812]        Qtd: [1]      │  │
│  │ ...                                                                 │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ℹ️ 5 produtos selecionados serão vinculados a CALABRESA - PORCIONADO     │
│                                                                           │
│                                    [Cancelar]  [Confirmar 5 Vínculos]      │
└───────────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **Novo:** `src/components/modals/MapearPorInsumoModal.tsx` | Modal principal do fluxo inverso |
| `src/pages/ConfigurarCardapioWeb.tsx` | Adicionar botão "Mapear por Insumo" na aba Mapeamento |
| `src/hooks/useCardapioWebIntegracao.ts` | Adicionar mutation `vincularPorInsumo` para batch insert |

## Detalhes Técnicos

### 1. Novo Modal: `MapearPorInsumoModal.tsx`

**Props:**
```typescript
interface MapearPorInsumoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itensPorcionados: { id: string; nome: string }[];
  produtosDisponiveis: MapeamentoCardapioItemAgrupado[]; // Produtos da loja
  lojaId: string;
  onConfirm: (data: {
    item_porcionado_id: string;
    produtos: Array<{
      cardapio_item_id: number;
      cardapio_item_nome: string;
      tipo: string | null;
      categoria: string | null;
      quantidade_consumida: number;
    }>;
  }) => Promise<void>;
  isLoading?: boolean;
}
```

**Estado interno:**
```typescript
const [itemPorcionadoSelecionado, setItemPorcionadoSelecionado] = useState<string>('');
const [termoBusca, setTermoBusca] = useState('');
// Map: cardapio_item_id -> quantidade
const [produtosSelecionados, setProdutosSelecionados] = useState<Map<number, number>>(new Map());
```

**Lógica de busca:**
```typescript
const produtosFiltrados = useMemo(() => {
  if (!termoBusca.trim()) return [];
  
  const termo = termoBusca.toLowerCase().trim();
  return produtosDisponiveis.filter(p => 
    p.cardapio_item_nome.toLowerCase().includes(termo)
  );
}, [produtosDisponiveis, termoBusca]);
```

### 2. Mutation no Hook: `vincularPorInsumo`

```typescript
const vincularPorInsumo = useMutation({
  mutationFn: async ({
    loja_id,
    item_porcionado_id,
    produtos
  }: {
    loja_id: string;
    item_porcionado_id: string;
    produtos: Array<{
      cardapio_item_id: number;
      cardapio_item_nome: string;
      tipo: string | null;
      categoria: string | null;
      quantidade_consumida: number;
    }>;
  }) => {
    if (!organizationId) throw new Error('Organização não encontrada');
    
    // Para cada produto, verifica se já existe vínculo com este item porcionado
    // Se não existir, cria novo registro
    const inserts = produtos.map(p => ({
      organization_id: organizationId,
      loja_id,
      cardapio_item_id: p.cardapio_item_id,
      cardapio_item_nome: p.cardapio_item_nome,
      tipo: p.tipo,
      categoria: p.categoria,
      item_porcionado_id,
      quantidade_consumida: p.quantidade_consumida,
      ativo: true
    }));
    
    // Usa upsert para evitar duplicatas
    const { data, error } = await supabase
      .from('mapeamento_cardapio_itens')
      .upsert(inserts, {
        onConflict: 'organization_id,loja_id,cardapio_item_id,item_porcionado_id',
        ignoreDuplicates: false
      })
      .select();
    
    if (error) throw error;
    return data;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
    toast.success(`${data?.length || 0} produtos vinculados com sucesso!`);
  }
});
```

### 3. Botão na Interface

Na aba "Mapeamento", adicionar botão ao lado dos existentes:

```tsx
<Button 
  variant="outline" 
  onClick={() => setMapearPorInsumoModalOpen(true)}
  disabled={!lojaIdMapeamento || mapeamentosFiltrados.length === 0}
>
  <Link2 className="h-4 w-4 mr-2" />
  Mapear por Insumo
</Button>
```

## Fluxo de Uso

1. **Admin importa produtos** do Cardápio Web (CSV) - já existente
2. **Admin abre modal "Mapear por Insumo"**
3. **Seleciona item porcionado** (ex: CALABRESA)
4. **Digita termo de busca** (ex: "calabresa")
5. **Sistema filtra produtos** que contêm o termo
6. **Admin marca produtos desejados** e define quantidade para cada
7. **Clica "Confirmar"** - sistema cria vínculos em batch
8. **Repete** para outros insumos (MUSSARELA, PRESUNTO, etc.)

## Considerações

**Validações:**
- Mostrar aviso se produto já está vinculado ao item selecionado
- Permitir sobrescrever quantidade se vínculo já existir

**Performance:**
- Busca local (já temos todos os produtos em memória)
- Mínimo de 2 caracteres para iniciar busca
- Limitar resultados a 50 itens para performance visual

**UX:**
- "Selecionar Todos" para marcar todos os resultados filtrados
- Quantidade padrão = 1 (editável individualmente)
- Mostrar badge indicando se produto já tem vínculo com outro insumo
