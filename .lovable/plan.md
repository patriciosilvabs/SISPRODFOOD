

# Plano: Melhorar Visualização de Acesso a Múltiplas Lojas

## ✅ Funcionalidade Já Existente

O sistema **já suporta** usuários com acesso a múltiplas lojas:

- **Tabela `lojas_acesso`**: Permite N:N entre usuários e lojas
- **Gerenciamento**: Admin pode marcar múltiplas lojas via checkboxes ao editar/convidar usuário
- **Páginas operacionais**: Funcionário vê todas as lojas vinculadas automaticamente

---

## Melhorias Propostas

### 1. Mostrar Nomes das Lojas na Tabela de Usuários

**Antes:** Mostra apenas número de lojas (ex: "3")
**Depois:** Mostra nomes ou tooltip com detalhes

### 2. Adicionar Botão "Selecionar Todas" no Modal

Permitir marcar/desmarcar todas as lojas de uma vez.

### 3. Exibir Lojas em Tooltip/Badge Expansível

Quando usuário tem muitas lojas, mostra badge que expande ao clicar.

---

## Mudanças Técnicas

### Arquivo: `src/pages/GerenciarUsuarios.tsx`

#### 1. Melhorar exibição na tabela (linhas 793-802)

```typescript
// ANTES
<TableCell>
  {usuario.lojas.length > 0 ? (
    <div className="flex items-center gap-1">
      <Store className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{usuario.lojas.length}</span>
    </div>
  ) : (
    <span className="text-muted-foreground text-sm">-</span>
  )}
</TableCell>

// DEPOIS
<TableCell>
  {usuario.lojas.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {usuario.lojas.slice(0, 2).map(loja => (
        <Badge key={loja.id} variant="outline" className="text-xs">
          {loja.tipo === 'cpd' ? <Factory className="h-3 w-3 mr-1" /> : <Store className="h-3 w-3 mr-1" />}
          {loja.nome}
        </Badge>
      ))}
      {usuario.lojas.length > 2 && (
        <Badge variant="secondary" className="text-xs">
          +{usuario.lojas.length - 2}
        </Badge>
      )}
    </div>
  ) : (
    <span className="text-muted-foreground text-sm">-</span>
  )}
</TableCell>
```

#### 2. Adicionar botão "Selecionar Todas" nos modais

```typescript
// No modal de edição/convite, acima da lista de lojas
<div className="flex justify-between items-center mb-2">
  <Label>Lojas</Label>
  <Button 
    variant="ghost" 
    size="sm"
    onClick={() => {
      const lojasDoTipo = lojas.filter(l => 
        selectedProfile === 'cpd' ? l.tipo === 'cpd' : l.tipo !== 'cpd'
      );
      const allSelected = lojasDoTipo.every(l => selectedLojas.includes(l.id));
      setSelectedLojas(allSelected ? [] : lojasDoTipo.map(l => l.id));
    }}
  >
    {/* Alterna entre selecionar todas / desmarcar todas */}
    Selecionar Todas
  </Button>
</div>
```

---

## Fluxo Visual

```text
┌────────────────────────────────────────────────────────────────┐
│ GERENCIAR USUÁRIOS                                             │
├────────────────────────────────────────────────────────────────┤
│ Nome       │ Email              │ Perfil │ Lojas               │
├────────────────────────────────────────────────────────────────┤
│ João Silva │ joao@empresa.com   │ 🏪 Loja │ [Aleixo] [Japiim]  │
│ Maria CPD  │ maria@empresa.com  │ 🏭 CPD  │ [CPD Central]      │
│ Pedro Mult │ pedro@empresa.com  │ 🏪 Loja │ [Aleixo] [+2]      │
└────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/GerenciarUsuarios.tsx` | Melhorar exibição de lojas na tabela + botão "Selecionar Todas" |

---

## Resultado

| Antes | Depois |
|-------|--------|
| Exibe apenas número de lojas | Exibe badges com nomes das lojas |
| Precisa marcar lojas uma a uma | Botão "Selecionar Todas" disponível |
| Confuso entender quais lojas | Visual claro com badges |

