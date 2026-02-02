
# Plano: Vinculação em Lote com Checkboxes

## Contexto

Atualmente, para vincular produtos do cardápio a itens porcionados, é necessário fazer um por um através do dropdown. Quando você tem dezenas de produtos (ex: 10 sabores de refrigerante que consomem o mesmo item "Copo"), isso é muito trabalhoso.

A ideia é adicionar checkboxes para selecionar múltiplos produtos e vinculá-los todos de uma vez ao mesmo item porcionado.

---

## Interface Proposta

### Estado Normal (sem seleção)
A tabela mostra os produtos normalmente, sem checkboxes visíveis.

### Modo de Seleção (com botão "Selecionar")
Quando ativado:
1. Aparece uma coluna de checkboxes à esquerda
2. Usuário marca os produtos que deseja vincular
3. Uma barra fixa aparece no rodapé mostrando quantos itens estão selecionados
4. Botão "Vincular Selecionados" abre um modal para escolher o item porcionado

```text
┌─────────────────────────────────────────────────────────────────┐
│  [✓] Selecionar Múltiplos                                       │
├─────────────────────────────────────────────────────────────────┤
│  [ ] │ OPÇÃO │ Refrigerantes │ 2 Refrigerantes...  │ 3543571   │
│  [✓] │ OPÇÃO │ Refrigerantes │ Coca-Cola 350ml     │ 3543572   │
│  [✓] │ OPÇÃO │ Refrigerantes │ Guaraná 350ml       │ 3543573   │
│  [✓] │ OPÇÃO │ Refrigerantes │ Fanta 350ml         │ 3543574   │
│  [ ] │ PROD  │ Pizzas        │ Pizza Margherita    │ 3543111   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  3 produtos selecionados    [Vincular Selecionados] [Cancelar]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fluxo do Usuário

1. Usuário clica em "Selecionar Múltiplos" (toggle)
2. Checkboxes aparecem em cada linha da tabela
3. Usuário marca os produtos desejados (ex: todos os refrigerantes)
4. Clica em "Vincular Selecionados"
5. Modal abre pedindo:
   - Item Porcionado (dropdown)
   - Quantidade Consumida (número)
6. Confirma e todos os produtos selecionados são vinculados ao mesmo item

---

## Mudanças no Código

### Arquivo: `src/pages/ConfigurarCardapioWeb.tsx`

#### 1. Novos Estados

```typescript
const [modoSelecao, setModoSelecao] = useState(false);
const [produtosSelecionados, setProdutosSelecionados] = useState<Set<number>>(new Set());
const [vinculoEmLoteModalOpen, setVinculoEmLoteModalOpen] = useState(false);
```

#### 2. Toggle de Modo Seleção

```typescript
<Button
  variant={modoSelecao ? "secondary" : "outline"}
  onClick={() => {
    setModoSelecao(!modoSelecao);
    setProdutosSelecionados(new Set());
  }}
>
  <CheckSquare className="h-4 w-4 mr-2" />
  {modoSelecao ? "Cancelar Seleção" : "Selecionar Múltiplos"}
</Button>
```

#### 3. Checkbox na Tabela

Adicionar coluna de checkbox quando `modoSelecao` está ativo:

```typescript
{modoSelecao && (
  <TableHead className="w-10">
    <Checkbox
      checked={produtosSelecionados.size === mapeamentosFiltrados.length}
      onCheckedChange={(checked) => {
        if (checked) {
          setProdutosSelecionados(new Set(mapeamentosFiltrados.map(p => p.cardapio_item_id)));
        } else {
          setProdutosSelecionados(new Set());
        }
      }}
    />
  </TableHead>
)}
```

#### 4. Barra de Ações Fixa

Quando há itens selecionados, mostrar barra fixa no rodapé:

```typescript
{modoSelecao && produtosSelecionados.size > 0 && (
  <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex items-center justify-center gap-4 z-50">
    <span className="text-sm">
      <strong>{produtosSelecionados.size}</strong> produto(s) selecionado(s)
    </span>
    <Button onClick={() => setVinculoEmLoteModalOpen(true)}>
      <Link2 className="h-4 w-4 mr-2" />
      Vincular Selecionados
    </Button>
    <Button variant="ghost" onClick={() => setProdutosSelecionados(new Set())}>
      Limpar Seleção
    </Button>
  </div>
)}
```

### Arquivo: `src/components/modals/VincularEmLoteModal.tsx` (Novo)

Modal para escolher o item porcionado e quantidade:

```typescript
interface VincularEmLoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quantidadeSelecionados: number;
  itensPorcionados: { id: string; nome: string }[];
  onConfirm: (itemPorcionadoId: string, quantidade: number) => Promise<void>;
  isLoading?: boolean;
}
```

O modal mostrará:
- Quantidade de produtos que serão vinculados
- Dropdown para selecionar o item porcionado
- Campo de quantidade consumida
- Botões Cancelar/Confirmar

### Arquivo: `src/hooks/useCardapioWebIntegracao.ts`

#### Nova Mutation: `vincularEmLote`

```typescript
const vincularEmLote = useMutation({
  mutationFn: async ({
    produtos,
    item_porcionado_id,
    quantidade_consumida,
    loja_id
  }: {
    produtos: MapeamentoCardapioItemAgrupado[];
    item_porcionado_id: string;
    quantidade_consumida: number;
    loja_id: string;
  }) => {
    // Para cada produto, criar ou atualizar o vínculo
    const operations = produtos.map(async (produto) => {
      // Se já tem um registro sem vínculo, atualiza
      if (produto.vinculos[0]?.id && !produto.vinculos[0].item_porcionado_id) {
        return supabase
          .from('mapeamento_cardapio_itens')
          .update({ item_porcionado_id, quantidade_consumida })
          .eq('id', produto.vinculos[0].id);
      }
      // Senão, cria um novo vínculo
      return supabase
        .from('mapeamento_cardapio_itens')
        .insert({
          organization_id: organizationId,
          loja_id,
          cardapio_item_id: produto.cardapio_item_id,
          cardapio_item_nome: produto.cardapio_item_nome,
          tipo: produto.tipo,
          categoria: produto.categoria,
          item_porcionado_id,
          quantidade_consumida,
          ativo: true
        });
    });
    
    await Promise.all(operations);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['cardapio-web-mapeamentos'] });
    toast.success('Vínculos criados com sucesso!');
  }
});
```

---

## Funcionalidades Extras

### Checkbox "Selecionar Todos" no Header
- Marca/desmarca todos os produtos visíveis na tabela atual

### Filtro Inteligente
- Quando agrupado por Tipo/Categoria, mostrar checkbox no header do grupo para selecionar todos daquele grupo

### Reset Automático
- Limpar seleção quando trocar de loja
- Limpar seleção quando trocar modo de visualização

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ConfigurarCardapioWeb.tsx` | Adicionar estados, toggle de seleção, checkboxes e barra de ações |
| `src/components/modals/VincularEmLoteModal.tsx` | Novo modal para vinculação em lote |
| `src/hooks/useCardapioWebIntegracao.ts` | Nova mutation `vincularEmLote` |

---

## Benefícios

1. **Eficiência**: Vincular 20 refrigerantes ao mesmo item em 3 cliques
2. **UX Familiar**: Padrão de seleção com checkbox usado em toda web
3. **Flexível**: Funciona com visualização por Produto, Tipo ou Categoria
4. **Seguro**: Confirmação antes de aplicar vínculos em lote
