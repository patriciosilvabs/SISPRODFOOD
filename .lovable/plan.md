
# Plano: Integração Cardápio Web via Webhook

## Visão Geral

Implementar integração com o Cardápio Web para baixar automaticamente o consumo de itens porcionados na contagem quando um pedido é feito, baseado no mapeamento de produtos do cardápio com os itens porcionados do CPD.

## Arquitetura da Solução

```text
┌─────────────────┐      POST /cardapio-web-webhook      ┌──────────────────────┐
│  Cardápio Web   │ ─────────────────────────────────────>│   Edge Function      │
│  (order.created)│     X-API-KEY: token_loja           │ cardapio-web-webhook │
└─────────────────┘                                      └──────────┬───────────┘
                                                                    │
                    1. Valida token (identifica loja)               │
                    2. Busca mapeamento produto → itens             │
                    3. Para cada item do pedido:                    │
                       - Busca itens porcionados mapeados           │
                       - Decrementa final_sobra na contagem_porcionados
                    4. Registra log do webhook                      │
                                                                    ▼
                                                         ┌──────────────────────┐
                                                         │ contagem_porcionados │
                                                         │ (final_sobra - X)    │
                                                         └──────────────────────┘
```

## Componentes a Criar

### 1. Banco de Dados

**Tabela: `integracoes_cardapio_web`** (configuração por loja)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| organization_id | uuid | FK organizações |
| loja_id | uuid | FK lojas - qual loja recebe pedidos deste token |
| token | text | API Key única gerada para este estabelecimento |
| ambiente | text | 'sandbox' ou 'producao' |
| ativo | boolean | Integração ativa/inativa |
| url_webhook | text | URL do webhook (para referência) |
| created_at | timestamp | Data criação |
| updated_at | timestamp | Última atualização |

**Tabela: `mapeamento_cardapio_itens`** (produto do cardápio → itens porcionados)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| organization_id | uuid | FK organizações |
| cardapio_item_id | integer | ID do produto no Cardápio Web (item_id) |
| cardapio_item_nome | text | Nome do produto (para referência) |
| item_porcionado_id | uuid | FK itens_porcionados |
| quantidade_consumida | integer | Quantos porcionados são consumidos (default: 1) |
| ativo | boolean | Mapeamento ativo |
| created_at | timestamp | Data criação |

**Tabela: `cardapio_web_pedidos_log`** (auditoria de webhooks)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| organization_id | uuid | FK organizações |
| loja_id | uuid | FK lojas |
| order_id | integer | ID do pedido no Cardápio Web |
| payload | jsonb | Payload completo recebido |
| itens_processados | jsonb | Detalhes dos itens baixados |
| sucesso | boolean | Processamento bem-sucedido |
| erro | text | Mensagem de erro (se houver) |
| created_at | timestamp | Data/hora do webhook |

### 2. Edge Function: `cardapio-web-webhook`

**Responsabilidades:**
1. Receber POST com evento `order.created`
2. Identificar loja pelo header `X-API-KEY`
3. Para cada item do pedido:
   - Buscar mapeamento `cardapio_item_id` → `item_porcionado_id`
   - Multiplicar `quantity` do pedido × `quantidade_consumida` do mapeamento
   - Decrementar `final_sobra` na `contagem_porcionados` da loja
4. Registrar log do webhook
5. Retornar status de sucesso

**Configuração:**
- `verify_jwt = false` (webhook externo)
- Validação por token no header

### 3. Interface do Usuário

**Página: `/configurar-cardapio-web`**

Seções:
1. **Configuração da Integração**
   - Selecionar loja vinculada
   - Gerar/visualizar token (API Key)
   - Ambiente (Sandbox/Produção)
   - Ativar/Desativar integração
   - URL do webhook para copiar

2. **Mapeamento de Produtos**
   - Tabela com: Produto do Cardápio | Item Porcionado | Quantidade
   - Formulário para adicionar novo mapeamento
   - Opção de editar/excluir mapeamentos

3. **Logs de Pedidos**
   - Histórico dos últimos webhooks recebidos
   - Status (sucesso/erro)
   - Detalhes do processamento

## Fluxo de Processamento

```text
1. Cardápio Web envia: POST /cardapio-web-webhook
   Headers: X-API-KEY: abc123

2. Edge Function:
   a) Valida token → Identifica loja_id e organization_id
   b) Extrai items[] do payload
   c) Para cada item:
      - Busca mapeamento por cardapio_item_id
      - Se encontrado:
        * quantidade = item.quantity × mapeamento.quantidade_consumida
        * UPDATE contagem_porcionados
          SET final_sobra = final_sobra - quantidade
          WHERE loja_id = X AND item_porcionado_id = Y
            AND dia_operacional = hoje
   d) Registra log com resultado
   e) Retorna { success: true, processed_items: [...] }

3. Resultado: Contagem da loja é atualizada automaticamente
```

## Exemplo Prático

**Pedido recebido:**
```json
{
  "event": "order.created",
  "order": {
    "id": 12345,
    "items": [
      { "item_id": 9, "name": "Pizza Mussarela G", "quantity": 2 }
    ]
  }
}
```

**Mapeamento configurado:**
| cardapio_item_id | item_porcionado (nome) | quantidade_consumida |
|------------------|------------------------|----------------------|
| 9 | Massa Grande | 1 |
| 9 | Mussarela Porcionada | 1 |

**Resultado:**
- `contagem_porcionados` onde `item_nome = 'Massa Grande'`: `final_sobra -= 2`
- `contagem_porcionados` onde `item_nome = 'Mussarela Porcionada'`: `final_sobra -= 2`

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx_cardapio_web.sql` | Criar | Tabelas e RLS |
| `supabase/functions/cardapio-web-webhook/index.ts` | Criar | Edge function |
| `supabase/config.toml` | Modificar | Adicionar função |
| `src/pages/ConfigurarCardapioWeb.tsx` | Criar | Página de configuração |
| `src/hooks/useCardapioWebIntegracao.ts` | Criar | Hook para gerenciar integração |
| `src/App.tsx` | Modificar | Adicionar rota |
| `src/pages/Configuracoes.tsx` | Modificar | Adicionar card de acesso |
| `src/lib/page-access-config.ts` | Modificar | Adicionar controle de acesso |

## Considerações de Segurança

1. **Token único por loja**: Cada loja terá seu próprio token para identificação
2. **Validação obrigatória**: Webhook rejeitado se token inválido
3. **RLS nas tabelas**: Acesso restrito por organization_id
4. **Logs de auditoria**: Todos os webhooks são registrados

## Próximos Passos após Implementação

1. Configurar webhook no painel do Cardápio Web com a URL gerada
2. Cadastrar mapeamento de produtos → itens porcionados
3. Testar no ambiente Sandbox
4. Ativar para produção

## Dúvida para o Usuário

Antes de implementar, preciso confirmar:

1. **Complementos**: Os complementos do pedido (borda recheada, adicionais) também devem consumir itens porcionados? Exemplo: Borda Recheada = 1 porção de catupiry?

2. **Pedidos cancelados**: O Cardápio Web envia webhook quando um pedido é cancelado (`order.cancelled`)? Se sim, devemos reverter a baixa (adicionar de volta ao estoque)?

3. **Quantidade negativa**: Se a contagem ficar negativa (mais pedidos que estoque), como devemos proceder?
   - Permitir negativo (débito)
   - Bloquear em zero
   - Gerar alerta
