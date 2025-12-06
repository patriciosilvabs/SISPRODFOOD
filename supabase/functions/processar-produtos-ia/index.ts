import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema de validação com Zod
const ProcessarProdutosSchema = z.object({
  texto: z.string()
    .min(1, "Texto não pode estar vazio")
    .max(50000, "Texto excede limite de 50.000 caracteres")
    .transform(val => val.trim()),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse e validar input com Zod
    const rawBody = await req.json();
    const parseResult = ProcessarProdutosSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: 'Dados inválidos', 
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { texto } = parseResult.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração de IA não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processando texto com IA:', texto.substring(0, 100), `(${texto.length} caracteres)`);

    const systemPrompt = `Você é um assistente especializado em extrair produtos de texto para um sistema de gestão.

Analise o texto fornecido e extraia uma lista de produtos com os seguintes campos:
- nome: nome do produto (obrigatório)
- codigo: código único do produto (se não fornecido, gere um baseado no nome, formato: ABC-001)
- categoria: uma das opções [congelado, refrigerado, ambiente, diversos, material_escritorio, material_limpeza, embalagens, descartaveis, equipamentos]
- unidade_consumo: unidade de medida (un, kg, L, cx, pc, etc)
- classificacao: A, B ou C (baseado em importância inferida do contexto)

Regras:
- Se a categoria não for clara, use "diversos"
- Se a classificação não for mencionada, use "B"
- Se a unidade não for clara, use "un"
- Códigos devem ser únicos e seguir padrão ABC-001, ABC-002, etc.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extraia os produtos do seguinte texto:\n\n${texto}` }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extrair_produtos',
              description: 'Extrai uma lista de produtos estruturados do texto fornecido',
              parameters: {
                type: 'object',
                properties: {
                  produtos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nome: { type: 'string', description: 'Nome do produto' },
                        codigo: { type: 'string', description: 'Código único do produto' },
                        categoria: { 
                          type: 'string', 
                          enum: ['congelado', 'refrigerado', 'ambiente', 'diversos', 'material_escritorio', 'material_limpeza', 'embalagens', 'descartaveis', 'equipamentos']
                        },
                        unidade_consumo: { type: 'string', description: 'Unidade de medida' },
                        classificacao: { type: 'string', enum: ['A', 'B', 'C'] }
                      },
                      required: ['nome', 'codigo', 'categoria', 'unidade_consumo', 'classificacao'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['produtos'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_produtos' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace Lovable.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro ao processar com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Resposta da IA recebida');

    // Extrair produtos do tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      console.error('Formato de resposta inesperado:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Formato de resposta inválido da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsedArgs = JSON.parse(toolCall.function.arguments);
    const produtos = parsedArgs.produtos || [];

    console.log(`${produtos.length} produtos extraídos`);

    return new Response(
      JSON.stringify({ produtos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao processar produtos com IA:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
