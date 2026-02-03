

# Plano: Corrigir Stale Closure no Realtime do Cardápio Web

## Problema Identificado

O callback do realtime (linha 174) acessa `editingValues` diretamente, mas:

1. O `useEffect` tem dependências `[organizationId, itens]` - **não inclui `editingValues`**
2. Quando o useEffect é criado, captura a referência antiga de `editingValues`
3. Usuário clica em +/- → `editingValues` muda no React state
4. Cardápio Web envia venda → callback ainda vê `editingValues = {}` (valor antigo!)
5. Condição `editingValues[key]` retorna `undefined` → não aplica decremento

```text
useEffect criado → callback captura editingValues = {}
                            ↓
        editingValues muda para {'loja-item': {final_sobra: '251'}}
                            ↓
        callback AINDA vê editingValues = {} ← STALE CLOSURE!
```

## Conceito Correto (conforme o usuário explicou)

- **C. WEB mostra a última venda** (ex: 50 unidades)
- **SOBRA atual** deve ser decrementada por esse valor (250 - 50 = 200)
- Não é somatório, é simplesmente: `novaSobra = sobraAtual - valorCWeb`

## Solução

Usar um **useRef** para manter sempre a referência atualizada de `editingValues`:

```tsx
// 1. Criar ref para editingValues
const editingValuesRef = useRef(editingValues);

// 2. Manter ref sincronizado sempre que editingValues mudar
useEffect(() => {
  editingValuesRef.current = editingValues;
}, [editingValues]);

// 3. No callback do realtime, usar editingValuesRef.current
const currentEditing = editingValuesRef.current;
if (currentEditing[key] && isCardapioWebBaixa) {
  const sobraAtual = parseInt(currentEditing[key].final_sobra || '0');
  // ...
}
```

## Mudanças Técnicas

### Arquivo: `src/pages/ContagemPorcionados.tsx`

**1. Adicionar ref após a linha 109 (junto com outros estados)**
```tsx
const editingValuesRef = useRef<Record<string, any>>(editingValues);
```

**2. Adicionar useEffect para sincronizar o ref (após linha 158)**
```tsx
// Manter ref sincronizado para evitar stale closure no realtime
useEffect(() => {
  editingValuesRef.current = editingValues;
}, [editingValues]);
```

**3. Modificar o callback do realtime (linhas 184-203)** para usar `editingValuesRef.current`:

```tsx
// ANTES (stale closure):
if (editingValues[key] && !isCardapioWebBaixa) { ... }
if (editingValues[key] && isCardapioWebBaixa) {
  const sobraAtual = parseInt(editingValues[key].final_sobra || '0');

// DEPOIS (valor atual via ref):
const currentEditing = editingValuesRef.current;
if (currentEditing[key] && !isCardapioWebBaixa) { ... }
if (currentEditing[key] && isCardapioWebBaixa) {
  const sobraAtual = parseInt(currentEditing[key].final_sobra || '0');
```

## Fluxo Corrigido

```text
1. Usuário clica + → editingValues = {'loja-item': {final_sobra: '251'}}
2. useEffect [editingValues] → atualiza editingValuesRef.current
3. C. WEB envia venda de 10 unidades
4. Realtime callback executa:
   - currentEditing = editingValuesRef.current → vê valor ATUAL!
   - sobraAtual = 251
   - decremento = 10 (valor de C. WEB)
   - novaSobra = 251 - 10 = 241
5. UI atualiza: SOBRA = 241, C. WEB = 10
```

## Resultado Esperado

| Evento | SOBRA | C. WEB | Cálculo |
|--------|-------|--------|---------|
| Inicial | 250 | 0 | - |
| Venda de 50 un | 200 | 50 | 250 - 50 |
| Venda de 10 un | 190 | 10 | 200 - 10 |
| Venda de 5 un | 185 | 5 | 190 - 5 |

