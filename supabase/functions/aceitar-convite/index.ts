import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AceitarConviteRequest {
  token: string;
  action: 'validate' | 'accept';
  password?: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { token, action, password } = await req.json() as AceitarConviteRequest;

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token de convite é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the pending invitation
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('convites_pendentes')
      .select('*, organizations(nome)')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      console.error('Error fetching invite:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Convite não encontrado ou inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate invite status
    if (invite.status !== 'pendente') {
      return new Response(
        JSON.stringify({ error: 'Este convite já foi utilizado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invite has expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: 'Este convite expirou' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If action is validate, just return invite info
    if (action === 'validate') {
      return new Response(
        JSON.stringify({
          success: true,
          email: invite.email,
          organizationName: invite.organizations?.nome || 'Organização',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action is 'accept' - need password
    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha é obrigatória e deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the user by email
    const { data: { users }, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listUsersError) {
      console.error('Error listing users:', listUsersError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = users.find(u => u.email?.toLowerCase() === invite.email.toLowerCase());

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado. Contate o administrador.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user password
    const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: password }
    );

    if (updatePasswordError) {
      console.error('Error updating password:', updatePasswordError);
      return new Response(
        JSON.stringify({ error: 'Erro ao definir senha' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already a member of the organization
    const { data: existingMember, error: memberCheckError } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', invite.organization_id)
      .maybeSingle();

    if (memberCheckError) {
      console.error('Error checking membership:', memberCheckError);
    }

    // If not already a member, add them
    if (!existingMember) {
      // Add user to organization_members
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          user_id: user.id,
          organization_id: invite.organization_id,
          role: invite.roles[0] || 'Loja',
        });

      if (memberError) {
        console.error('Error adding organization member:', memberError);
        return new Response(
          JSON.stringify({ error: 'Erro ao adicionar membro à organização' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Add user roles
    for (const role of invite.roles) {
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', role)
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: user.id,
            role: role,
          });

        if (roleError) {
          console.error('Error adding role:', role, roleError);
        }
      }
    }

    // Add store access if specified
    if (invite.lojas_ids && invite.lojas_ids.length > 0) {
      for (const lojaId of invite.lojas_ids) {
        const { data: existingAccess } = await supabaseAdmin
          .from('lojas_acesso')
          .select('id')
          .eq('user_id', user.id)
          .eq('loja_id', lojaId)
          .maybeSingle();

        if (!existingAccess) {
          const { error: accessError } = await supabaseAdmin
            .from('lojas_acesso')
            .insert({
              user_id: user.id,
              loja_id: lojaId,
              organization_id: invite.organization_id,
            });

          if (accessError) {
            console.error('Error adding store access:', lojaId, accessError);
          }
        }
      }
    }

    // Update invite status to accepted
    const { error: updateInviteError } = await supabaseAdmin
      .from('convites_pendentes')
      .update({
        status: 'aceito',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    if (updateInviteError) {
      console.error('Error updating invite status:', updateInviteError);
    }

    console.log(`Invite accepted successfully for user ${user.id} in organization ${invite.organization_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Convite aceito com sucesso! Bem-vindo à equipe.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
