import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Todas as permissões do sistema para conceder ao Admin criador
const ALL_PERMISSIONS = [
  'dashboard.view',
  'producao.resumo.view',
  'producao.resumo.manage',
  'insumos.view',
  'insumos.manage',
  'estoque_cpd_produtos.view',
  'estoque_cpd_produtos.manage',
  'pedidos_compra.view',
  'pedidos_compra.manage',
  'pedidos_compra.receber',
  'romaneios_produtos.view',
  'romaneios_produtos.criar',
  'romaneios_produtos.enviar',
  'romaneios_produtos.receber',
  'contagem.view',
  'contagem.manage',
  'estoque_loja.view',
  'estoque_loja.manage',
  'reposicao_loja.view',
  'reposicao_loja.enviar',
  'romaneio.view',
  'romaneio.create',
  'romaneio.send',
  'romaneio.receive',
  'romaneio.history',
  'erros.view',
  'erros.create',
  'relatorios.producao',
  'relatorios.romaneios',
  'relatorios.estoque',
  'relatorios.insumos',
  'relatorios.consumo',
  'relatorios.diagnostico',
  'config.view',
  'config.insumos',
  'config.itens',
  'config.produtos',
  'config.lojas',
  'config.usuarios',
  'config.sistema',
  'config.interface',
  'compras.view',
  'compras.manage'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract and validate JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header é obrigatório');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create a client with anon key to verify the user's token
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authenticated user from the JWT token
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Erro ao validar usuário:', userError);
      throw new Error('Token inválido ou usuário não autenticado');
    }

    // Use the authenticated user's ID - NOT from request body
    const userId = user.id;
    console.log('Usuário autenticado:', userId);

    const { nome } = await req.json();

    if (!nome) {
      throw new Error('Nome da organização é obrigatório');
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

    // Verificar se o usuário já pertence a alguma organização
    const { data: existingMembership } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingMembership) {
      throw new Error('Usuário já pertence a uma organização');
    }

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

    // Calcular datas de trial (7 dias)
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    console.log('Criando organização:', { nome, slug: slugFinal, userId, trialEndDate: trialEndDate.toISOString() });

    // 1. Criar organização com dados de trial
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        nome,
        slug: slugFinal,
        ativo: true,
        subscription_status: 'trial',
        trial_start_date: now.toISOString(),
        trial_end_date: trialEndDate.toISOString()
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

    // 4. Conceder TODAS as permissões ao Admin criador
    const permissionsToInsert = ALL_PERMISSIONS.map(permKey => ({
      user_id: userId,
      organization_id: org.id,
      permission_key: permKey,
      granted: true
    }));

    const { error: permError } = await supabaseAdmin
      .from('user_permissions')
      .insert(permissionsToInsert);

    if (permError) {
      console.error('Erro ao conceder permissões:', permError);
      // Não falhar - Admin foi criado, permissões podem ser adicionadas depois
    } else {
      console.log(`${ALL_PERMISSIONS.length} permissões concedidas ao Admin`);
    }

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
