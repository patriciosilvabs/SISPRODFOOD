
# Plano: Separar Ajuste de Estoque CPD em Página Independente

## Resumo do Problema

Atualmente, a funcionalidade "Ajustar Estoque" do CPD está embutida na página "Contagem de Porcionados" como uma aba. Isso é incorreto porque:

1. **Contagem de Porcionados** é uma funcionalidade de **LOJA** - para informar sobra e demanda
2. **Ajuste de Estoque CPD** é uma funcionalidade de **CPD** - para auditorias e correções de inventário

Usuários de loja não devem ter acesso ao ajuste de estoque do CPD.

## Solução Proposta

Criar uma nova página dedicada chamada **"Estoque Porcionados (CPD)"** no menu lateral, dentro da seção **CPD - Produção**, acessível apenas para:
- Administradores
- Operadores CPD (role `Produção`)

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/EstoquePorcionadosCPD.tsx` | **CRIAR** - Nova página dedicada |
| `src/App.tsx` | **MODIFICAR** - Adicionar rota `/estoque-porcionados-cpd` |
| `src/components/Layout.tsx` | **MODIFICAR** - Adicionar link no menu CPD |
| `src/lib/page-access-config.ts` | **MODIFICAR** - Registrar página no sistema de permissões |
| `src/pages/ContagemPorcionados.tsx` | **MODIFICAR** - Remover aba de ajuste de estoque |

## Detalhes Técnicos

### 1. Nova Página: EstoquePorcionadosCPD.tsx

```typescript
// Estrutura da nova página
- Usa Layout padrão
- Usa hook useCPDLoja para obter dados do CPD
- Renderiza AjusteEstoquePorcionadosCPD (já existente)
- Mostra mensagem se não houver CPD configurado
```

### 2. Rota em App.tsx

```typescript
<Route
  path="/estoque-porcionados-cpd"
  element={
    <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
      <EstoquePorcionadosCPD />
    </ProtectedRoute>
  }
/>
```

### 3. Menu Lateral (Layout.tsx)

Adicionar na seção **CPD - Produção**:
```typescript
// Verificar acesso à nova página
const canSeeEstoquePorcionadosCPD = hasPageAccess('/estoque-porcionados-cpd');

// Adicionar link
{canSeeEstoquePorcionadosCPD && (
  <NavLink to="/estoque-porcionados-cpd" icon={Boxes}>
    Estoque Porcionados (CPD)
  </NavLink>
)}
```

### 4. Configuração de Páginas (page-access-config.ts)

```typescript
// Adicionar na seção CPD
{ route: '/estoque-porcionados-cpd', label: 'Estoque Porcionados (CPD)', description: 'Ajuste de estoque porcionados', section: 'cpd' },

// Adicionar no PROFILE_DEFAULT_PAGES para cpd
'/estoque-porcionados-cpd',
```

### 5. Remover Aba de ContagemPorcionados.tsx

**Mudanças principais:**
- Remover import do `AjusteEstoquePorcionadosCPD`
- Remover lógica de verificação `isCPDOnly`, `canAdjustStock`, `cpdLoja`
- Remover tabs e mostrar apenas conteúdo de contagem
- Remover estado `activeTab`
- Manter a página focada exclusivamente em contagem para lojas

## Fluxo de Acesso Final

| Perfil | Contagem Porcionados | Estoque Porcionados (CPD) |
|--------|---------------------|---------------------------|
| Admin | ✅ Acesso total | ✅ Acesso total |
| Operador CPD | ❌ Sem acesso | ✅ Acesso total |
| Operador Loja | ✅ Acesso total | ❌ Sem acesso |

## Resultado Esperado

1. **Menu Lateral CPD** terá novo item: "Estoque Porcionados (CPD)"
2. **Contagem Porcionados** fica simplificada, sem abas de ajuste
3. **Separação clara** entre funcionalidades de loja e CPD
4. **Controle de acesso** correto por perfil de usuário
