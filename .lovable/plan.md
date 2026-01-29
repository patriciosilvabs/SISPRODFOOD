

# Plano: Ocultar "Itens Aguardando Gatilho Mínimo" para Operadores

## Contexto

O componente **BacklogIndicator** exibe informações técnicas sobre itens que ainda não atingiram o volume mínimo para iniciar produção. Esta informação é relevante apenas para administradores que precisam entender por que certos itens não estão aparecendo na fila de produção.

Para operadores do CPD, essa informação:
- É confusa e desnecessária
- Adiciona ruído visual à interface
- Não é acionável (operadores não podem modificar gatilhos)

---

## Solução

Adicionar uma verificação condicional para renderizar o `BacklogIndicator` apenas quando o usuário for Admin ou SuperAdmin.

---

## Modificação Necessária

**Arquivo**: `src/pages/ResumoDaProducao.tsx`

**Localização**: Linhas 2044-2051

**Antes**:
```tsx
{/* Indicador de itens aguardando gatilho mínimo */}
<BacklogIndicator 
  backlogItems={backlogItems}
  onForcarProducao={...}
/>
```

**Depois**:
```tsx
{/* Indicador de itens aguardando gatilho mínimo - apenas para Admins */}
{isAdmin() && (
  <BacklogIndicator 
    backlogItems={backlogItems}
    onForcarProducao={...}
  />
)}
```

---

## Verificação

O hook `isAdmin()` já está disponível no componente (linha 143):
```tsx
const { user, profile, isAdmin } = useAuth();
```

E `isAdmin()` retorna `true` para usuários com role `Admin` ou `SuperAdmin`.

---

## Resultado

| Perfil | Vê "Itens Aguardando Gatilho" |
|--------|-------------------------------|
| Admin | ✅ Sim |
| SuperAdmin | ✅ Sim |
| Produção (CPD) | ❌ Não |
| Loja | ❌ Não |

