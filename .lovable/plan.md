
# Plano: Integração Cardápio Web por Loja

## Situação Atual

A arquitetura do banco já suporta múltiplas integrações (uma por loja), mas a interface só exibe UMA integração. Conforme as imagens:
- O Cardápio Web fornece um **código da loja** (ex: 8268) e um **token** por loja
- Você tem múltiplas lojas (ARMAZÉM, UNIDADE ALEIXO) que precisam de integrações separadas

## Alterações Necessárias

### Parte 1: Adicionar Campo de Código da Loja

Adicionar coluna `codigo_cardapio_web` na tabela `lojas` para armazenar o código que o Cardápio Web fornece (ex: 8268).

```sql
ALTER TABLE lojas ADD COLUMN codigo_cardapio_web TEXT;
```

### Parte 2: Atualizar Hook para Múltiplas Integrações

**Arquivo:** `src/hooks/useCardapioWebIntegracao.ts`

Modificar para carregar TODAS as integrações da organização em vez de apenas uma:

```typescript
// Antes
const { data: integracao } = useQuery({
  queryFn: () => supabase.from('integracoes_cardapio_web')
    .select('*').eq('organization_id', orgId).maybeSingle()
});

// Depois
const { data: integracoes } = useQuery({
  queryFn: () => supabase.from('integracoes_cardapio_web')
    .select('*, lojas(id, nome, codigo_cardapio_web)')
    .eq('organization_id', orgId)
    .order('created_at')
});
```

### Parte 3: Redesenhar Interface de Configuração

**Arquivo:** `src/pages/ConfigurarCardapioWeb.tsx`

Transformar em uma lista de integrações por loja:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Integração Cardápio Web                                             │
│ Configure a integração com o Cardápio Web para cada loja.          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ UNIDADE ALEIXO                                    [Ativa] ⚫  │  │
│  │ Código: 8268  |  Ambiente: Sandbox                            │  │
│  │ Token: ******** [👁] [📋] [🔄]                               │  │
│  │ URL: https://...../cardapio-web-webhook           [📋]       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ARMAZÉM                                      [+ Configurar]   │  │
│  │ Sem integração configurada                                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Parte 4: Atualizar Página de Lojas

**Arquivo:** `src/pages/Lojas.tsx`

Adicionar campo para inserir o código do Cardápio Web no formulário de edição da loja:

```typescript
// Novo campo no formulário
<div className="space-y-2">
  <Label>Código Cardápio Web</Label>
  <Input 
    placeholder="Ex: 8268"
    value={formData.codigo_cardapio_web}
    onChange={...}
  />
  <p className="text-xs text-muted-foreground">
    Código da loja no sistema Cardápio Web
  </p>
</div>
```

---

## Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| **Banco de Dados** | Adicionar coluna `codigo_cardapio_web` na tabela `lojas` |
| **useCardapioWebIntegracao.ts** | Carregar array de integrações em vez de uma única |
| **ConfigurarCardapioWeb.tsx** | Exibir lista de lojas com status de integração |
| **Lojas.tsx** | Adicionar campo para código do Cardápio Web |

---

## Fluxo de Configuração

1. **Cadastrar código da loja**: Na página Lojas, editar cada loja e informar o código do Cardápio Web (ex: 8268)
2. **Ativar integração**: Na página de Integração, clicar em "Configurar" na loja desejada
3. **Obter credenciais**: O sistema gera um token único para aquela loja
4. **Configurar no Cardápio Web**: Usar a URL do webhook + token no painel do Cardápio Web

---

## Detalhes Técnicos

### Edge Function (já suporta múltiplas lojas)

A Edge Function já identifica a loja corretamente pelo token:
```typescript
const { data: integracao } = await supabase
  .from('integracoes_cardapio_web')
  .select('*')
  .eq('token', apiKey)  // Cada loja tem seu token
  .eq('ativo', true)
  .single()
```

### Constraint Existente

A constraint `UNIQUE (organization_id, loja_id)` garante que cada loja só pode ter uma integração.
