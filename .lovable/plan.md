
# Plano: Exibir Data/Hora da Última Contagem por Loja

## Problema
No indicador de status das contagens, o usuário não consegue ver quando foi a última vez que cada loja enviou/atualizou sua contagem. Isso dificulta saber se a contagem está atualizada.

## Solução
Adicionar a exibição do horário da última atualização (`updated_at`) para cada loja que já enviou contagem.

---

## Mudanças Necessárias

### 1. Interface `ContagemData` - Adicionar campo de timestamp

Atualizar a interface no componente `ContagemStatusIndicator.tsx`:

```typescript
interface ContagemData {
  loja_id: string;
  loja_nome: string;
  totalItens: number;
  totalUnidades: number;
  ultimaAtualizacao?: string; // Novo campo: ISO timestamp
}
```

### 2. Consulta na página `ResumoDaProducao.tsx`

Modificar a lógica que calcula `contagensHoje` para buscar o MAX do `updated_at` diretamente da tabela `contagem_porcionados`:

```typescript
// Buscar contagens agrupadas por loja com timestamp mais recente
const { data: contagemDireta } = await supabase
  .from('contagem_porcionados')
  .select('loja_id, updated_at')
  .eq('organization_id', organizationId)
  .eq('dia_operacional', diaOperacional);

// Agregar por loja e pegar o MAX de updated_at
```

### 3. Exibição no Card da Loja

Adicionar o horário formatado abaixo do nome da loja:

```
┌────────────────────────────────────────────────────────┐
│ ✅ UNIDADE JAPIIM                   📦 6 itens • 423 un │
│    Atualizado: 14:32                                    │
└────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kanban/ContagemStatusIndicator.tsx` | Adicionar campo `ultimaAtualizacao` na interface e exibir timestamp formatado |
| `src/pages/ResumoDaProducao.tsx` | Modificar cálculo de `contagensHoje` para incluir MAX(updated_at) por loja |

---

## Formato de Exibição

- Se contagem de hoje: **"Atualizado: HH:mm"** (apenas hora)
- Se contagem de outro dia: **"Atualizado: DD/MM HH:mm"** (data e hora)

Exemplo visual:
```
✅ UNIDADE JAPIIM              📦 6 itens • 423 un
   Atualizado: 14:32
```
