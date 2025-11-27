import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nome, userId } = await req.json();

    if (!nome || !userId) {
      throw new Error('Nome da organização e userId são obrigatórios');
    }

    if (nome.length < 3 || nome.length > 100) {
      throw new Error('Nome da organização deve ter entre 3 e 100 caracteres');
    }

    // Usar service_role_key para bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Gerar slug único a partir do nome
    let slug = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-') // Remove hífens duplicados
      .trim();

    // Verificar se slug já existe e adicionar sufixo numérico se necessário
    let slugFinal = slug;
    let contador = 1;
    
    while (true) {
      const { data: existente } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', slugFinal)
        .single();

      if (!existente) break;
      
      slugFinal = `${slug}-${contador}`;
      contador++;
    }

    console.log('Criando organização:', { nome, slug: slugFinal, userId });

    // 1. Criar organização
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        nome,
        slug: slugFinal,
        ativo: true
      })
      .select()
      .single();

    if (orgError) {
      console.error('Erro ao criar organização:', orgError);
      throw new Error(`Erro ao criar organização: ${orgError.message}`);
    }

    console.log('Organização criada:', org);

    // 2. Adicionar usuário como membro Admin da organização
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        user_id: userId,
        organization_id: org.id,
        role: 'Admin'
      });

    if (memberError) {
      console.error('Erro ao adicionar membro:', memberError);
      throw new Error(`Erro ao adicionar membro: ${memberError.message}`);
    }

    console.log('Usuário adicionado como membro Admin');

    // 3. Adicionar role Admin na tabela user_roles
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'Admin'
      });

    if (roleError) {
      console.error('Erro ao adicionar role:', roleError);
      throw new Error(`Erro ao adicionar role: ${roleError.message}`);
    }

    console.log('Role Admin atribuída ao usuário');

    return new Response(
      JSON.stringify({
        success: true,
        organization: org,
        message: 'Organização criada com sucesso!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na edge function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
