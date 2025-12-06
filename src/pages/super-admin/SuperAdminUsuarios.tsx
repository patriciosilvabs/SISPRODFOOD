import { useEffect, useState } from 'react';
import { SuperAdminLayout } from '@/components/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Users, Shield, ShieldOff, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';

interface User {
  id: string;
  nome: string;
  email: string;
  created_at: string;
  roles: string[];
  organization?: {
    id: string;
    nome: string;
  };
}

export const SuperAdminUsuarios = () => {
  const { user: currentUser } = useAuth();
  const auditLog = useAuditLog();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [promotingUser, setPromotingUser] = useState<User | null>(null);
  const [demotingUser, setDemotingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [search, roleFilter, users]);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Fetch organization memberships
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('user_id, organization_id');

      // Fetch organizations
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, nome');

      // Map roles to users
      const rolesMap: Record<string, string[]> = {};
      roles?.forEach(r => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      });

      // Map memberships to organizations
      const membershipMap: Record<string, string> = {};
      memberships?.forEach(m => {
        membershipMap[m.user_id] = m.organization_id;
      });

      // Map organization ids to organization data
      const orgsMap: Record<string, { id: string; nome: string }> = {};
      orgs?.forEach(o => {
        orgsMap[o.id] = o;
      });

      const usersWithData = profiles?.map(p => ({
        ...p,
        roles: rolesMap[p.id] || [],
        organization: membershipMap[p.id] ? orgsMap[membershipMap[p.id]] : undefined,
      })) || [];

      setUsers(usersWithData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        user => 
          user.nome.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
      );
    }

    if (roleFilter !== 'all') {
      if (roleFilter === 'SuperAdmin') {
        filtered = filtered.filter(user => user.roles.includes('SuperAdmin'));
      } else if (roleFilter === 'no-role') {
        filtered = filtered.filter(user => user.roles.length === 0);
      } else {
        filtered = filtered.filter(user => user.roles.includes(roleFilter));
      }
    }

    setFilteredUsers(filtered);
  };

  const handlePromoteToSuperAdmin = async () => {
    if (!promotingUser) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: promotingUser.id,
          role: 'SuperAdmin',
        });

      if (error) throw error;

      // Log de auditoria
      await auditLog.log('superadmin.promote', 'user', promotingUser.id, {
        target_email: promotingUser.email,
        target_name: promotingUser.nome,
        previous_roles: promotingUser.roles,
      });

      toast.success(`${promotingUser.nome} promovido a Super Admin`);
      setPromotingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error promoting user:', error);
      toast.error('Erro ao promover usuário');
    }
  };

  const handleDemoteFromSuperAdmin = async () => {
    if (!demotingUser) return;

    // Prevent demoting yourself
    if (demotingUser.id === currentUser?.id) {
      toast.error('Você não pode remover seu próprio acesso de Super Admin');
      setDemotingUser(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', demotingUser.id)
        .eq('role', 'SuperAdmin');

      if (error) throw error;

      // Log de auditoria
      await auditLog.log('superadmin.demote', 'user', demotingUser.id, {
        target_email: demotingUser.email,
        target_name: demotingUser.nome,
        previous_roles: demotingUser.roles,
      });

      toast.success(`${demotingUser.nome} removido de Super Admin`);
      setDemotingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error demoting user:', error);
      toast.error('Erro ao remover usuário');
    }
  };

  const getRoleBadges = (roles: string[]) => {
    if (roles.length === 0) {
      return <Badge variant="outline">Sem role</Badge>;
    }

    return roles.map(role => {
      switch (role) {
        case 'SuperAdmin':
          return <Badge key={role} className="bg-destructive">{role}</Badge>;
        case 'Admin':
          return <Badge key={role} className="bg-red-500">{role}</Badge>;
        case 'Produção':
          return <Badge key={role} className="bg-blue-500">{role}</Badge>;
        case 'Loja':
          return <Badge key={role} className="bg-green-500">{role}</Badge>;
        default:
          return <Badge key={role} variant="secondary">{role}</Badge>;
      }
    });
  };

  return (
    <SuperAdminLayout title="Usuários">
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-sm text-muted-foreground">Total de Usuários</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-destructive">
                {users.filter(u => u.roles.includes('SuperAdmin')).length}
              </div>
              <p className="text-sm text-muted-foreground">Super Admins</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">
                {users.filter(u => u.roles.includes('Admin')).length}
              </div>
              <p className="text-sm text-muted-foreground">Admins de Org</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">
                {users.filter(u => u.roles.length === 0).length}
              </div>
              <p className="text-sm text-muted-foreground">Sem Role</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Todos os Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="SuperAdmin">Super Admin</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Produção">Produção</SelectItem>
                  <SelectItem value="Loja">Loja</SelectItem>
                  <SelectItem value="no-role">Sem Role</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const isSuperAdmin = user.roles.includes('SuperAdmin');
                    const isCurrentUser = user.id === currentUser?.id;

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {user.nome}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.organization ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {user.organization.nome}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {getRoleBadges(user.roles)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          {isSuperAdmin ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDemotingUser(user)}
                              disabled={isCurrentUser}
                              className="gap-1"
                            >
                              <ShieldOff className="h-4 w-4" />
                              Remover
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPromotingUser(user)}
                              className="gap-1"
                            >
                              <Shield className="h-4 w-4" />
                              Promover
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Promote Confirmation */}
      <AlertDialog open={!!promotingUser} onOpenChange={() => setPromotingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promover a Super Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja promover <strong>{promotingUser?.nome}</strong> a Super Admin?
              Este usuário terá acesso total ao sistema, incluindo todas as organizações e dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromoteToSuperAdmin}>
              Promover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demote Confirmation */}
      <AlertDialog open={!!demotingUser} onOpenChange={() => setDemotingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Super Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{demotingUser?.nome}</strong> de Super Admin?
              Este usuário perderá o acesso ao painel administrativo e às demais organizações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDemoteFromSuperAdmin} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
};
