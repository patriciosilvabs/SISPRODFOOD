
# Plano: Botão "Criar Romaneio" com Seleção de Loja e Itens

## Objetivo

Adicionar um botão "Criar Romaneio" na tela de Romaneio que abre um drawer/modal onde o usuário:
1. Seleciona a loja de destino
2. Adiciona itens porcionados disponíveis no estoque CPD
3. Informa quantidade (limitada ao estoque disponível)
4. Cria o romaneio manualmente

## Comportamento Atual

Atualmente a interface mostra:
- Grid de lojas com status de demanda
- Usuário clica na loja para ver/criar romaneio
- Itens disponíveis baseados nas demandas existentes

## Comportamento Proposto

```text
┌─────────────────────────────────────────────────────────────┐
│ Romaneio de Porcionados                                     │
│ Gestão de remessas de itens porcionados do CPD para lojas   │
├─────────────────────────────────────────────────────────────┤
│ [Enviar] [Receber] [Histórico] [Avulso]                     │
│                                                             │
│                              [+ Criar Romaneio] [Atualizar] │
│                                                             │
│ ┌──────── Estoque Disponível no CPD ────────┐              │
│ │ MASSA - PORCIONADO: 100 un                │              │
│ └───────────────────────────────────────────┘              │
│                                                             │
│ Selecione a Loja para Romaneio (4 lojas)                    │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

Ao clicar em "Criar Romaneio":

```text
┌─────────────────────────────────────────────────────────────┐
│ Criar Novo Romaneio                                      X  │
├─────────────────────────────────────────────────────────────┤
│ Loja Destino:                                               │
│ [ Selecione a loja ▼ ]                                      │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ Adicionar Item:                                             │
│ [ Selecione o item ▼ ]     [ 10 ] un    [+ Adicionar]      │
│ Estoque CPD: 100 un                                         │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ Itens do Romaneio (2):                                      │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ MASSA - PORCIONADO           45 un          [🗑️]     │  │
│ │ ESFIHA DE FRANGO             30 un          [🗑️]     │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│                                                             │
│ [Cancelar]                           [Criar Romaneio →]    │
└─────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Romaneio.tsx` | Adicionar botão "Criar Romaneio" e estados do drawer |
| `src/components/romaneio/CriarRomaneioDrawer.tsx` | **NOVO** - Componente drawer para criar romaneio |
| `src/components/romaneio/LojaSelectionGrid.tsx` | Opcional: ajustar layout para o novo botão |

## Detalhes Técnicos

### 1. Novo Componente: `CriarRomaneioDrawer.tsx`

```typescript
interface CriarRomaneioDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lojas: Loja[];
  estoqueCPD: EstoqueItem[];  // { item_id, item_nome, quantidade }
  onCriarRomaneio: (lojaId: string, itens: ItemRomaneio[]) => Promise<void>;
}
```

O componente incluirá:
- Select para escolher a loja destino
- Select para escolher item do estoque CPD
- Input numérico com `max={estoqueDisponivel}`
- Lista de itens adicionados com botão remover
- Botão "Criar Romaneio" que chama o handler

### 2. Estados Novos em `Romaneio.tsx`

```typescript
const [criarRomaneioOpen, setCriarRomaneioOpen] = useState(false);
```

### 3. Handler `handleCriarRomaneioManual`

```typescript
const handleCriarRomaneioManual = async (lojaId: string, itens: ItemRomaneio[]) => {
  // 1. Criar romaneio com status 'aguardando_conferencia'
  // 2. Adicionar itens ao romaneio_itens
  // 3. Fechar drawer e atualizar lista
  // 4. Redirecionar para o fluxo de conferência (peso/volumes)
};
```

### 4. Buscar Estoque CPD Disponível

Reutilizar os dados já existentes em `estoqueCPDResumo`, mas com mais detalhes:

```typescript
interface EstoqueItemCPD {
  item_porcionado_id: string;
  item_nome: string;
  quantidade_disponivel: number;
}
```

### 5. Validações

- Loja destino obrigatória
- Pelo menos 1 item no romaneio
- Quantidade não pode exceder estoque CPD
- Validação em tempo real no input

## Fluxo Completo

```text
1. Usuário clica "Criar Romaneio"
   ↓
2. Drawer abre com select de lojas
   ↓
3. Usuário seleciona loja destino
   ↓
4. Usuário adiciona itens do estoque CPD
   - Select mostra apenas itens com estoque > 0
   - Input quantidade limitado ao máximo disponível
   ↓
5. Usuário clica "Criar Romaneio"
   ↓
6. Sistema cria romaneio com status 'aguardando_conferencia'
   ↓
7. Romaneio aparece na seção "Aguardando Conferência"
   ↓
8. Usuário informa peso e volumes para cada item
   ↓
9. Usuário envia o romaneio
```

## Benefícios

1. **Flexibilidade total**: Criar romaneio para qualquer loja, mesmo sem demanda prévia
2. **Controle de estoque**: Quantidade limitada ao disponível no CPD
3. **Workflow consistente**: Romaneio criado vai para conferência antes de envio
4. **UX simplificada**: Drawer mantém contexto da tela principal

## Observações

- O botão ficará ao lado do "Atualizar" na barra de ações
- O drawer usará o componente `Drawer` já existente no projeto (vaul)
- Os itens criados terão status 'aguardando_conferencia' para garantir que peso e volumes sejam informados antes do envio
