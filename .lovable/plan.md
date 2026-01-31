

# Plano: Integração com PDV Pizzaria Externo

## Visão Geral

Criar uma integração bidirecional entre o Sistema CPD e o PDV Pizzaria externo:

1. **CPD busca do PDV** (Pull): Demanda de produção, ingredientes e metas
2. **CPD notifica PDV** (Push): Enviar webhook quando romaneio é despachado

## Arquitetura da Integração

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SISTEMA CPD (Este Projeto)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────┐       ┌───────────────────────────────────────────┐ │
│  │  Configurações        │       │  Edge Functions                          │ │
│  │  ─────────────────────│       ├───────────────────────────────────────────┤ │
│  │  pdv_api_url          │       │  pdv-sync (GET demanda/ingredientes)     │ │
│  │  pdv_api_key          │       │  pdv-notify-shipment (POST envio)        │ │
│  └───────────────────────┘       └───────────────────────────────────────────┘ │
│                                           │                                    │
│                                           ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │  UI Configurações → Tela "Integração PDV"                                │ │
│  │  - Configurar URL/API Key do PDV                                         │ │
│  │  - Testar conexão                                                        │ │
│  │  - Ativar/desativar notificações automáticas                             │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PDV PIZZARIA (Sistema Externo)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  GET  /production-api?action=demand      → Retorna demanda de produção        │
│  GET  /production-api?action=ingredients → Lista ingredientes + estoque       │
│  GET  /production-api?action=targets     → Metas diárias por dia da semana    │
│  POST /production-webhook                → Recebe notificação de envio        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Componentes a Criar

### 1. Tabela de Integrações PDV

Nova tabela para armazenar configuração de integração por organização:

```sql
CREATE TABLE integracoes_pdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  nome TEXT NOT NULL DEFAULT 'PDV Pizzaria',
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,  -- Chave do PDV externo
  ativo BOOLEAN DEFAULT true,
  notificar_romaneio BOOLEAN DEFAULT true,  -- Enviar webhook ao despachar
  sincronizar_demanda BOOLEAN DEFAULT true, -- Buscar demanda automaticamente
  ultima_sincronizacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);
```

### 2. Tabela de Logs de Integração

Para rastrear todas as requisições:

```sql
CREATE TABLE integracoes_pdv_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  direcao TEXT NOT NULL, -- 'pull' ou 'push'
  endpoint TEXT NOT NULL,
  metodo TEXT NOT NULL, -- 'GET' ou 'POST'
  payload JSONB,
  resposta JSONB,
  status_code INTEGER,
  sucesso BOOLEAN NOT NULL,
  erro TEXT,
  duracao_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Edge Function: `pdv-sync`

Buscar dados do PDV externo (demanda, ingredientes, metas):

```typescript
// supabase/functions/pdv-sync/index.ts
// Ações: demand, ingredients, targets
// Fluxo:
// 1. Validar JWT do usuário
// 2. Buscar configuração de integração da organização
// 3. Fazer requisição GET para o PDV externo
// 4. Registrar log da requisição
// 5. Retornar dados formatados
```

### 4. Edge Function: `pdv-notify-shipment`

Notificar o PDV quando um romaneio é despachado:

```typescript
// supabase/functions/pdv-notify-shipment/index.ts
// Fluxo:
// 1. Receber dados do romaneio (loja, itens, quantidades)
// 2. Buscar configuração de integração
// 3. Montar payload no formato esperado pelo PDV
// 4. Fazer POST para /production-webhook
// 5. Registrar log da requisição
// 6. Atualizar romaneio com status de notificação
```

### 5. Nova Página: Configurar Integração PDV

Caminho: `/configurar-integracao-pdv`

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Integração com PDV Externo                                                  │
│ Configure a conexão com o sistema PDV da pizzaria                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Status: ● Conectado (última sincronização: 31/01/2026 10:30)               │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ Configurações de Conexão                                                    │
│                                                                             │
│ URL da API PDV:                                                             │
│ [ https://pgfeffykhanujyqymmir.supabase.co/functions/v1 ]                  │
│                                                                             │
│ Chave de API (X-API-KEY):                                                   │
│ [ •••••••••••••••••••••••••••• ]  [Revelar]                                │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ Opções de Sincronização                                                     │
│                                                                             │
│ [✓] Sincronizar demanda automaticamente (manhã)                            │
│ [✓] Notificar PDV ao despachar romaneio                                    │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ [Testar Conexão]  [Sincronizar Agora]                      [Salvar]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6. Nova Página: Painel de Demanda PDV

Caminho: `/demanda-pdv`

Exibe a demanda vinda do PDV externo:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Demanda de Produção (PDV)                                          [Sync]  │
│ Dados sincronizados do PDV Pizzaria                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Última atualização: 31/01/2026 06:00                                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔴 CRÍTICO                                                              │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ Massa de Pizza        5 kg → 20 kg     Produzir: 15 kg                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🟡 BAIXO                                                                │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ Molho de Tomate       8 L → 15 L       Produzir: 7 L                   │ │
│ │ Mussarela             12 kg → 20 kg    Produzir: 8 kg                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7. Integração no Romaneio

Ao enviar um romaneio, notificar automaticamente o PDV:

```typescript
// Em Romaneio.tsx - handleEnviarRomaneio
const handleEnviarRomaneio = async (...) => {
  // ... lógica existente de envio ...
  
  // Após sucesso, notificar PDV se integração ativa
  if (integracaoPDVAtiva) {
    await supabase.functions.invoke('pdv-notify-shipment', {
      body: {
        romaneio_id: romaneioId,
        external_id: `CPD-${format(new Date(), 'yyyy-MMdd-HHmm')}`,
        items: itensRomaneio.map(item => ({
          ingredient_name: item.item_nome,
          quantity: item.quantidade,
          unit: 'un' // ou buscar do item
        })),
        notes: `Lote: ${codigoLote}`
      }
    });
  }
};
```

## Arquivos a Criar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/functions/pdv-sync/index.ts` | Edge Function | Buscar dados do PDV |
| `supabase/functions/pdv-notify-shipment/index.ts` | Edge Function | Notificar PDV sobre envios |
| `src/pages/ConfigurarIntegracaoPDV.tsx` | Página | Configurar credenciais e opções |
| `src/pages/DemandaPDV.tsx` | Página | Visualizar demanda sincronizada |
| `src/hooks/useIntegracaoPDV.ts` | Hook | Gerenciar estado da integração |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Romaneio.tsx` | Adicionar chamada ao webhook após envio |
| `src/pages/Configuracoes.tsx` | Adicionar card para acessar configuração PDV |
| `src/App.tsx` | Adicionar rotas das novas páginas |
| `supabase/config.toml` | Registrar novas edge functions |

## Migração de Banco de Dados

```sql
-- Tabela de configuração de integração
CREATE TABLE integracoes_pdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'PDV Pizzaria',
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  notificar_romaneio BOOLEAN DEFAULT true,
  sincronizar_demanda BOOLEAN DEFAULT true,
  ultima_sincronizacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- Tabela de logs de integração
CREATE TABLE integracoes_pdv_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL CHECK (direcao IN ('pull', 'push')),
  endpoint TEXT NOT NULL,
  metodo TEXT NOT NULL,
  payload JSONB,
  resposta JSONB,
  status_code INTEGER,
  sucesso BOOLEAN NOT NULL,
  erro TEXT,
  duracao_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_integracoes_pdv_log_org ON integracoes_pdv_log(organization_id);
CREATE INDEX idx_integracoes_pdv_log_created ON integracoes_pdv_log(created_at DESC);

-- RLS Policies
ALTER TABLE integracoes_pdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE integracoes_pdv_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver integração da própria organização" ON integracoes_pdv
  FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins podem gerenciar integração" ON integracoes_pdv
  FOR ALL USING (
    organization_id = get_user_organization_id(auth.uid()) 
    AND has_role(auth.uid(), 'Admin')
  );

CREATE POLICY "Usuários podem ver logs da própria organização" ON integracoes_pdv_log
  FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Sistema pode inserir logs" ON integracoes_pdv_log
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id(auth.uid()));
```

## Fluxo de Uso

```text
CONFIGURAÇÃO INICIAL
====================
1. Admin acessa Configurações → Integração PDV
2. Insere URL da API e chave fornecida pelo PDV
3. Clica "Testar Conexão" para validar
4. Ativa opções de sincronização
5. Salva configuração

OPERAÇÃO DIÁRIA
===============
MANHÃ (06:00)
  ↓
CPD abre "Demanda PDV"
  ↓
Clica "Sincronizar Agora"
  ↓
Sistema busca GET ?action=demand
  ↓
Exibe lista de ingredientes a produzir
  ↓
Operador produz conforme demanda
  ↓
TARDE (14:00)
  ↓
Operador cria romaneio com itens produzidos
  ↓
Clica "Enviar Romaneio"
  ↓
Sistema: 
  1. Registra romaneio no banco local
  2. Envia POST /production-webhook para PDV
  ↓
PDV atualiza estoque automaticamente
```

## Considerações de Segurança

1. **Armazenamento da API Key**: A chave do PDV será armazenada na tabela `integracoes_pdv` (não em secrets, pois é por organização)
2. **Validação de Origem**: As Edge Functions validam o JWT do usuário antes de fazer requisições
3. **Logs Completos**: Todas as requisições são registradas para auditoria
4. **Retry com Backoff**: Implementar retry em caso de falha de rede

## Próximos Passos Após Implementação

1. Testar conexão com o PDV real
2. Mapear ingredientes do PDV com itens porcionados locais
3. Automatizar sincronização via cron job (opcional)

