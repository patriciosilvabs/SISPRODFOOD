
# Plano: Reorganizar Layout em Colunas Fixas com Headers

## Objetivo

Reorganizar o `ContagemItemCard` para seguir um layout tabular com colunas fixas e nomes de coluna visíveis, conforme a imagem de referência:

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│  UNIDADE ALEIXO          SOBRA      EST. IDEAL    C. WEB    PRODUZIR    LOTES      │
│  ✓ MASSA - PORCIONADO     250          250         100        150         4        │
│  Atualizado: 03/02 11:39                                                           │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## Mudanças no Código

### Arquivo: `src/components/contagem/ContagemItemCard.tsx`

#### Nova Estrutura do Layout

```tsx
<div className="...">
  {/* Área do Nome (lado esquerdo) */}
  <div className="flex-shrink-0 min-w-[200px]">
    <p className="text-xs text-primary font-medium">{lojaNome}</p>
    <div className="flex items-center gap-2">
      {campoTocado && <CheckCircle className="h-4 w-4 text-success" />}
      <span className="font-semibold text-sm uppercase">{item.nome}</span>
    </div>
    <p className="text-xs text-muted-foreground">Atualizado: ...</p>
  </div>

  {/* Grid de Colunas Fixas */}
  <div className="grid grid-cols-5 gap-2 flex-1">
    {/* SOBRA */}
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-gray-500 uppercase font-medium mb-1">SOBRA</span>
      <div className="flex items-center">
        <Button>-</Button>
        <input value={finalSobra} />
        <Button>+</Button>
      </div>
    </div>

    {/* EST. IDEAL */}
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-gray-500 uppercase font-medium mb-1">EST. IDEAL</span>
      <div className="bg-gray-100 rounded-lg px-4 py-2 min-w-[80px] text-center">
        <span className="text-lg font-bold">{idealFromConfig}</span>
      </div>
    </div>

    {/* C. WEB */}
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-gray-500 uppercase font-medium mb-1">C. WEB</span>
      <div className="bg-gray-100 rounded-lg px-4 py-2 min-w-[80px] text-center">
        <span className="text-lg font-bold">{cardapioWebBaixaTotal || 0}</span>
      </div>
    </div>

    {/* PRODUZIR */}
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-gray-500 uppercase font-medium mb-1">PRODUZIR</span>
      <div className="bg-gray-100 rounded-lg px-4 py-2 min-w-[80px] text-center">
        <span className="text-lg font-bold">{aProduzir}</span>
      </div>
    </div>

    {/* LOTES (condicional) */}
    {isLoteMasseira && (
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-gray-500 uppercase font-medium mb-1">LOTES</span>
        <div className="bg-gray-100 rounded-lg px-4 py-2 min-w-[80px] text-center">
          <span className="text-lg font-bold">{lotesNecessarios}</span>
        </div>
      </div>
    )}
  </div>
</div>
```

## Características do Novo Layout

| Coluna | Descrição | Estilo |
|--------|-----------|--------|
| **SOBRA** | Controle com botões +/- | Interativo (botões azuis) |
| **EST. IDEAL** | Estoque ideal do dia | Fundo cinza, somente leitura |
| **C. WEB** | Baixas do Cardápio Web | Fundo cinza, sempre visível (0 se não houver) |
| **PRODUZIR** | Quantidade a produzir | Fundo cinza (laranja se > 0) |
| **LOTES** | Lotes necessários | Só aparece para itens `lote_masseira` |

## Pontos Principais

1. **Grid com colunas fixas**: Usar CSS Grid com `grid-cols-5` para alinhamento consistente
2. **Headers sempre visíveis**: Cada coluna terá seu nome acima do valor
3. **C. WEB sempre visível**: Mostrar 0 quando não houver baixas (não esconder a coluna)
4. **Estilo uniforme**: Caixas com fundo cinza claro para valores somente leitura
5. **Responsividade**: Em mobile, stack vertical; em desktop, layout horizontal

## Arquivo Modificado

- `src/components/contagem/ContagemItemCard.tsx`
