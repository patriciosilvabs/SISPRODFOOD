# Plano: Corrigir Integração CardápioWeb - Busca de Detalhes via API

## ✅ IMPLEMENTADO

## Problema Identificado

O CardápioWeb envia apenas uma **notificação** com o `order_id`, não os detalhes completos do pedido. Nossa edge function espera receber `payload.order.items`, mas o payload real é:

```json
{
  "event_id": "1pry7dk9gcgqmiqe7n8",
  "event_type": "ORDER_CREATED",
  "merchant_id": 8268,
  "order_id": 179546164,
  "order_status": "confirmed",
  "created_at": "2026-02-01T14:22:26-03:00"
}
```

## Solução Implementada

1. ✅ **Migração de Banco de Dados**: Adicionada coluna `cardapio_api_key` na tabela `integracoes_cardapio_web`

2. ✅ **Edge Function Atualizada** (`cardapio-web-webhook`):
   - Nova função `fetchOrderDetails()` para buscar detalhes do pedido via API
   - Lógica para detectar se payload tem items ou precisa buscar
   - Suporte para ambientes sandbox e produção
   - Logging detalhado para debug

3. ✅ **Hook Atualizado** (`useCardapioWebIntegracao.ts`):
   - Interface `IntegracaoCardapioWeb` inclui `cardapio_api_key`
   - Nova mutation `updateCardapioApiKey` para salvar a API Key

4. ✅ **Interface de Configuração** (`LojaIntegracaoCard.tsx`):
   - Campo para configurar API Key do CardápioWeb
   - Botão de salvar com feedback visual
   - Texto explicativo

5. ✅ **Página de Configuração** (`ConfigurarCardapioWeb.tsx`):
   - Prop `onUpdateApiKey` passada ao componente

## Fluxo Corrigido

```text
1. CardápioWeb envia notificação: { event_type: "ORDER_CREATED", order_id: 12345 }
2. Webhook valida token → Encontra integração ativa
3. Detecta que payload não tem items → Busca detalhes via API
4. GET https://integracao.cardapioweb.com/api/partner/v1/orders/12345
5. Recebe items do pedido → Processa baixa de estoque
6. Atualiza contagem_porcionados com dados de rastreamento
```

## Configuração Necessária pelo Usuário

Após a implementação, o usuário precisa:

1. Acessar a tela de Configuração do Cardápio Web
2. Informar a **API Key do CardápioWeb** (obtida no painel do CardápioWeb)
3. Clicar no botão de salvar

Sem essa API Key, não é possível buscar os detalhes dos pedidos.
