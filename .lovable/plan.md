
# Plano: Dropdown de Visualização do Mapeamento (Por Tipo, Categoria ou Produto)

## Contexto

A tabela de mapeamentos na aba "Mapeamento" mostra atualmente uma lista plana de todos os produtos. O usuário deseja um dropdown para escolher como visualizar os dados:

- **Por Produto** (atual) - Lista plana de todos os produtos
- **Por Tipo** - Agrupado por tipo (OPÇÃO, PRODUTO, etc.)
- **Por Categoria** - Agrupado por categoria (Refrigerantes, Recheios Suprema, etc.)

## Mudanças Propostas

### Arquivo: `src/pages/ConfigurarCardapioWeb.tsx`

#### 1. Adicionar Estado para Modo de Visualização

```typescript
const [modoVisualizacao, setModoVisualizacao] = useState<'produto' | 'tipo' | 'categoria'>('produto');
```

#### 2. Adicionar Dropdown de Visualização

Ao lado do seletor de loja, adicionar um segundo dropdown:

```typescript
<div className="flex items-center gap-2">
  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
  <Select value={modoVisualizacao} onValueChange={setModoVisualizacao}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Visualizar por..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="produto">Por Produto</SelectItem>
      <SelectItem value="tipo">Por Tipo</SelectItem>
      <SelectItem value="categoria">Por Categoria</SelectItem>
    </SelectContent>
  </Select>
</div>
```

#### 3. Criar Lógica de Agrupamento

```typescript
// Agrupar mapeamentos por tipo ou categoria
const mapeamentosVisualizacao = useMemo(() => {
  if (modoVisualizacao === 'produto') {
    return { grupos: null, items: mapeamentosFiltrados };
  }
  
  const grupos = new Map<string, MapeamentoCardapioItemAgrupado[]>();
  
  for (const item of mapeamentosFiltrados) {
    const chave = modoVisualizacao === 'tipo' 
      ? (item.tipo || 'Sem tipo')
      : (item.categoria || 'Sem categoria');
    
    if (!grupos.has(chave)) {
      grupos.set(chave, []);
    }
    grupos.get(chave)!.push(item);
  }
  
  // Ordenar grupos alfabeticamente
  return { 
    grupos: Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    items: null 
  };
}, [mapeamentosFiltrados, modoVisualizacao]);
```

#### 4. Renderização Condicional da Tabela

**Modo "Por Produto"** - Tabela simples (atual)

**Modo "Por Tipo" ou "Por Categoria"** - Tabela com seções colapsáveis:

```text
┌─────────────────────────────────────────────────────────────────┐
│ ▼ OPÇÃO (7 produtos)                                            │
├─────────────────────────────────────────────────────────────────┤
│   Refrigerantes | # 2 Refrigerantes... | 3543571 | Vincular...  │
│   Recheios...   | # Base da Massa...   | 3543827 | Vincular...  │
└─────────────────────────────────────────────────────────────────┘
│ ▼ PRODUTO (3 produtos)                                          │
├─────────────────────────────────────────────────────────────────┤
│   Pizzas        | # Pizza Margherita   | 3543111 | Vincular...  │
└─────────────────────────────────────────────────────────────────┘
```

Cada grupo terá:
- Header com nome do grupo e contagem de itens
- Opção de expandir/colapsar (usando Collapsible do Radix)
- Tabela interna com os produtos daquele grupo

---

## Fluxo do Usuário

1. Usuário seleciona a loja "Japiim"
2. Usuário muda o dropdown de "Por Produto" para "Por Tipo"
3. A tabela reorganiza mostrando grupos "OPÇÃO" e "PRODUTO" colapsáveis
4. Usuário pode clicar em cada grupo para expandir/colapsar

---

## Detalhes Técnicos

### Componentes Utilizados
- `Select` (Radix) - Dropdown de seleção
- `Collapsible` (Radix) - Seções colapsáveis por grupo
- `ChevronDown`/`ChevronRight` (Lucide) - Indicadores de expansão

### Estados Adicionais
```typescript
const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());

const toggleGrupo = (grupo: string) => {
  setGruposExpandidos(prev => {
    const novo = new Set(prev);
    if (novo.has(grupo)) {
      novo.delete(grupo);
    } else {
      novo.add(grupo);
    }
    return novo;
  });
};
```

### Inicialização
- Todos os grupos iniciam expandidos por padrão
- Estado é resetado quando troca de loja

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ConfigurarCardapioWeb.tsx` | Adicionar dropdown de visualização e lógica de agrupamento |

