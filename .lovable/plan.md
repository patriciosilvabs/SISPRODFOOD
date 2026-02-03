

# Plano: Corrigir Sincronização Realtime do Cardápio Web

## Problema Identificado

Analisando as duas imagens:
- **Imagem 1 (13:04)**: SOBRA = 250, C. WEB = 50 (50 vendas chegaram, mas SOBRA não decrementou!)
- **Imagem 2 (13:05)**: SOBRA = 230, C. WEB = 10 (só decrementou 20, não os 60 esperados)

O problema é uma **stale closure** no callback do realtime:

```text
useEffect → cria callback → callback usa editingValues
   ↓
editingValues muda → callback NÃO atualiza → vê valor antigo
```

O `useEffect` na linha 161 tem dependências `[organizationId, itens]`, mas o callback acessa `editingValues` diretamente. Isso significa que o callback sempre vê a versão ANTIGA de `editingValues` (quando o useEffect foi criado), não o valor atual.

### Exemplo do Bug:

1. Página carrega: `editingValues = {}` (vazio)
2. useEffect cria o callback de realtime com referência ao `editingValues` vazio
3. Usuário clica em + → `editingValues = { 'loja-item': { final_sobra: '251' } }`
4. Cardápio Web envia venda → callback verifica `editingValues['loja-item']`
5. **PROBLEMA**: Callback ainda vê `editingValues = {}` (closure desatualizada!)
6. Condição `editingValues[key]` retorna `undefined` → não aplica decremento no editingValues

## Solução

Usar um **ref** para manter a referência sempre atualizada de `editingValues`, evitando a stale closure:

```tsx
// Ref para acessar o valor atual dentro do realtime callback
const editingValuesRef = useRef<Record<string, EditingValue>>(editingValues);

// Manter ref sincronizado
useEffect(() => {
  editingValuesRef.current = editingValues;
}, [editingValues]);
```

E no callback do realtime, usar `editingValuesRef.current` em vez de `editingValues`:

```tsx
(payload) => {
  const updated = payload.new as Contagem;
  const key = `${updated.loja_id}-${updated.item_porcionado_id}`;
  const currentEditingValues = editingValuesRef.current; // ← Valor ATUAL
  
  // Verificar se é uma baixa do Cardápio Web
  const isCardapioWebBaixa = /* ... */;
  
  // Agora usa o valor atual corretamente
  if (currentEditingValues[key] && !isCardapioWebBaixa) {
    console.log(`🔒 Realtime: Item ${key} sendo editado...`);
    return;
  }
  
  if (currentEditingValues[key] && isCardapioWebBaixa) {
    const sobraAtual = parseInt(currentEditingValues[key].final_sobra || '0');
    // ...
  }
  // ...
}
```

## Mudanças Técnicas

### Arquivo: `src/pages/ContagemPorcionados.tsx`

**1. Adicionar ref após os estados (após linha ~100)**
```tsx
const editingValuesRef = useRef<Record<string, { final_sobra?: string; peso_total_g?: string }>>(editingValues);
```

**2. Adicionar useEffect para sincronizar o ref (antes do realtime useEffect)**
```tsx
useEffect(() => {
  editingValuesRef.current = editingValues;
}, [editingValues]);
```

**3. Modificar o callback do realtime (linhas 174-244)** para usar `editingValuesRef.current` em vez de `editingValues`:
- Linha 184: `if (editingValuesRef.current[key] && !isCardapioWebBaixa)`
- Linha 190: `if (editingValuesRef.current[key] && isCardapioWebBaixa)`
- Linha 191: `editingValuesRef.current[key].final_sobra`
- Linha 199-203: manter setEditingValues como está (o setter usa a função de atualização)

## Resultado Esperado

```text
ANTES (bugado):
┌─────────────────────────────────────────────────────┐
│  SOBRA: 250  │  C. WEB: 50  │  (closure desatualizada)
└─────────────────────────────────────────────────────┘

DEPOIS (corrigido):
┌─────────────────────────────────────────────────────┐
│  SOBRA: 200  │  C. WEB: 50  │  (decremento correto)
└─────────────────────────────────────────────────────┘
```

Quando o Cardápio Web enviar 50 vendas:
- `editingValuesRef.current` terá o valor ATUAL do estado
- O decremento será aplicado corretamente: 250 - 50 = 200
- A UI atualizará instantaneamente

