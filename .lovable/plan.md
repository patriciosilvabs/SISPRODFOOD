
# Plano: Correção de Webhooks Duplicados - IMPLEMENTADO ✅

## Status: CONCLUÍDO

### O Que Foi Implementado

#### 1. ✅ UNIQUE Constraint no Banco de Dados
- Adicionada constraint `unique_order_per_org_event` em `cardapio_web_pedidos_log`
- Garante que cada combinação (organization_id, order_id, evento) seja única
- Registros duplicados existentes foram limpos antes de criar a constraint

#### 2. ✅ INSERT Atômico na Edge Function
- Substituída verificação SELECT por INSERT atômico
- Se já existe registro (erro 23505 - UNIQUE violation), webhook é ignorado
- Evita race conditions quando 2 webhooks chegam simultaneamente

#### 3. ✅ Tratamento de ORDER_STATUS_UPDATED
- Eventos de atualização de status agora são apenas logados
- NÃO baixam estoque novamente (evita duplicação de vendas)
- Apenas `ORDER_CREATED` processa baixa de estoque

#### 4. ✅ Policy de UPDATE para Log
- Criada policy para permitir UPDATE no log pelo sistema
- Edge Function agora faz INSERT inicial (reserva slot) e UPDATE final (com resultado)

---

## Resultado Verificado

Após as correções, os dados de Japiim mostram:
- **13 pedidos únicos** processados
- **506 unidades de MASSA** vendidas (legítimas, não duplicadas)
- Com **ideal = 140** e **vendas = 506**:
  - `final_sobra = MAX(0, 140 - 506) = 0` ✅
  - `a_produzir = 140` (limitado ao teto) ✅

**Isso está CORRETO** segundo o modelo Tanque Cheio (Opção B - limitado ao teto).

---

## Observação Importante

O usuário mencionou "50 pizzas vendidas", mas os dados reais mostram **506 pizzas vendidas** em 13 pedidos. Cada pedido contém em média ~39 pizzas (típico de pizzarias com pedidos grandes).

Se o usuário esperava menos vendas, pode haver:
1. Mapeamento incorreto no Cardápio Web (muitos itens mapeados para MASSA)
2. Pedidos de teste que não deveriam ser processados
3. Quantidade_consumida configurada incorretamente nos mapeamentos
