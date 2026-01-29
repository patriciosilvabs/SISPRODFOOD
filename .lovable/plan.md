

# Plano: Gatilho Mínimo de Produção (Ponto de Corte de Viabilidade)

## 📋 Resumo Executivo

1. ✅ **Coluna `quantidade_minima_producao`** adicionada à tabela `itens_porcionados`
2. ✅ **Tabela `backlog_producao`** criada para armazenar demandas abaixo do gatilho
3. ✅ **Campo de configuração** no formulário de Itens Porcionados
4. ✅ **BacklogIndicator** componente visual para mostrar itens aguardando
5. ✅ **Integração** no Resumo da Produção
6. ✅ **Função RPC** atualizada com lógica de verificação de gatilho e estoque CPD

### ✅ Implementação Concluída!
A função `criar_ou_atualizar_producao_registro` agora:
- Calcula o saldo líquido (demanda - estoque CPD)
- Verifica se atinge o gatilho mínimo configurado
- Registra no backlog quando abaixo do gatilho
- Remove automaticamente do backlog quando produção é liberada

---

## 📋 Resumo Executivo

---

## 🏗️ Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE PRODUÇÃO ATUALIZADO                    │
└─────────────────────────────────────────────────────────────────────────┘

  Contagem Loja A       Contagem Loja B        Contagem Loja C
       │                     │                      │
       └─────────────────────┼──────────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  AGREGADOR DE DEMANDA        │
              │  Σ demanda = A + B + C       │
              └──────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  CHECK ESTOQUE CPD           │ ← NOVO
              │  saldo_liquido = demanda -   │
              │                estoque_cpd   │
              └──────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  VERIFICAR GATILHO MÍNIMO    │ ← NOVO
              │  saldo_liquido >= gatilho?   │
              └──────────────────────────────┘
                    │                 │
            ┌───────┘                 └───────┐
            ▼                                 ▼
   ┌────────────────────┐          ┌────────────────────┐
   │ SIM: Criar Cards   │          │ NÃO: Buffer        │
   │ no Kanban          │          │ (Aguardando)       │
   └────────────────────┘          └────────────────────┘
```

---

## 🗄️ Mudanças no Banco de Dados

### 1. Adicionar coluna à tabela `itens_porcionados`

```sql
-- Nova coluna para gatilho mínimo de produção
ALTER TABLE itens_porcionados 
ADD COLUMN quantidade_minima_producao INTEGER DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN itens_porcionados.quantidade_minima_producao IS 
'Quantidade mínima de unidades necessária para autorizar criação de lote. 0 = desativado.';
```

### 2. Criar tabela de Buffer (Backlog de Produção)

```sql
CREATE TABLE IF NOT EXISTS backlog_producao (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES itens_porcionados(id),
  item_nome TEXT NOT NULL,
  loja_id UUID NOT NULL REFERENCES lojas(id),
  loja_nome TEXT NOT NULL,
  quantidade_pendente INTEGER NOT NULL DEFAULT 0,
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'aguardando_gatilho', -- 'aguardando_gatilho', 'liberado', 'expirado'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id),
  
  -- Índice único para evitar duplicatas
  UNIQUE(item_id, loja_id, data_referencia)
);

-- Habilitar RLS
ALTER TABLE backlog_producao ENABLE ROW LEVEL SECURITY;

-- Política de acesso
CREATE POLICY "Usuários podem ver backlog da organização" ON backlog_producao
  FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));
```

---

## 🔧 Atualização da Função RPC

### Modificar `criar_ou_atualizar_producao_registro`

```sql
-- Dentro da função, após calcular demanda_lojas, adicionar:

-- 1. Buscar gatilho mínimo do item
SELECT quantidade_minima_producao INTO v_gatilho_minimo
FROM itens_porcionados 
WHERE id = p_item_id;

v_gatilho_minimo := COALESCE(v_gatilho_minimo, 0);

-- 2. Buscar estoque CPD atual
SELECT COALESCE(quantidade, 0) INTO v_estoque_cpd
FROM estoque_cpd 
WHERE item_porcionado_id = p_item_id 
  AND organization_id = p_organization_id;

-- 3. Calcular saldo líquido
v_saldo_liquido := GREATEST(0, v_demanda_total - v_estoque_cpd);

-- 4. Verificar gatilho
IF v_gatilho_minimo > 0 AND v_saldo_liquido < v_gatilho_minimo THEN
    -- Registrar no backlog e NÃO criar card de produção
    INSERT INTO backlog_producao (...)
    ON CONFLICT (...) DO UPDATE SET quantidade_pendente = v_saldo_liquido;
    
    RETURN NULL; -- Não cria card
END IF;

-- Se passou do gatilho, segue fluxo normal de criação de cards
```

---

## 🖥️ Mudanças na Interface

### 1. Página `ItensPorcionados.tsx`

Adicionar campo no formulário de edição/criação:

```typescript
// Novo campo no formData
quantidade_minima_producao: '0',

// No formulário
<div className="space-y-2">
  <Label htmlFor="quantidade_minima_producao">
    Qtd Mínima para Produção (Gatilho)
  </Label>
  <Input
    id="quantidade_minima_producao"
    type="number"
    min="0"
    value={formData.quantidade_minima_producao}
    onChange={(e) => setFormData({
      ...formData, 
      quantidade_minima_producao: e.target.value 
    })}
    placeholder="0 = Desativado"
  />
  <p className="text-xs text-muted-foreground">
    Define o volume mínimo de unidades para autorizar a produção. 
    Se a demanda for inferior, o sistema mantém em espera.
  </p>
</div>
```

### 2. Componente de Indicador Visual no Kanban

Criar indicador quando há itens em backlog:

```typescript
// Novo componente BacklogIndicator.tsx
const BacklogIndicator = ({ backlogItems }) => {
  if (backlogItems.length === 0) return null;
  
  return (
    <Alert variant="warning">
      <Clock className="h-4 w-4" />
      <AlertDescription>
        {backlogItems.length} item(ns) aguardando gatilho mínimo
        <ul className="mt-2 text-sm">
          {backlogItems.map(item => (
            <li key={item.id}>
              {item.item_nome}: {item.quantidade_pendente} un. 
              (Mínimo: {item.gatilho_minimo})
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};
```

### 3. Indicador no `ContagemStatusIndicator.tsx`

Adicionar badge quando item está em backlog:

```typescript
// Badge de "Aguardando Gatilho"
{itemEmBacklog && (
  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
    <Clock className="h-3 w-3 mr-1" />
    Aguardando ({qtdAtual}/{gatilhoMinimo})
  </Badge>
)}
```

---

## 📁 Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| **Database Migration** | Criar | Adicionar coluna `quantidade_minima_producao` e tabela `backlog_producao` |
| `src/pages/ItensPorcionados.tsx` | Modificar | Campo de configuração do gatilho mínimo |
| `src/integrations/supabase/types.ts` | Auto-gerado | Atualização automática após migration |
| Função RPC `criar_ou_atualizar_producao_registro` | Modificar | Lógica de check de estoque + gatilho |
| `src/components/kanban/BacklogIndicator.tsx` | Criar | Indicador visual de itens aguardando |
| `src/pages/ResumoDaProducao.tsx` | Modificar | Exibir indicador de backlog |

---

## 🧪 Cenários de Teste

| Cenário | Gatilho | Demanda | Estoque CPD | Saldo Líquido | Resultado |
|---------|---------|---------|-------------|---------------|-----------|
| A: Abaixo do gatilho | 25 | 18 | 0 | 18 | Buffer ⏳ |
| B: Igual ao gatilho | 25 | 25 | 0 | 25 | Produzir ✅ |
| C: Acima do gatilho | 25 | 52 | 10 | 42 | Produzir ✅ |
| D: Estoque cobre tudo | 25 | 30 | 35 | 0 | Nenhum card |
| E: Gatilho desativado | 0 | 5 | 0 | 5 | Produzir ✅ |

---

## 🔄 Fluxo Detalhado

```text
1. Loja A informa: preciso de 10 unidades
2. Loja B informa: preciso de 8 unidades
   ─────────────────────────────────
   Σ Demanda = 18 unidades

3. Check Estoque CPD: 0 unidades disponíveis
   ─────────────────────────────────
   Saldo Líquido = 18 - 0 = 18 unidades

4. Gatilho Mínimo configurado: 25 unidades
   ─────────────────────────────────
   18 < 25 → NÃO atinge gatilho

5. Resultado:
   ✖ Não cria card de produção
   ✔ Registra no backlog_producao
   ✔ Exibe alerta: "Demanda atual (18 un) abaixo do gatilho (25 un)"

6. Loja C informa: preciso de 12 unidades
   ─────────────────────────────────
   Nova Σ Demanda = 30 unidades
   30 >= 25 → ATINGE gatilho
   
7. Sistema automaticamente:
   ✔ Cria card de produção no Kanban
   ✔ Remove registros do backlog
   ✔ Calcula lotes normalmente
```

---

## ⚠️ Considerações Importantes

1. **Reserva de Estoque**: A lógica de check do estoque CPD deve "reservar" virtualmente as unidades para evitar promessas duplicadas.

2. **Expiração de Backlog**: Implementar limpeza automática de registros de backlog antigos (ex: expirar após 24h).

3. **Notificação ao Operador**: Quando itens estão no backlog, exibir alerta claro no painel de produção.

4. **Override Manual**: Permitir que o operador force a produção mesmo abaixo do gatilho (com confirmação).

---

## 📊 Resumo de Impacto

| Aspecto | Impacto |
|---------|---------|
| Economia de insumos | Evita abertura de lotes pequenos |
| Eficiência operacional | Agrupa demandas para produção otimizada |
| Controle de estoque | Check automático antes de produzir |
| UX | Indicadores visuais claros do status |

