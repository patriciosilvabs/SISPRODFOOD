

# Plano: Corrigir Erros de Constraint e Overflow na Finalização de Produção

## Problemas Identificados

### 1. Erro de Constraint `consumo_historico_tipo_insumo_check`

**Código problemático (linha 1363 de ResumoDaProducao.tsx):**
```typescript
tipo_insumo: 'embalagem',  // ❌ Valor não permitido
```

**Constraint no banco:**
```sql
CHECK (tipo_insumo = ANY (ARRAY['principal', 'extra']))
```

O sistema tenta registrar consumo de embalagem com `tipo_insumo: 'embalagem'`, mas o constraint só aceita `'principal'` ou `'extra'`.

### 2. Erro de Overflow Numérico (código 22003)

**Campos afetados em `producao_registros`:**
| Campo | Precisão | Limite Máximo |
|-------|----------|---------------|
| peso_final_kg | 10,3 | 9.999.999,999 |
| sobra_kg | 10,3 | 9.999.999,999 |
| peso_programado_kg | 10,3 | 9.999.999,999 |

Se o usuário digitar valores absurdos (ex: 99999999) ou a conversão de `rawToKg` retornar valores muito grandes, o PostgreSQL rejeita o insert.

---

## Solução Proposta

### Parte 1: Corrigir Constraint do tipo_insumo

**Opção A - Adicionar 'embalagem' ao constraint:**
```sql
ALTER TABLE consumo_historico DROP CONSTRAINT consumo_historico_tipo_insumo_check;
ALTER TABLE consumo_historico ADD CONSTRAINT consumo_historico_tipo_insumo_check 
CHECK (tipo_insumo = ANY (ARRAY['principal', 'extra', 'embalagem']));
```

**Opção B - Usar 'extra' para embalagem (sem alterar banco):**
```typescript
tipo_insumo: 'extra',  // Embalagem é tratada como insumo extra
```

**Recomendação:** Opção A, pois embalagem tem significado próprio nos relatórios.

### Parte 2: Prevenir Overflow Numérico

Adicionar validação no frontend (FinalizarProducaoModal) ANTES de enviar ao banco:

```typescript
// Validação geral de peso (máximo 10.000 kg = 10 toneladas)
const MAX_PESO_KG = 9999.999; // Margem de segurança
if (pesoFinalKg > MAX_PESO_KG) {
  toast.error(`Peso final excede o máximo permitido (${MAX_PESO_KG} kg)`);
  return;
}
if (sobraKg > MAX_PESO_KG) {
  toast.error(`Sobra excede o máximo permitido (${MAX_PESO_KG} kg)`);
  return;
}
```

---

## Resumo das Mudanças

| Arquivo/Área | Mudança |
|--------------|---------|
| **Migração SQL** | Adicionar 'embalagem' ao constraint `consumo_historico_tipo_insumo_check` |
| **src/components/modals/FinalizarProducaoModal.tsx** | Adicionar validação de peso máximo (9999 kg) para evitar overflow |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Registrar consumo de embalagem | Erro 400 + constraint violation | Sucesso - tipo_insumo='embalagem' aceito |
| Digitar peso absurdo (ex: 99999999g) | Erro 400 + numeric overflow | Toast de erro amigável + bloqueio do submit |
| Finalizar produção normal | Funcionando (quando sem embalagem) | Funcionando (sempre) |

