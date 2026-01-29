

# Plano: Ajustar Interface de Porcionados para CPD

## Objetivo

Modificar a página de Contagem de Porcionados para que, quando o usuário estiver no CPD:

1. **Remover a aba "Contagem"** - CPD não é loja, não precisa fazer contagem
2. **Renomear título da página** - De "Contagem de Porcionados" para "Estoque de Porcionados"
3. **Ir direto para a funcionalidade de ajuste** - Sem abas, apenas a interface de ajuste de estoque

---

## Análise Atual

Atualmente em `ContagemPorcionados.tsx` (linhas 908-913):

```tsx
{canAdjustStock && cpdLoja ? (
  <Tabs value={activeTab} onValueChange={...}>
    <TabsList>
      <TabsTrigger value="contagem">Contagem</TabsTrigger>
      <TabsTrigger value="ajuste">Ajustar Estoque</TabsTrigger>
    </TabsList>
    ...
  </Tabs>
) : ( ... )}
```

E no header (`ContagemPageHeader.tsx`):

```tsx
<h1>Contagem de Porcionados</h1>
<p>Registre a sobra do dia e acompanhe a demanda de produção</p>
```

---

## Solução

### Lógica de Exibição

```text
┌─────────────────────────────────────────────────────────────────┐
│                    USUÁRIO É EXCLUSIVAMENTE CPD?                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SIM (apenas CPD, sem lojas):                                  │
│   ├── Título: "Estoque de Porcionados"                          │
│   ├── Subtítulo: "Visualize e ajuste o estoque de porcionados"  │
│   ├── SEM abas (mostrar direto o ajuste de estoque)             │
│   └── Renderizar apenas: <AjusteEstoquePorcionadosCPD />        │
│                                                                 │
│   NÃO (tem lojas OU é admin com acesso a tudo):                 │
│   ├── Título: "Contagem de Porcionados"                         │
│   ├── Subtítulo: "Registre a sobra do dia..."                   │
│   ├── Mostrar abas se tiver acesso CPD                          │
│   └── Contagem normal + opção de ajuste                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/ContagemPorcionados.tsx` | Lógica condicional para detectar usuário exclusivo CPD e renderizar interface apropriada |
| `src/components/contagem/ContagemPageHeader.tsx` | Adicionar prop para alternar título/subtítulo baseado no contexto CPD |

---

## Detalhes Técnicos

### 1. ContagemPageHeader.tsx

Adicionar novas props:
- `isCPDOnly: boolean` - indica se é exclusivamente CPD
- Título condicional: "Estoque de Porcionados" vs "Contagem de Porcionados"
- Subtítulo condicional

### 2. ContagemPorcionados.tsx

Detectar se usuário é exclusivamente CPD:

```tsx
// Usuário só tem CPD (sem lojas normais)
const lojasNormais = lojas.filter(l => l.tipo !== 'cpd');
const isCPDOnly = isCPDUser && lojasNormais.length === 0;
```

Renderização condicional:
- Se `isCPDOnly`: renderizar apenas `<AjusteEstoquePorcionadosCPD />` sem abas
- Caso contrário: manter comportamento atual com abas (para admins que têm acesso a tudo)

---

## Resultado Esperado

### Para usuário exclusivo CPD:
- Título: **"Estoque de Porcionados"**
- Subtítulo: **"Visualize e ajuste o estoque de porcionados do CPD"**
- Interface: Direto para o componente de ajuste, sem abas

### Para Admin/usuários com acesso a lojas:
- Comportamento atual mantido
- Abas "Contagem" e "Ajustar Estoque" quando aplicável

