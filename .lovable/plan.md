
# Plano: Ajuste de Estoque de Porcionados no CPD

## Contexto

O sistema atual permite entrada automática de porcionados via produção e saída automática via romaneio. Porém, falta uma funcionalidade crítica para operações do dia-a-dia: **ajuste manual do estoque de porcionados no CPD** para auditorias, perdas, e correções de inventário.

---

## Solução Proposta

Criar uma aba ou seção dedicada na página de **Contagem de Porcionados** (quando o usuário está no CPD) ou uma nova funcionalidade específica para o CPD realizar ajustes de estoque com:

1. **Lista de itens porcionados com estoque atual**
2. **Botões de ajuste (+ / -)** para cada item
3. **Campo de observação obrigatória** (motivo do ajuste)
4. **Tipos de ajuste**: Ajuste Positivo, Ajuste Negativo, Perda
5. **Registro em log imutável** para auditoria

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                CONTAGEM PORCIONADOS (CPD)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Produção Atual    │    │   Ajustar Estoque (NOVO)    │ │
│  │   (final_sobra)     │    │   - Ajuste +/-              │ │
│  │                     │    │   - Registrar Perda         │ │
│  │   [ver estoque]     │    │   - Observação obrigatória  │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                                                             │
│                           │                                 │
│                           ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           movimentacoes_estoque_log                   │   │
│  │   (registro imutável de todas as movimentações)       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Fase 1: Componente de Ajuste de Estoque CPD

**Arquivo**: `src/components/cpd/AjusteEstoquePorcionadosCPD.tsx`

Criar componente com:
- Listagem de todos os itens porcionados ativos
- Exibição do estoque atual (`final_sobra` da `contagem_porcionados` do CPD)
- Botão de ação para abrir modal de ajuste
- Tipo de ajuste: `ajuste_positivo`, `ajuste_negativo`, `perda`
- Quantidade do ajuste
- Observação/Motivo (obrigatória)
- Botão confirmar

### Fase 2: Integração com Hook de Movimentação

Utilizar o hook `useMovimentacaoEstoque` existente que já suporta:
- `entidadeTipo: 'porcionado'`
- `tipoMovimentacao: 'ajuste_positivo' | 'ajuste_negativo' | 'perda'`
- Validação de observação obrigatória
- Registro automático em `movimentacoes_estoque_log`

### Fase 3: Atualização do Estoque Físico

Após registrar a movimentação, atualizar a tabela `contagem_porcionados`:
- `final_sobra` += quantidade (para ajuste positivo)
- `final_sobra` -= quantidade (para ajuste negativo/perda)
- Validar que não fique negativo

### Fase 4: Integração na Página

**Opção A**: Adicionar aba "Ajustar Estoque" na página `ContagemPorcionados.tsx` quando o usuário está logado no CPD

**Opção B**: Criar nova página dedicada `AjusteEstoqueCPD.tsx` acessível apenas para perfil CPD/Admin

---

## Detalhes Técnicos

### Frontend

**Modal de Ajuste**:
```
┌───────────────────────────────────────────────┐
│         Ajustar Estoque: [Nome Item]          │
├───────────────────────────────────────────────┤
│                                               │
│  Estoque Atual: 150 unidades                  │
│                                               │
│  Tipo de Ajuste:                              │
│  ○ Ajuste Positivo (+)                        │
│  ● Ajuste Negativo (-)                        │
│  ○ Registrar Perda                            │
│                                               │
│  Quantidade: [_____30_____]                   │
│                                               │
│  Motivo (obrigatório):                        │
│  ┌─────────────────────────────────────────┐  │
│  │ Contagem de auditoria - encontrado 30   │  │
│  │ unidades a menos que o sistema          │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Estoque Resultante: 120 unidades             │
│                                               │
│        [Cancelar]    [Confirmar Ajuste]       │
└───────────────────────────────────────────────┘
```

### Validações
- Quantidade > 0
- Observação não vazia (mínimo 10 caracteres)
- Estoque resultante não pode ser negativo
- Prevenção de duplo clique

### Logs de Auditoria
Registro automático em `movimentacoes_estoque_log` com:
- `entidade_tipo: 'porcionado'`
- `entidade_id: item_porcionado_id`
- `tipo_movimentacao: 'ajuste_positivo' | 'ajuste_negativo' | 'perda'`
- `quantidade: valor do ajuste`
- `estoque_anterior: valor antes`
- `estoque_resultante: valor depois`
- `observacao: motivo informado`
- `usuario_id/nome: quem fez`
- `unidade_origem: 'cpd'`

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/cpd/AjusteEstoquePorcionadosCPD.tsx` | Criar | Componente principal de listagem e ajuste |
| `src/components/modals/AjustarEstoquePorcionadoModal.tsx` | Criar | Modal para realizar o ajuste |
| `src/pages/ContagemPorcionados.tsx` | Modificar | Adicionar aba/seção de ajuste quando no CPD |

---

## Benefícios

1. **Auditoria Completa**: Todo ajuste fica registrado com motivo, usuário e data
2. **Rastreabilidade**: Relatório de movimentações mostra histórico completo
3. **Prevenção de Fraudes**: Observação obrigatória para justificar ajustes
4. **Alinhamento com Estoque Físico**: Permite corrigir divergências
5. **Consistência do Sistema**: Evita acúmulo de erros no estoque

---

## Permissões

- **Perfil CPD**: Pode realizar ajustes nos porcionados do seu CPD
- **Perfil Admin**: Pode realizar ajustes em qualquer unidade
- **Perfil Loja**: Não pode ajustar estoque de porcionados (apenas visualizar)
