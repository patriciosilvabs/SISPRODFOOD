

# Plano: Salvamento Automático em Tempo Real (Auto-Save com Debounce)

## Diagnóstico

| Operação | Fluxo Atual | Fluxo Ideal |
|----------|-------------|-------------|
| **Venda Cardápio Web** | Tempo real (webhook) | ✅ Já está correto |
| **Ajuste manual sobra** | Requer clique em "Salvar" | ⚠️ Deveria ser automático |
| **Ajuste peso** | Requer clique em "Salvar" | ⚠️ Deveria ser automático |

O botão "Salvar Alterações" faz sentido em formulários tradicionais, mas **não combina** com um sistema de contagem Just-in-Time onde a produção depende de dados atualizados em tempo real.

---

## Solução: Auto-Save com Debounce

Implementar salvamento automático após cada alteração, com um pequeno delay (debounce) para evitar requisições excessivas enquanto o usuário digita.

### Fluxo Proposto

```text
Funcionário ajusta sobra: 50 → 51 → 52
         ↓
Debounce aguarda 800ms sem novas alterações
         ↓
Sistema salva automaticamente (sem clique)
         ↓
Toast discreto: "✓ Salvo" (fade out rápido)
         ↓
Produção atualizada em tempo real
```

---

## Mudanças Necessárias

### 1. Adicionar Auto-Save com Debounce

**Arquivo:** `src/pages/ContagemPorcionados.tsx`

Criar um `useEffect` que observa mudanças em `editingValues` e dispara o salvamento automático:

```typescript
// Hook de debounce para auto-save
const debouncedSave = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  // Limpar timeout anterior
  if (debouncedSave.current) {
    clearTimeout(debouncedSave.current);
  }

  // Verificar se há alterações pendentes
  const dirtyRows = getDirtyRows();
  if (dirtyRows.length === 0) return;

  // Agendar salvamento após 800ms de inatividade
  debouncedSave.current = setTimeout(async () => {
    for (const row of dirtyRows) {
      await executeSave(row.lojaId, row.itemId);
    }
  }, 800);

  return () => {
    if (debouncedSave.current) {
      clearTimeout(debouncedSave.current);
    }
  };
}, [editingValues]);
```

### 2. Substituir Toast Pesado por Indicador Discreto

Alterar o feedback visual de:
- **Antes:** Toast grande "Contagem salva! Sobra: 50 | Ideal: 100 | A Produzir: 50"
- **Depois:** Toast discreto "✓ Salvo" com fade-out rápido (1.5s)

```typescript
// Em executeSave, após sucesso:
toast.success('✓ Salvo', { 
  duration: 1500,
  position: 'bottom-right',
  style: { fontSize: '12px', padding: '8px 12px' }
});
```

### 3. Remover Botão "Salvar Alterações" do Footer

**Arquivo:** `src/components/contagem/ContagemFixedFooter.tsx`

O footer pode ser simplificado ou removido, já que não há mais ação pendente.

**Opção A - Remover footer completamente:**
```typescript
// Em ContagemPorcionados.tsx, remover:
<ContagemFixedFooter ... />
```

**Opção B - Manter footer apenas com status visual:**
Exibir um indicador de "Todas as alterações salvas" ou "Salvando..." quando houver operação em andamento.

### 4. Adicionar Indicador de Status de Salvamento

Criar um pequeno badge/indicator que mostra o estado atual:
- 🟢 "Salvo" (tudo sincronizado)
- 🟡 "Salvando..." (operação em andamento)
- 🔴 "Erro - Clique para tentar novamente" (fallback para retry manual)

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ContagemPorcionados.tsx` | Adicionar auto-save com debounce de 800ms, remover dependência do botão |
| `src/components/contagem/ContagemFixedFooter.tsx` | Simplificar ou remover (substituir por indicador de status) |

---

## Fluxo Operacional Após Implementação

```text
1. Funcionário clica no "+" para incrementar sobra
         ↓
2. editingValues atualiza imediatamente (50 → 51)
         ↓
3. useEffect detecta mudança, inicia debounce de 800ms
         ↓
4. Funcionário clica "+" novamente (51 → 52)
         ↓
5. Debounce reinicia (mais 800ms)
         ↓
6. 800ms sem alterações
         ↓
7. executeSave() dispara automaticamente
         ↓
8. Banco atualizado, produção recalculada
         ↓
9. Toast discreto "✓ Salvo" (desaparece em 1.5s)
```

---

## Vantagens

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Consistência** | Vendas em tempo real, contagem manual | Tudo em tempo real |
| **UX** | Funcionário precisa lembrar de salvar | Zero fricção |
| **Risco de perda de dados** | Se esquecer de salvar, perde alterações | Impossível perder |
| **Sincronização** | Produção desatualizada até salvar | Sempre atualizada |

---

## Fallback para Falhas

Se o auto-save falhar:
1. Mostrar indicador vermelho "Erro de sincronização"
2. Manter botão de retry manual como fallback
3. Não bloquear a interface - permitir continuar editando
4. Tentar novamente automaticamente na próxima alteração

