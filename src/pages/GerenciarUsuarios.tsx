import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, User, Mail, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

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
  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioCompleto | null>(null);
  const [deletingUser, setDeletingUser] = useState<UsuarioCompleto | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedLojas, setSelectedLojas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
        const lojasData = selectedLojas.map(lojaId => ({
          user_id: editingUser.id,
          loja_id: lojaId
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

  const isLojaRoleSelected = selectedRoles.includes('Loja');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Atribua roles e vincule lojas aos usuários do sistema
          </p>
        </div>

        {/* Table */}
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
                                  className={roleLabels[role].color}
                                >
                                  {roleLabels[role].label}
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

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>✏️ Editar Usuário</DialogTitle>
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
                    ℹ️ Você não pode remover seu próprio role de Admin
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
              {saving ? 'Salvando...' : '💾 Salvar'}
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
    </Layout>
  );
};

export default GerenciarUsuarios;
