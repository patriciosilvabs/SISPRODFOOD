
# Plano: Adicionar Produtos ao Mapeamento via Texto Simples

## Objetivo

Criar uma funcionalidade que permite ao usuário colar texto simples (como uma lista de produtos) diretamente em um textarea, e o sistema irá extrair e adicionar os produtos ao mapeamento do Cardápio Web.

## Cenário de Uso

O usuário quer adicionar rapidamente uma lista de produtos do cardápio sem precisar usar arquivo Excel ou CSV. Basta copiar/colar de qualquer fonte (planilha, documento, site) e o sistema interpreta automaticamente.

## Arquitetura da Solução

### 1. Novo Modal: `ImportarTextoCardapioModal.tsx`

Interface simples com:
- **Textarea** grande para colar o texto
- **Lógica de parsing** que detecta automaticamente o formato:
  - Linhas separadas por quebra de linha
  - Colunas separadas por tab, ponto-e-vírgula ou vírgula
  - Suporte a formato: `TIPO | CATEGORIA | NOME | CÓDIGO`
  - Suporte a formato simples: `NOME | CÓDIGO`
- **Preview** dos itens detectados antes de importar
- **Contador** de itens válidos encontrados

### 2. Integração na Página `ConfigurarCardapioWeb.tsx`

Adicionar um novo botão "Colar Texto" ao lado do botão "Importar Arquivo" na aba de Mapeamento.

## Fluxo do Usuário

```text
1. Usuário clica em "Colar Texto"
2. Modal abre com textarea vazio
3. Usuário cola texto (ex: copiado do Cardápio Web ou planilha)
4. Sistema detecta automaticamente formato e extrai produtos
5. Preview mostra itens encontrados
6. Usuário confirma → Produtos são adicionados ao mapeamento
```

## Formatos Suportados

O parser será flexível e detectará automaticamente:

**Formato Completo (4 colunas):**
```
PRODUTO	PIZZAS	Pizza de Calabresa	12345
PRODUTO	PIZZAS	Pizza Mussarela	12346
```

**Formato Simples (2 colunas):**
```
Pizza de Calabresa	12345
Pizza Mussarela	12346
```

**Formato Apenas Nome:**
```
Pizza de Calabresa - 12345
Pizza Mussarela (12346)
```

## Detalhes Técnicos

### Arquivo: `src/components/modals/ImportarTextoCardapioModal.tsx`

```tsx
interface ImportarTextoCardapioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: ParsedCardapioItem[]) => Promise<void>;
  isLoading?: boolean;
}

// Funções de parsing:
// - detectDelimiter(): detecta tab, ponto-e-vírgula ou vírgula
// - parseTextoSimples(): extrai produtos do texto colado
// - extrairCodigoDoNome(): tenta extrair código do nome (ex: "Pizza 12345" → código=12345)
```

### Arquivo: `src/pages/ConfigurarCardapioWeb.tsx`

Adicionar:
- Estado: `importarTextoModalOpen`
- Botão na toolbar: "Colar Texto" com ícone `ClipboardPaste`
- Importar e renderizar o novo modal

### Reutilização

O modal usará a mesma função `importarMapeamentos` do hook `useCardapioWebIntegracao.ts`, que já:
- Remove duplicatas
- Faz deduplicação por código
- Adiciona os itens sem vínculo para vincular depois

## UI do Modal

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Importar via Texto                                   [X]│
├─────────────────────────────────────────────────────────────┤
│  Cole o texto com os produtos do cardápio abaixo:           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  (textarea para colar texto)                        │   │
│  │                                                     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💡 Dica: Copie do Cardápio Web ou planilha                │
│     Formatos aceitos: Nome + Código separados por tab,      │
│     vírgula ou ponto-e-vírgula                              │
│                                                             │
│  ───────────────────────────────────────────────────────── │
│                                                             │
│  ✅ 25 itens encontrados                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ TIPO    │ CATEGORIA │ NOME            │ CÓDIGO     │   │
│  │ PRODUTO │ PIZZAS    │ Pizza Calabresa │ 12345      │   │
│  │ PRODUTO │ PIZZAS    │ Pizza Mussarela │ 12346      │   │
│  │ ...     │ ...       │ ...             │ ...        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                          [Cancelar]  [Importar 25 itens]    │
└─────────────────────────────────────────────────────────────┘
```

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/modals/ImportarTextoCardapioModal.tsx` | **CRIAR** |
| `src/pages/ConfigurarCardapioWeb.tsx` | **MODIFICAR** (adicionar botão e estado) |

## Resultado Esperado

- Usuário pode colar texto simples de qualquer fonte
- Sistema detecta automaticamente formato e extrai produtos
- Preview mostra itens antes de importar
- Importação usa mesma lógica do arquivo (deduplicação automática)
- Itens são adicionados sem vínculo, prontos para vincular depois
