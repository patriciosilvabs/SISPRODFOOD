

# Plano: Modal Multi-Seleção no Primeiro Vínculo

## Problema Identificado

O código atual tem **dois fluxos diferentes**:

| Situação | Interface Atual | Interface Esperada |
|----------|----------------|-------------------|
| Primeiro vínculo | Select dropdown (1 item) | Modal com checkboxes |
| Vínculos adicionais | Modal com checkboxes | Modal com checkboxes |

O modal com multi-seleção só aparece após já existir um vínculo. O primeiro vínculo usa um dropdown simples.

## Solução

Substituir o `<Select>` dropdown do primeiro vínculo por um **botão que abre o mesmo modal** de multi-seleção.

## Arquivo a Modificar

`src/pages/ConfigurarCardapioWeb.tsx`

### Mudança no `MapeamentoTableRow`

**Antes (linhas 99-131):**
```tsx
{produto.vinculos.length === 0 || (produto.vinculos.length === 1 && !produto.vinculos[0].item_porcionado_id) ? (
  <Select ...>
    {/* Dropdown simples que só permite 1 item */}
  </Select>
) : (
```

**Depois:**
```tsx
{produto.vinculos.length === 0 || (produto.vinculos.length === 1 && !produto.vinculos[0].item_porcionado_id) ? (
  // Botão que abre o modal de multi-seleção
  <Button
    variant="outline"
    size="sm"
    className="h-8 border-dashed border-primary/50 w-full justify-start"
    onClick={() => onAbrirModalVinculo(produto)}
  >
    <Plus className="h-3.5 w-3.5 mr-1.5" />
    Vincular itens...
  </Button>
) : (
```

## Resultado Esperado

1. Usuário vê produto sem vínculos
2. Clica em **"Vincular itens..."**
3. Modal abre com **checkboxes** para marcar múltiplos itens
4. Usuário seleciona MASSA (1x), MUSSARELA (1x), CALABRESA (2x)
5. Confirma todos de uma vez

## Fluxo Visual

```text
┌────────────────────────────────────────────────────┐
│ Produto: Pizza Calabresa G                         │
│ Código: 3572283                                    │
│ Vínculos: [Vincular itens...]  ← Botão (não dropdown) │
└────────────────────────────────────────────────────┘
                    │
                    ▼ (clique)
┌────────────────────────────────────────────────────┐
│  Vincular Itens ao Produto                     [X] │
│                                                    │
│  ☑ MASSA - PORCIONADO              Qtd: [1]       │
│  ☑ MUSSARELA - PORCIONADO          Qtd: [1]       │
│  ☑ CALABRESA - PORCIONADO          Qtd: [2]       │
│  ☐ BACON - PORCIONADO                             │
│                                                    │
│            [Cancelar]  [Confirmar 3 Vínculos]     │
└────────────────────────────────────────────────────┘
```

## Benefícios

- **Consistência**: Mesma interface para primeiro e subsequentes vínculos
- **Eficiência**: Vincular múltiplos itens desde o início
- **Controle**: Definir quantidades individuais desde o primeiro vínculo

