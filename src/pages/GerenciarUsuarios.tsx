import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Trash2, User, Mail, Calendar, UserPlus, Clock, XCircle, Send, Loader2, Shield, Store, Key } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PermissionsEditor } from '@/components/permissions/PermissionsEditor';
import { PERMISSIONS_CONFIG } from '@/lib/permissions';
import { UIPermissionsConfig } from '@/lib/ui-permissions-config';
import { useAuditLog } from '@/hooks/useAuditLog';

interface Profile {
  id: string;
  nome: string;
  email: string;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: 'Admin' | 'Produção' | 'Loja';
}

interface LojaAcesso {
  user_id: string;
  loja_id: string;
}

interface Loja {
  id: string;
  nome: string;
}

interface UsuarioCompleto extends Profile {
  roles: string[];
  lojas: { id: string; nome: string }[];
  permissions: string[];
  isAdmin: boolean;
}

interface ConvitePendente {
  id: string;
  email: string;
  roles: string[];
  lojas_ids: string[];
  status: string;
  expires_at: string;
  created_at: string;
  convidado_por_nome: string;
}

const roleLabels: Record<string, { label: string; color: string; description: string }> = {
  'Admin': { 
    label: 'Admin', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    description: 'Acesso total ao sistema (todas as permissões)'
  },
};

const GerenciarUsuarios = () => {
  const { user: currentUser, isAdmin: currentUserIsAdmin } = useAuth();
  const { organizationId } = useOrganization();
  const auditLog = useAuditLog();
  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([]);
  const [convitesPendentes, setConvitesPendentes] = useState<ConvitePendente[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioCompleto | null>(null);
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedLojas, setSelectedLojas] = useState<string[]>([]);
  const [selectedUIPermissions, setSelectedUIPermissions] = useState<Record<string, UIPermissionsConfig>>({});
  const [saving, setSaving] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UsuarioCompleto | null>(null);
  
  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
  const [invitePermissions, setInvitePermissions] = useState<string[]>([]);
  const [inviteLojas, setInviteLojas] = useState<string[]>([]);
  const [inviteUIPermissions, setInviteUIPermissions] = useState<Record<string, UIPermissionsConfig>>({});
  const [sendingInvite, setSendingInvite] = useState(false);
  
  // Cancel invite dialog state
  const [cancelInviteDialogOpen, setCancelInviteDialogOpen] = useState(false);
  const [cancelingInvite, setCancelingInvite] = useState<ConvitePendente | null>(null);

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (!organizationId) {
        setLoading(false);
        return;
      }
      
      // Buscar membros da organização primeiro
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId);

      if (membersError) throw membersError;

      const memberUserIds = (members || []).map(m => m.user_id);

      if (memberUserIds.length === 0) {
        setUsuarios([]);
        setLoading(false);
        return;
      }

      // Buscar profiles dos membros da organização
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', memberUserIds)
        .order('nome');

      if (profilesError) throw profilesError;

      // Buscar roles dos membros
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', memberUserIds);

      if (rolesError) throw rolesError;

      // Buscar lojas da organização
      const { data: lojasData, error: lojasError } = await supabase
        .from('lojas')
        .select('*')
        .eq('organization_id', organizationId)
        .order('nome');

      if (lojasError) throw lojasError;
      setLojas(lojasData || []);

      // Buscar acessos às lojas dos membros
      const { data: lojasAcesso, error: lojasAcessoError } = await supabase
        .from('lojas_acesso')
        .select('user_id, loja_id')
        .in('user_id', memberUserIds);

      if (lojasAcessoError) throw lojasAcessoError;

      // Buscar permissões granulares
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('user_id, permission_key')
        .in('user_id', memberUserIds)
        .eq('granted', true);

      if (permissionsError) console.error('Erro ao buscar permissões:', permissionsError);

      // Buscar convites pendentes
      const { data: convites, error: convitesError } = await supabase
        .from('convites_pendentes')
        .select('*')
        .eq('status', 'pendente')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (convitesError) {
        console.error('Erro ao buscar convites:', convitesError);
      } else {
        setConvitesPendentes(convites || []);
      }

      // Combinar dados
      const usuariosCompletos: UsuarioCompleto[] = (profiles || []).map(profile => {
        const userRoles = (roles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => r.role);

        const userLojas = (lojasAcesso || [])
          .filter(la => la.user_id === profile.id)
          .map(la => {
            const loja = lojasData?.find(l => l.id === la.loja_id);
            return {
              id: la.loja_id,
              nome: loja?.nome || 'Loja Desconhecida'
            };
          });

        const userPermissions = (permissionsData || [])
          .filter(p => p.user_id === profile.id)
          .map(p => p.permission_key);

        return {
          ...profile,
          roles: userRoles,
          lojas: userLojas,
          permissions: userPermissions,
          isAdmin: userRoles.includes('Admin'),
        };
      });

      setUsuarios(usuariosCompletos);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (usuario: UsuarioCompleto) => {
    setEditingUser(usuario);
    setIsAdminRole(usuario.isAdmin);
    setSelectedPermissions(usuario.permissions);
    setSelectedLojas(usuario.lojas.map(l => l.id));
    setSelectedUIPermissions({});
    setEditModalOpen(true);
  };

  const handleDeleteClick = (usuario: UsuarioCompleto) => {
    setDeletingUser(usuario);
    setDeleteDialogOpen(true);
  };

  const handleLojaToggle = (lojaId: string) => {
    setSelectedLojas(prev =>
      prev.includes(lojaId)
        ? prev.filter(id => id !== lojaId)
        : [...prev, lojaId]
    );
  };

  const handleSave = async () => {
    if (!editingUser || !organizationId) return;

    // Validação: não permitir que admin remova seu próprio role
    if (editingUser.id === currentUser?.id && editingUser.isAdmin && !isAdminRole) {
      toast.error('Você não pode remover seu próprio role de Admin');
      return;
    }

    try {
      setSaving(true);

      // 1. Atualizar roles (manter apenas Admin ou remover)
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.id);

      if (isAdminRole) {
        await supabase
          .from('user_roles')
          .insert({ user_id: editingUser.id, role: 'Admin' });
      }

      // 2. Atualizar permissões granulares (apenas se não for admin)
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', editingUser.id)
        .eq('organization_id', organizationId);

      if (!isAdminRole && selectedPermissions.length > 0) {
        const permissionsToInsert = selectedPermissions.map(perm => ({
          user_id: editingUser.id,
          organization_id: organizationId,
          permission_key: perm,
          granted: true,
        }));

        const { error: permError } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (permError) throw permError;
      }

      // 4. Atualizar UI permissions por usuário
      if (!isAdminRole && Object.keys(selectedUIPermissions).length > 0) {
        // Deletar UI permissions existentes do usuário
        await supabase
          .from('ui_permissions')
          .delete()
          .eq('user_id', editingUser.id)
          .eq('organization_id', organizationId);

        // Inserir novas UI permissions
        const uiPermissionsToInsert = Object.entries(selectedUIPermissions).map(([paginaId, config]) => ({
          user_id: editingUser.id,
          organization_id: organizationId,
          pagina_id: paginaId,
          config: JSON.parse(JSON.stringify(config)),
        }));

        if (uiPermissionsToInsert.length > 0) {
          const { error: uiPermError } = await supabase
            .from('ui_permissions')
            .insert(uiPermissionsToInsert);

          if (uiPermError) console.error('Erro ao salvar UI permissions:', uiPermError);
        }
      }

      // 5. Atualizar lojas
      await supabase
        .from('lojas_acesso')
        .delete()
        .eq('user_id', editingUser.id);

      if (selectedLojas.length > 0) {
        const lojasData = selectedLojas.map(lojaId => ({
          user_id: editingUser.id,
          loja_id: lojaId,
          organization_id: organizationId,
        }));
        const { error: lojasError } = await supabase
          .from('lojas_acesso')
          .insert(lojasData);

        if (lojasError) throw lojasError;
      }

      // Log de auditoria
      await auditLog.log('role.assign', 'user', editingUser.id, {
        target_email: editingUser.email,
        target_name: editingUser.nome,
        role: isAdminRole ? 'Admin' : 'Custom',
        previous_roles: editingUser.roles,
        new_permissions: selectedPermissions,
        new_lojas: selectedLojas,
      });

      toast.success('Usuário atualizado com sucesso!');
      setEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast.error('Erro ao salvar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser || !organizationId) return;

    // Validação: não permitir que admin delete a si mesmo
    if (deletingUser.id === currentUser?.id) {
      toast.error('Você não pode deletar sua própria conta');
      setDeleteDialogOpen(false);
      return;
    }

    try {
      // Remover roles, permissões e acessos
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', deletingUser.id);

      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', deletingUser.id)
        .eq('organization_id', organizationId);

      await supabase
        .from('lojas_acesso')
        .delete()
        .eq('user_id', deletingUser.id);

      // Log de auditoria
      await auditLog.log('user.remove', 'user', deletingUser.id, {
        target_email: deletingUser.email,
        target_name: deletingUser.nome,
        removed_roles: deletingUser.roles,
        removed_permissions: deletingUser.permissions,
      });

      toast.success('Permissões do usuário removidas com sucesso');
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao remover permissões:', error);
      toast.error('Erro ao remover permissões do usuário');
    }
  };

  // Invite handlers
  const handleInviteLojaToggle = (lojaId: string) => {
    setInviteLojas(prev =>
      prev.includes(lojaId)
        ? prev.filter(id => id !== lojaId)
        : [...prev, lojaId]
    );
  };

  const handleSendInvite = async () => {
    if (!inviteEmail) {
      toast.error('Preencha o email');
      return;
    }

    if (!inviteIsAdmin && invitePermissions.length === 0) {
      toast.error('Selecione pelo menos uma permissão ou marque como Admin');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error('Email inválido');
      return;
    }

    try {
      setSendingInvite(true);

      // Montar roles baseado nas seleções
      const roles = inviteIsAdmin ? ['Admin'] : [];

      const { data, error } = await supabase.functions.invoke('convidar-funcionario', {
        body: {
          email: inviteEmail.toLowerCase().trim(),
          roles: roles,
          lojas_ids: inviteLojas,
          permissions: inviteIsAdmin ? [] : invitePermissions,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(data.message || 'Convite enviado com sucesso!');
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteIsAdmin(false);
      setInvitePermissions([]);
      setInviteLojas([]);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao enviar convite:', error);
      toast.error(error.message || 'Erro ao enviar convite');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCancelInvite = async () => {
    if (!cancelingInvite) return;

    try {
      const { error } = await supabase
        .from('convites_pendentes')
        .update({ status: 'cancelado' })
        .eq('id', cancelingInvite.id);

      if (error) throw error;

      toast.success('Convite cancelado');
      setCancelInviteDialogOpen(false);
      setCancelingInvite(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao cancelar convite:', error);
      toast.error('Erro ao cancelar convite');
    }
  };

  const handleResendInvite = async (convite: ConvitePendente) => {
    try {
      // Delete old invite and create new one
      await supabase
        .from('convites_pendentes')
        .delete()
        .eq('id', convite.id);

      const { data, error } = await supabase.functions.invoke('convidar-funcionario', {
        body: {
          email: convite.email,
          roles: convite.roles,
          lojas_ids: convite.lojas_ids,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Convite reenviado com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Erro ao reenviar convite:', error);
      toast.error(error.message || 'Erro ao reenviar convite');
    }
  };

  const getLojaNameById = (lojaId: string) => {
    const loja = lojas.find(l => l.id === lojaId);
    return loja?.nome || 'Loja Desconhecida';
  };

  const getPermissionCount = (permissions: string[]) => {
    return permissions.length;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
            <p className="text-muted-foreground mt-1">
              Configure permissões granulares e vincule lojas aos usuários
            </p>
          </div>
          <Button onClick={() => setInviteModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar Funcionário
          </Button>
        </div>

        {/* Pending Invites */}
        {convitesPendentes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Convites Pendentes ({convitesPendentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {convitesPendentes.map((convite) => (
                  <div 
                    key={convite.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{convite.email}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {convite.roles.includes('Admin') ? (
                          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Key className="h-3 w-3 mr-1" />
                            Permissões personalizadas
                          </Badge>
                        )}
                        {convite.lojas_ids.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            • {convite.lojas_ids.map(id => getLojaNameById(id)).join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Convidado por {convite.convidado_por_nome} em{' '}
                        {format(new Date(convite.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {' • Expira em '}
                        {format(new Date(convite.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResendInvite(convite)}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Reenviar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCancelingInvite(convite);
                          setCancelInviteDialogOpen(true);
                        }}
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users Table */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando usuários...
              </div>
            ) : usuarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário cadastrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Permissões</TableHead>
                      <TableHead>Lojas</TableHead>
                      <TableHead>Data Criação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {usuario.nome}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {usuario.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {usuario.isAdmin ? (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Key className="h-3 w-3 mr-1" />
                              Personalizado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {usuario.isAdmin ? (
                            <span className="text-sm text-muted-foreground">Acesso total</span>
                          ) : usuario.permissions.length > 0 ? (
                            <Badge variant="secondary">
                              {getPermissionCount(usuario.permissions)} permissão(ões)
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Sem permissões</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {usuario.lojas.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Store className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{usuario.lojas.length}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(usuario.created_at), 'dd/MM/yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditClick(usuario)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(usuario)}
                              disabled={usuario.id === currentUser?.id}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Convidar Funcionário
            </DialogTitle>
            <DialogDescription>
              Envie um convite por email para adicionar um novo funcionário ao sistema
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email do Funcionário *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="funcionario@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              {/* Admin Toggle */}
              <div className="flex items-start space-x-3 p-4 rounded-lg border bg-muted/30">
                <Checkbox
                  id="invite-admin"
                  checked={inviteIsAdmin}
                  onCheckedChange={(checked) => setInviteIsAdmin(!!checked)}
                />
                <div className="flex-1">
                  <label htmlFor="invite-admin" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    Tornar Administrador
                  </label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Administradores têm acesso total ao sistema sem restrições
                  </p>
                </div>
              </div>

              {/* Permissions (only if not admin) */}
              {!inviteIsAdmin && (
                <Tabs defaultValue="permissions" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="permissions" className="flex-1">
                      <Key className="h-4 w-4 mr-2" />
                      Permissões
                    </TabsTrigger>
                    <TabsTrigger value="lojas" className="flex-1">
                      <Store className="h-4 w-4 mr-2" />
                      Lojas ({inviteLojas.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="permissions" className="mt-4">
                    <PermissionsEditor 
                      selectedPermissions={invitePermissions}
                      onChange={setInvitePermissions}
                    />
                  </TabsContent>
                  <TabsContent value="lojas" className="mt-4">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Selecione as lojas que este usuário poderá acessar
                      </p>
                      {lojas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma loja cadastrada no sistema
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {lojas.map(loja => (
                            <div key={loja.id} className="flex items-center space-x-3 p-3 rounded-lg border">
                              <Checkbox
                                id={`invite-loja-${loja.id}`}
                                checked={inviteLojas.includes(loja.id)}
                                onCheckedChange={() => handleInviteLojaToggle(loja.id)}
                              />
                              <label
                                htmlFor={`invite-loja-${loja.id}`}
                                className="text-sm font-medium leading-none cursor-pointer flex-1"
                              >
                                {loja.nome}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSendInvite} 
              disabled={sendingInvite || !inviteEmail || (!inviteIsAdmin && invitePermissions.length === 0)}
            >
              {sendingInvite ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Convite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Configure as permissões e lojas do usuário
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="flex-1 overflow-y-auto max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                {/* User Info */}
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">{editingUser.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-5 w-5" />
                    <span>{editingUser.email}</span>
                  </div>
                </div>

                {/* Admin Toggle */}
                <div className="flex items-start space-x-3 p-4 rounded-lg border bg-muted/30">
                  <Checkbox
                    id="edit-admin"
                    checked={isAdminRole}
                    onCheckedChange={(checked) => setIsAdminRole(!!checked)}
                    disabled={editingUser.id === currentUser?.id && editingUser.isAdmin}
                  />
                  <div className="flex-1">
                    <label htmlFor="edit-admin" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-600" />
                      Administrador
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Administradores têm acesso total ao sistema sem restrições
                    </p>
                    {editingUser.id === currentUser?.id && editingUser.isAdmin && (
                      <p className="text-xs text-amber-600 mt-2">
                        Você não pode remover seu próprio role de Admin
                      </p>
                    )}
                  </div>
                </div>

                {/* Permissions (only if not admin) */}
                {!isAdminRole && (
                  <Tabs defaultValue="permissions" className="w-full">
                    <TabsList className="w-full">
                      <TabsTrigger value="permissions" className="flex-1">
                        <Key className="h-4 w-4 mr-2" />
                        Permissões
                      </TabsTrigger>
                      <TabsTrigger value="lojas" className="flex-1">
                        <Store className="h-4 w-4 mr-2" />
                        Lojas ({selectedLojas.length})
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="permissions" className="mt-4">
                      <PermissionsEditor 
                        selectedPermissions={selectedPermissions}
                        onChange={setSelectedPermissions}
                        userId={editingUser?.id}
                        organizationId={organizationId || undefined}
                        onUIPermissionsChange={setSelectedUIPermissions}
                        initialUIPermissions={selectedUIPermissions}
                      />
                    </TabsContent>
                    <TabsContent value="lojas" className="mt-4">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Selecione as lojas que este usuário poderá acessar
                        </p>
                        {lojas.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma loja cadastrada no sistema
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {lojas.map(loja => (
                              <div key={loja.id} className="flex items-center space-x-3 p-3 rounded-lg border">
                                <Checkbox
                                  id={`loja-${loja.id}`}
                                  checked={selectedLojas.includes(loja.id)}
                                  onCheckedChange={() => handleLojaToggle(loja.id)}
                                />
                                <label
                                  htmlFor={`loja-${loja.id}`}
                                  className="text-sm font-medium leading-none cursor-pointer flex-1"
                                >
                                  {loja.nome}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Permissões do Usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingUser && (
                <>
                  Isso removerá todas as permissões e vínculos de lojas do usuário{' '}
                  <span className="font-semibold">{deletingUser.nome}</span>.
                  <br /><br />
                  O perfil do usuário será mantido, mas ele não terá mais acesso ao sistema até que novas permissões sejam atribuídas.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remover Permissões
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invite Dialog */}
      <AlertDialog open={cancelInviteDialogOpen} onOpenChange={setCancelInviteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Convite?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelingInvite && (
                <>
                  O convite enviado para <span className="font-semibold">{cancelingInvite.email}</span> será cancelado
                  e não poderá mais ser aceito.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelInvite} className="bg-destructive hover:bg-destructive/90">
              Cancelar Convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default GerenciarUsuarios;
