

# Plano: Botão Testar Conexão com API do Cardápio Web

## Objetivo

Adicionar um botão "Testar Conexão" em cada card de integração para verificar se o token configurado está funcionando corretamente com a Edge Function.

## Arquitetura do Teste

O teste enviará uma requisição simulada para a Edge Function usando o token da loja. A Edge Function:
1. Validará o token
2. Retornará sucesso se o token estiver ativo e válido
3. Retornará erro se o token for inválido ou inativo

## Alterações Necessárias

### Parte 1: Criar Edge Function de Teste

**Arquivo:** `supabase/functions/cardapio-web-test/index.ts`

Uma Edge Function leve que apenas valida o token sem processar pedidos:

```typescript
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = req.headers.get('X-API-KEY')
  
  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Token não fornecido' }),
      { status: 401 }
    )
  }

  // Validar token no banco
  const { data: integracao } = await supabase
    .from('integracoes_cardapio_web')
    .select('id, loja_id, ambiente, ativo')
    .eq('token', apiKey)
    .single()

  if (!integracao) {
    return new Response(
      JSON.stringify({ success: false, error: 'Token inválido' }),
      { status: 401 }
    )
  }

  if (!integracao.ativo) {
    return new Response(
      JSON.stringify({ success: false, error: 'Integração inativa' }),
      { status: 403 }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Conexão validada com sucesso!',
      ambiente: integracao.ambiente
    }),
    { status: 200 }
  )
})
```

### Parte 2: Adicionar Mutação de Teste no Hook

**Arquivo:** `src/hooks/useCardapioWebIntegracao.ts`

Adicionar uma mutação para testar a conexão:

```typescript
const testarConexao = useMutation({
  mutationFn: async (token: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cardapio-web-test`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': token,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Falha na conexão');
    }
    
    return data;
  }
});
```

### Parte 3: Adicionar Botão no Card

**Arquivo:** `src/components/cardapio-web/LojaIntegracaoCard.tsx`

Adicionar um botão "Testar Conexão" na seção de credenciais:

```
┌─────────────────────────────────────────────────────────────────────┐
│ UNIDADE ALEIXO                                        [Ativa] ⚫   │
│ Código: 8268  |  Ambiente: Sandbox                                  │
├─────────────────────────────────────────────────────────────────────┤
│ URL do Webhook: https://...../cardapio-web-webhook      [📋]       │
│ Token (X-API-KEY): ******** [👁] [📋] [🔄]                        │
│                                                                     │
│     [🔌 Testar Conexão]    ← NOVO BOTÃO                           │
│                                                                     │
│     ✅ Conexão validada! (ou ❌ Erro: Token inválido)              │
└─────────────────────────────────────────────────────────────────────┘
```

Lógica do botão:
- Estado `isTesting` para mostrar loading
- Estado `testResult` para exibir resultado
- Feedback visual: verde para sucesso, vermelho para erro

```typescript
const [testResult, setTestResult] = useState<{
  success: boolean;
  message: string;
} | null>(null);

const handleTestConnection = async () => {
  setTestResult(null);
  try {
    const result = await onTestConnection(integracao.token);
    setTestResult({ success: true, message: result.message });
  } catch (error) {
    setTestResult({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Erro desconhecido' 
    });
  }
};
```

---

## Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| **supabase/functions/cardapio-web-test** | Nova Edge Function para validar token |
| **supabase/config.toml** | Registrar nova função |
| **useCardapioWebIntegracao.ts** | Adicionar `testarConexao` mutation |
| **LojaIntegracaoCard.tsx** | Adicionar botão e feedback visual |
| **ConfigurarCardapioWeb.tsx** | Passar prop `onTestConnection` |

---

## Fluxo de Teste

1. Usuário clica em "Testar Conexão"
2. Frontend chama Edge Function com o token
3. Edge Function valida token no banco
4. Retorna sucesso/erro
5. Card exibe feedback visual:
   - ✅ **Verde**: "Conexão validada com sucesso!"
   - ❌ **Vermelho**: "Erro: [mensagem]"

---

## Benefícios

- **Validação imediata**: Confirma se as credenciais estão corretas
- **Debug fácil**: Identifica problemas antes de configurar no Cardápio Web
- **Feedback claro**: Usuário sabe exatamente se a integração está funcionando

