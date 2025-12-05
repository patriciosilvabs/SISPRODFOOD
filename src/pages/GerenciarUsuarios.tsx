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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, User, Mail, Calendar, UserPlus, Clock, XCircle, Send, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
    description: 'Acesso total ao sistema'
  },
  'Produção': { 
    label: 'Produção', 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: 'Gerencia produção e estoque CPD'
  },
  'Loja': { 
    label: 'Loja', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    description: 'Acessa contagens e recebimentos'
  },
};

const GerenciarUsuarios = () => {
  const { user: currentUser } = useAuth();
  const { organizationId } = useOrganization();
  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([]);
  const [convitesPendentes, setConvitesPendentes] = useState<ConvitePendente[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioCompleto | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedLojas, setSelectedLojas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UsuarioCompleto | null>(null);
  
  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoles, setInviteRoles] = useState<string[]>([]);
  const [inviteLojas, setInviteLojas] = useState<string[]>([]);
  const [sendingInvite, setSendingInvite] = useState(false);
  
  // Cancel invite dialog state
  const [cancelInviteDialogOpen, setCancelInviteDialogOpen] = useState(false);
  const [cancelingInvite, setCancelingInvite] = useState<ConvitePendente | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Buscar profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('nome');

      if (profilesError) throw profilesError;

      // Buscar roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Buscar lojas
      const { data: lojasData, error: lojasError } = await supabase
        .from('lojas')
        .select('*')
        .order('nome');

      if (lojasError) throw lojasError;
      setLojas(lojasData || []);

      // Buscar acessos às lojas
      const { data: lojasAcesso, error: lojasAcessoError } = await supabase
        .from('lojas_acesso')
        .select('user_id, loja_id');

      if (lojasAcessoError) throw lojasAcessoError;

      // Buscar convites pendentes
      const { data: convites, error: convitesError } = await supabase
        .from('convites_pendentes')
        .select('*')
        .eq('status', 'pendente')
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

        return {
          ...profile,
          roles: userRoles,
          lojas: userLojas,
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
    setSelectedRoles(usuario.roles);
    setSelectedLojas(usuario.lojas.map(l => l.id));
    setEditModalOpen(true);
  };

  const handleDeleteClick = (usuario: UsuarioCompleto) => {
    setDeletingUser(usuario);
    setDeleteDialogOpen(true);
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleLojaToggle = (lojaId: string) => {
    setSelectedLojas(prev =>
      prev.includes(lojaId)
        ? prev.filter(id => id !== lojaId)
        : [...prev, lojaId]
    );
  };

  const handleSave = async () => {
    if (!editingUser) return;

    // Validação: não permitir que admin remova seu próprio role
    if (editingUser.id === currentUser?.id && !selectedRoles.includes('Admin')) {
      toast.error('Você não pode remover seu próprio role de Admin');
      return;
    }

    try {
      setSaving(true);

      // 1. Atualizar roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.id);

      if (selectedRoles.length > 0) {
        const rolesData = selectedRoles.map(role => ({
          user_id: editingUser.id,
          role: role as 'Admin' | 'Produção' | 'Loja'
        }));
        const { error: rolesError } = await supabase
          .from('user_roles')
          .insert(rolesData);

        if (rolesError) throw rolesError;
      }

      // 2. Atualizar lojas
      await supabase
        .from('lojas_acesso')
        .delete()
        .eq('user_id', editingUser.id);

      if (selectedLojas.length > 0) {
        if (!organizationId) {
          toast.error('Organização não identificada. Faça login novamente.');
          return;
        }

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
    if (!deletingUser) return;

    // Validação: não permitir que admin delete a si mesmo
    if (deletingUser.id === currentUser?.id) {
      toast.error('Você não pode deletar sua própria conta');
      setDeleteDialogOpen(false);
      return;
    }

    try {
      // Remover roles e acessos (devido ao cascade, profile será mantido)
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', deletingUser.id);

      await supabase
        .from('lojas_acesso')
        .delete()
        .eq('user_id', deletingUser.id);

      toast.success('Permissões do usuário removidas com sucesso');
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao remover permissões:', error);
      toast.error('Erro ao remover permissões do usuário');
    }
  };

  // Invite handlers
  const handleInviteRoleToggle = (role: string) => {
    setInviteRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleInviteLojaToggle = (lojaId: string) => {
    setInviteLojas(prev =>
      prev.includes(lojaId)
        ? prev.filter(id => id !== lojaId)
        : [...prev, lojaId]
    );
  };

  const handleSendInvite = async () => {
    if (!inviteEmail || inviteRoles.length === 0) {
      toast.error('Preencha o email e selecione pelo menos uma função');
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

      const { data, error } = await supabase.functions.invoke('convidar-funcionario', {
        body: {
          email: inviteEmail.toLowerCase().trim(),
          roles: inviteRoles,
          lojas_ids: inviteLojas,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(data.message || 'Convite enviado com sucesso!');
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteRoles([]);
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

  const isLojaRoleSelected = selectedRoles.includes('Loja');
  const isInviteLojaRoleSelected = inviteRoles.includes('Loja');

  const getLojaNameById = (lojaId: string) => {
    const loja = lojas.find(l => l.id === lojaId);
    return loja?.nome || 'Loja Desconhecida';
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
            <p className="text-muted-foreground mt-1">
              Atribua roles e vincule lojas aos usuários do sistema
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
                        <div className="flex flex-wrap gap-1">
                          {convite.roles.map((role) => (
                            <Badge key={role} variant="secondary" className={roleLabels[role]?.color || ''}>
                              {roleLabels[role]?.label || role}
                            </Badge>
                          ))}
                        </div>
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
                      <TableHead>Roles</TableHead>
                      <TableHead>Lojas Vinculadas</TableHead>
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
                          {usuario.roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {usuario.roles.map(role => (
                                <Badge 
                                  key={role} 
                                  variant="secondary"
                                  className={roleLabels[role]?.color || ''}
                                >
                                  {roleLabels[role]?.label || role}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sem permissões</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {usuario.lojas.length > 0 ? (
                            <div className="text-sm">
                              {usuario.lojas.map(l => l.nome).join(', ')}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Convidar Funcionário
            </DialogTitle>
            <DialogDescription>
              Envie um convite por email para adicionar um novo funcionário ao sistema
            </DialogDescription>
          </DialogHeader>

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

            {/* Roles Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Permissões (Roles) *</Label>
              <div className="space-y-3">
                {Object.entries(roleLabels).map(([role, info]) => (
                  <div key={role} className="flex items-start space-x-3 p-3 rounded-lg border">
                    <Checkbox
                      id={`invite-role-${role}`}
                      checked={inviteRoles.includes(role)}
                      onCheckedChange={() => handleInviteRoleToggle(role)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`invite-role-${role}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {info.label}
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {info.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lojas Section */}
            {isInviteLojaRoleSelected && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  Lojas Vinculadas
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    (para role "Loja")
                  </span>
                </Label>
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
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSendInvite} 
              disabled={sendingInvite || !inviteEmail || inviteRoles.length === 0}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atribua roles e vincule lojas ao usuário
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
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

              {/* Roles Section */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Permissões (Roles)</Label>
                <div className="space-y-3">
                  {Object.entries(roleLabels).map(([role, info]) => (
                    <div key={role} className="flex items-start space-x-3 p-3 rounded-lg border">
                      <Checkbox
                        id={`role-${role}`}
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={() => handleRoleToggle(role)}
                        disabled={role === 'Admin' && editingUser.id === currentUser?.id}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`role-${role}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {info.label}
                        </label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {editingUser.id === currentUser?.id && (
                  <p className="text-xs text-muted-foreground">
                    Você não pode remover seu próprio role de Admin
                  </p>
                )}
              </div>

              {/* Lojas Section */}
              {isLojaRoleSelected && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Lojas Vinculadas
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      (aparece quando role "Loja" está selecionado)
                    </span>
                  </Label>
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
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {loja.nome}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
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
                  Isso removerá todas as permissões (roles) e vínculos de lojas do usuário{' '}
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
