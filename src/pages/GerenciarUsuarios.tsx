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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Pencil, Trash2, User, Mail, Calendar, UserPlus, Clock, XCircle, Send, Loader2, Shield, Store, Factory, FileText, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuditLog } from '@/hooks/useAuditLog';
import { SYSTEM_PAGES, PAGE_SECTIONS, PROFILE_DEFAULT_PAGES, getProfileLabel, UserProfile } from '@/lib/page-access-config';

interface Profile {
  id: string;
  nome: string;
  email: string;
  created_at: string;
}

interface Loja {
  id: string;
  nome: string;
  tipo: string;
}

interface PageAccessOverride {
  page_route: string;
  enabled: boolean;
}

interface UsuarioCompleto extends Profile {
  lojas: { id: string; nome: string; tipo: string }[];
  isAdmin: boolean;
  profile: UserProfile;
  pageOverrides: PageAccessOverride[];
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

const GerenciarUsuarios = () => {
  const { user: currentUser } = useAuth();
  const { organizationId } = useOrganization();
  const auditLog = useAuditLog();
  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([]);
  const [convitesPendentes, setConvitesPendentes] = useState<ConvitePendente[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioCompleto | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile>('loja');
  const [selectedLojas, setSelectedLojas] = useState<string[]>([]);
  const [pageOverrides, setPageOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UsuarioCompleto | null>(null);
  
  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSelectedProfile, setInviteSelectedProfile] = useState<UserProfile>('loja');
  const [inviteLojas, setInviteLojas] = useState<string[]>([]);
  const [invitePageOverrides, setInvitePageOverrides] = useState<Record<string, boolean>>({});
  const [sendingInvite, setSendingInvite] = useState(false);
  
  // Cancel invite dialog state
  const [cancelInviteDialogOpen, setCancelInviteDialogOpen] = useState(false);
  const [cancelingInvite, setCancelingInvite] = useState<ConvitePendente | null>(null);

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  // Sincronizar lojas com o perfil selecionado no modal de edição
  useEffect(() => {
    if (editModalOpen && lojas.length > 0) {
      const lojasCompativeis = lojas.filter(l => 
        selectedProfile === 'cpd' ? l.tipo === 'cpd' : l.tipo !== 'cpd'
      );
      
      // Manter apenas lojas que são compatíveis com o novo perfil
      const lojasValidas = selectedLojas.filter(id => 
        lojasCompativeis.some(l => l.id === id)
      );
      
      // Se não houver lojas válidas e for CPD, pré-selecionar a loja CPD
      if (lojasValidas.length === 0 && selectedProfile === 'cpd' && lojasCompativeis.length > 0) {
        setSelectedLojas([lojasCompativeis[0].id]);
      } else if (lojasValidas.length !== selectedLojas.length) {
        setSelectedLojas(lojasValidas);
      }
    }
  }, [selectedProfile, editModalOpen, lojas]);

  // Sincronizar lojas com o perfil selecionado no modal de convite
  useEffect(() => {
    if (inviteModalOpen && lojas.length > 0) {
      const lojasCompativeis = lojas.filter(l => 
        inviteSelectedProfile === 'cpd' ? l.tipo === 'cpd' : l.tipo !== 'cpd'
      );
      
      // Manter apenas lojas que são compatíveis com o novo perfil
      const lojasValidas = inviteLojas.filter(id => 
        lojasCompativeis.some(l => l.id === id)
      );
      
      // Se não houver lojas válidas e for CPD, pré-selecionar a loja CPD
      if (lojasValidas.length === 0 && inviteSelectedProfile === 'cpd' && lojasCompativeis.length > 0) {
        setInviteLojas([lojasCompativeis[0].id]);
      } else if (lojasValidas.length !== inviteLojas.length) {
        setInviteLojas(lojasValidas);
      }
    }
  }, [inviteSelectedProfile, inviteModalOpen, lojas]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!organizationId) return;
      
      // Buscar membros da organização
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id, is_admin')
        .eq('organization_id', organizationId);

      if (membersError) throw membersError;
      const memberUserIds = (members || []).map(m => m.user_id);
      if (memberUserIds.length === 0) {
        setUsuarios([]);
        setLoading(false);
        return;
      }

      // Buscar profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', memberUserIds)
        .order('nome');

      if (profilesError) throw profilesError;

      // Buscar lojas
      const { data: lojasData, error: lojasError } = await supabase
        .from('lojas')
        .select('id, nome, tipo')
        .eq('organization_id', organizationId)
        .order('nome');

      if (lojasError) throw lojasError;
      setLojas(lojasData || []);

      // Buscar acessos às lojas
      const { data: lojasAcesso, error: lojasAcessoError } = await supabase
        .from('lojas_acesso')
        .select('user_id, loja_id')
        .in('user_id', memberUserIds);

      if (lojasAcessoError) throw lojasAcessoError;

      // Buscar page overrides
      const { data: pageAccessData, error: pageAccessError } = await supabase
        .from('user_page_access')
        .select('user_id, page_route, enabled')
        .in('user_id', memberUserIds)
        .eq('organization_id', organizationId);

      if (pageAccessError) console.error('Erro ao buscar page access:', pageAccessError);

      // Buscar convites pendentes
      const { data: convites, error: convitesError } = await supabase
        .from('convites_pendentes')
        .select('*')
        .eq('status', 'pendente')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (!convitesError) setConvitesPendentes(convites || []);

      // Combinar dados
      const usuariosCompletos: UsuarioCompleto[] = (profiles || []).map(profile => {
        const memberInfo = members?.find(m => m.user_id === profile.id);
        const isAdmin = memberInfo?.is_admin === true;
        
        const userLojas = (lojasAcesso || [])
          .filter(la => la.user_id === profile.id)
          .map(la => {
            const loja = lojasData?.find(l => l.id === la.loja_id);
            return {
              id: la.loja_id,
              nome: loja?.nome || 'Loja Desconhecida',
              tipo: loja?.tipo || 'loja'
            };
          });

        const userPageOverrides = (pageAccessData || [])
          .filter(pa => pa.user_id === profile.id)
          .map(pa => ({ page_route: pa.page_route, enabled: pa.enabled }));

        // Determinar perfil baseado em lojas
        const hasCPD = userLojas.some(l => l.tipo === 'cpd');
        const detectedProfile: UserProfile = isAdmin ? 'admin' : hasCPD ? 'cpd' : 'loja';

        return {
          ...profile,
          lojas: userLojas,
          isAdmin,
          profile: detectedProfile,
          pageOverrides: userPageOverrides,
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
    setSelectedProfile(usuario.profile);
    setSelectedLojas(usuario.lojas.map(l => l.id));
    // Converter overrides para objeto
    const overridesObj: Record<string, boolean> = {};
    usuario.pageOverrides.forEach(o => {
      overridesObj[o.page_route] = o.enabled;
    });
    setPageOverrides(overridesObj);
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

  const handlePageToggle = (route: string, isOverride: boolean) => {
    setPageOverrides(prev => {
      const newOverrides = { ...prev };
      if (isOverride) {
        newOverrides[route] = !prev[route];
      } else {
        delete newOverrides[route];
      }
      return newOverrides;
    });
  };

  const handleSave = async () => {
    if (!editingUser || !organizationId) return;

    // Validação - não permitir remover próprio admin
    if (editingUser.id === currentUser?.id && editingUser.isAdmin && selectedProfile !== 'admin') {
      toast.error('Você não pode remover seu próprio status de Admin');
      return;
    }

    // Validação - não-admin precisa de pelo menos uma loja
    if (selectedProfile !== 'admin' && selectedLojas.length === 0) {
      toast.error('Selecione pelo menos uma loja');
      return;
    }

    try {
      setSaving(true);

      // 1. Usar o perfil selecionado diretamente
      const isAdmin = selectedProfile === 'admin';
      let newRole: 'Admin' | 'Produção' | 'Loja' = 'Loja';
      if (selectedProfile === 'admin') {
        newRole = 'Admin';
      } else if (selectedProfile === 'cpd') {
        newRole = 'Produção';
      }

      console.log('[GerenciarUsuarios] Salvando usuário:', {
        userId: editingUser.id,
        email: editingUser.email,
        selectedProfile,
        newRole,
        isAdmin,
        selectedLojas,
        organizationId
      });

      // 2. Atualizar is_admin E role em organization_members
      const { error: memberError } = await supabase
        .from('organization_members')
        .update({ 
          is_admin: isAdmin,
          role: newRole 
        })
        .eq('user_id', editingUser.id)
        .eq('organization_id', organizationId);

      if (memberError) {
        console.error('[GerenciarUsuarios] Erro ao atualizar organization_members:', memberError);
        toast.error(`Erro ao atualizar role: ${memberError.message}`);
        return;
      }

      console.log('[GerenciarUsuarios] organization_members atualizado com sucesso');

      // 3. Atualizar lojas - deletar existentes
      const { error: deleteError } = await supabase
        .from('lojas_acesso')
        .delete()
        .eq('user_id', editingUser.id)
        .eq('organization_id', organizationId);

      if (deleteError) {
        console.error('[GerenciarUsuarios] Erro ao deletar lojas_acesso:', deleteError);
        toast.error(`Erro ao atualizar lojas: ${deleteError.message}`);
        return;
      }

      // 4. Inserir novas lojas
      if (selectedLojas.length > 0) {
        const lojasData = selectedLojas.map(lojaId => ({
          user_id: editingUser.id,
          loja_id: lojaId,
          organization_id: organizationId,
        }));
        
        const { error: insertError } = await supabase.from('lojas_acesso').insert(lojasData);
        
        if (insertError) {
          console.error('[GerenciarUsuarios] Erro ao inserir lojas_acesso:', insertError);
          toast.error(`Erro ao vincular lojas: ${insertError.message}`);
          return;
        }
      }

      console.log('[GerenciarUsuarios] lojas_acesso atualizado com sucesso');

      // 5. Atualizar page overrides
      const { error: deletePageError } = await supabase
        .from('user_page_access')
        .delete()
        .eq('user_id', editingUser.id)
        .eq('organization_id', organizationId);

      if (deletePageError) {
        console.error('[GerenciarUsuarios] Erro ao deletar user_page_access:', deletePageError);
      }

      const pageOverrideEntries = Object.entries(pageOverrides);
      if (pageOverrideEntries.length > 0) {
        const pageData = pageOverrideEntries.map(([route, enabled]) => ({
          user_id: editingUser.id,
          organization_id: organizationId,
          page_route: route,
          enabled,
        }));
        
        const { error: insertPageError } = await supabase.from('user_page_access').insert(pageData);
        
        if (insertPageError) {
          console.error('[GerenciarUsuarios] Erro ao inserir user_page_access:', insertPageError);
        }
      }

      console.log('[GerenciarUsuarios] user_page_access atualizado com sucesso');

      await auditLog.log('user.update', 'user', editingUser.id, {
        target_email: editingUser.email,
        lojas: selectedLojas,
        newRole,
        selectedProfile,
      });

      toast.success(`Usuário atualizado! Perfil: ${getProfileLabel(selectedProfile)}, Role: ${newRole}`);
      setEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('[GerenciarUsuarios] Erro geral ao salvar usuário:', error);
      toast.error('Erro ao salvar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser || !organizationId) return;

    if (deletingUser.id === currentUser?.id) {
      toast.error('Você não pode deletar sua própria conta');
      setDeleteDialogOpen(false);
      return;
    }

    try {
      // Remover acesso a lojas e page overrides
      await supabase.from('lojas_acesso').delete().eq('user_id', deletingUser.id);
      await supabase.from('user_page_access').delete().eq('user_id', deletingUser.id).eq('organization_id', organizationId);
      
      // Remover is_admin
      await supabase
        .from('organization_members')
        .update({ is_admin: false })
        .eq('user_id', deletingUser.id)
        .eq('organization_id', organizationId);

      await auditLog.log('user.remove', 'user', deletingUser.id, {
        target_email: deletingUser.email,
      });

      toast.success('Permissões do usuário removidas');
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao remover permissões:', error);
      toast.error('Erro ao remover permissões');
    }
  };

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

    if (inviteSelectedProfile !== 'admin' && inviteLojas.length === 0) {
      toast.error('Selecione pelo menos uma loja');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error('Email inválido');
      return;
    }

    try {
      setSendingInvite(true);
      
      // Usar perfil selecionado diretamente
      const isAdmin = inviteSelectedProfile === 'admin';
      let role: string = 'Loja';
      if (inviteSelectedProfile === 'admin') {
        role = 'Admin';
      } else if (inviteSelectedProfile === 'cpd') {
        role = 'Produção';
      }
      
      const roles = [role];

      const { data, error } = await supabase.functions.invoke('convidar-funcionario', {
        body: {
          email: inviteEmail.toLowerCase().trim(),
          roles,
          lojas_ids: inviteLojas,
          permissions: [], // Não usa mais permissões granulares
          page_overrides: invitePageOverrides,
          is_admin: isAdmin,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(data.message || 'Convite enviado!');
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteSelectedProfile('loja');
      setInviteLojas([]);
      setInvitePageOverrides({});
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
      await supabase
        .from('convites_pendentes')
        .update({ status: 'cancelado' })
        .eq('id', cancelingInvite.id);

      toast.success('Convite cancelado');
      setCancelInviteDialogOpen(false);
      setCancelingInvite(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao cancelar convite:', error);
      toast.error('Erro ao cancelar convite');
    }
  };

  const getLojaNameById = (lojaId: string) => {
    const loja = lojas.find(l => l.id === lojaId);
    return loja?.nome || 'Loja Desconhecida';
  };

  // Detectar perfil baseado nas lojas selecionadas (para modal de edição/convite)
  const getDetectedProfile = (selectedLojaIds: string[], isAdmin: boolean): UserProfile => {
    if (isAdmin) return 'admin';
    const hasCPD = selectedLojaIds.some(id => {
      const loja = lojas.find(l => l.id === id);
      return loja?.tipo === 'cpd';
    });
    return hasCPD ? 'cpd' : 'loja';
  };

  const renderPageCheckboxes = (
    overrides: Record<string, boolean>,
    setOverrides: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void,
    profile: UserProfile
  ) => {
    const sections = Object.entries(PAGE_SECTIONS);
    
    return (
      <div className="space-y-4">
        {sections.map(([key, section]) => (
          <div key={key} className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">{section.label}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {section.pages.map(page => {
                // Verificar se está no override ou no default do perfil
                const isInOverride = page.route in overrides;
                const overrideValue = overrides[page.route];
                
                const defaultPages = PROFILE_DEFAULT_PAGES[profile] || [];
                const isDefaultEnabled = defaultPages.includes(page.route);
                
                const isEnabled = isInOverride ? overrideValue : isDefaultEnabled;
                
                return (
                  <div 
                    key={page.route} 
                    className={`flex items-center space-x-2 p-2 rounded border ${isInOverride ? 'border-primary/50 bg-primary/5' : ''}`}
                  >
                    <Checkbox
                      id={`page-${page.route}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        setOverrides(prev => {
                          const newOverrides = { ...prev };
                          if (checked === isDefaultEnabled) {
                            // Se volta ao default, remove o override
                            delete newOverrides[page.route];
                          } else {
                            newOverrides[page.route] = !!checked;
                          }
                          return newOverrides;
                        });
                      }}
                    />
                    <label htmlFor={`page-${page.route}`} className="text-sm cursor-pointer flex-1">
                      {page.label}
                    </label>
                    {isInOverride && (
                      <Badge variant="outline" className="text-xs">
                        personalizado
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie perfis e acesso às páginas do sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => fetchData()} disabled={loading} className="!bg-green-600 hover:!bg-green-700 text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={() => setInviteModalOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar Funcionário
            </Button>
          </div>
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
                  <div key={convite.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{convite.email}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {convite.roles.includes('Admin') ? (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            {convite.lojas_ids.some(id => lojas.find(l => l.id === id)?.tipo === 'cpd') ? (
                              <><Factory className="h-3 w-3 mr-1" />CPD</>
                            ) : (
                              <><Store className="h-3 w-3 mr-1" />Loja</>
                            )}
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
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : usuarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum usuário cadastrado</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Lojas</TableHead>
                      <TableHead>Criação</TableHead>
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
                          <Badge className={
                            usuario.profile === 'admin' 
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : usuario.profile === 'cpd'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }>
                            {usuario.profile === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                            {usuario.profile === 'cpd' && <Factory className="h-3 w-3 mr-1" />}
                            {usuario.profile === 'loja' && <Store className="h-3 w-3 mr-1" />}
                            {getProfileLabel(usuario.profile)}
                          </Badge>
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
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(usuario)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Convidar Funcionário
            </DialogTitle>
            <DialogDescription>
              Envie um convite por email para adicionar um novo funcionário
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Email do Funcionário *</Label>
                <Input
                  type="email"
                  placeholder="funcionario@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              {/* Seleção de Perfil com RadioGroup */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Perfil do Funcionário *</Label>
                <RadioGroup 
                  value={inviteSelectedProfile} 
                  onValueChange={(value) => setInviteSelectedProfile(value as UserProfile)}
                  className="space-y-2"
                >
                  <div className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${inviteSelectedProfile === 'admin' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'hover:bg-muted/50'}`}>
                    <RadioGroupItem value="admin" id="invite-profile-admin" />
                    <label htmlFor="invite-profile-admin" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-600" />
                        <span className="font-medium">Administrador</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Acesso total ao sistema</p>
                    </label>
                  </div>
                  
                  <div className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${inviteSelectedProfile === 'cpd' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-muted/50'}`}>
                    <RadioGroupItem value="cpd" id="invite-profile-cpd" />
                    <label htmlFor="invite-profile-cpd" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Factory className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Operador CPD</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Produção e estoque central</p>
                    </label>
                  </div>
                  
                  <div className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${inviteSelectedProfile === 'loja' ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'hover:bg-muted/50'}`}>
                    <RadioGroupItem value="loja" id="invite-profile-loja" />
                    <label htmlFor="invite-profile-loja" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Operador Loja</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Operações de ponto de venda</p>
                    </label>
                  </div>
                </RadioGroup>
              </div>

              {inviteSelectedProfile !== 'admin' && (
                <Tabs defaultValue="lojas">
                  <TabsList className="w-full">
                    <TabsTrigger value="lojas" className="flex-1">
                      <Store className="h-4 w-4 mr-2" />
                      Lojas ({inviteLojas.length})
                    </TabsTrigger>
                    <TabsTrigger value="pages" className="flex-1">
                      <FileText className="h-4 w-4 mr-2" />
                      Páginas
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="lojas" className="mt-4">
                    <div className="space-y-2">
                      {lojas.filter(l => inviteSelectedProfile === 'cpd' ? l.tipo === 'cpd' : l.tipo !== 'cpd').map(loja => (
                        <div key={loja.id} className="flex items-center space-x-3 p-3 rounded-lg border">
                          <Checkbox
                            id={`invite-loja-${loja.id}`}
                            checked={inviteLojas.includes(loja.id)}
                            onCheckedChange={() => handleInviteLojaToggle(loja.id)}
                          />
                          <label htmlFor={`invite-loja-${loja.id}`} className="text-sm cursor-pointer flex-1 flex items-center gap-2">
                            {loja.tipo === 'cpd' ? <Factory className="h-4 w-4 text-blue-600" /> : <Store className="h-4 w-4" />}
                            {loja.nome}
                            {loja.tipo === 'cpd' && <Badge variant="outline" className="text-xs">CPD</Badge>}
                          </label>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                  <TabsContent value="pages" className="mt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Páginas são pré-definidas pelo perfil. Personalize apenas se necessário:
                    </p>
                    {renderPageCheckboxes(invitePageOverrides, setInvitePageOverrides, inviteSelectedProfile)}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSendInvite} 
              disabled={sendingInvite || !inviteEmail || (inviteSelectedProfile !== 'admin' && inviteLojas.length === 0)}
            >
              {sendingInvite ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : <><Send className="h-4 w-4 mr-2" />Enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Configure o perfil e acesso às páginas</DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="flex-1 overflow-y-auto max-h-[60vh] pr-2">
              <div className="space-y-6 py-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 font-semibold">
                    <User className="h-5 w-5" />{editingUser.nome}
                  </div>
                  <div className="text-sm text-muted-foreground">{editingUser.email}</div>
                </div>

                {/* Seleção de Perfil com RadioGroup */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Perfil do Usuário *</Label>
                  <RadioGroup 
                    value={selectedProfile} 
                    onValueChange={(value) => setSelectedProfile(value as UserProfile)}
                    className="space-y-2"
                  >
                    <div className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${selectedProfile === 'admin' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'hover:bg-muted/50'}`}>
                      <RadioGroupItem 
                        value="admin" 
                        id="edit-profile-admin" 
                        disabled={editingUser.id === currentUser?.id && editingUser.isAdmin}
                      />
                      <label htmlFor="edit-profile-admin" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-red-600" />
                          <span className="font-medium">Administrador</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Acesso total ao sistema</p>
                      </label>
                    </div>
                    
                    <div className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${selectedProfile === 'cpd' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-muted/50'}`}>
                      <RadioGroupItem 
                        value="cpd" 
                        id="edit-profile-cpd"
                        disabled={editingUser.id === currentUser?.id && editingUser.isAdmin}
                      />
                      <label htmlFor="edit-profile-cpd" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Factory className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">Operador CPD</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Produção e estoque central</p>
                      </label>
                    </div>
                    
                    <div className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${selectedProfile === 'loja' ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'hover:bg-muted/50'}`}>
                      <RadioGroupItem 
                        value="loja" 
                        id="edit-profile-loja"
                        disabled={editingUser.id === currentUser?.id && editingUser.isAdmin}
                      />
                      <label htmlFor="edit-profile-loja" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Operador Loja</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Operações de ponto de venda</p>
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                {selectedProfile !== 'admin' && (
                  <Tabs defaultValue="lojas">
                    <TabsList className="w-full">
                      <TabsTrigger value="lojas" className="flex-1">
                        <Store className="h-4 w-4 mr-2" />
                        Lojas ({selectedLojas.length})
                      </TabsTrigger>
                      <TabsTrigger value="pages" className="flex-1">
                        <FileText className="h-4 w-4 mr-2" />
                        Páginas
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="lojas" className="mt-4">
                      <div className="space-y-2">
                        {lojas.filter(l => selectedProfile === 'cpd' ? l.tipo === 'cpd' : l.tipo !== 'cpd').map(loja => (
                          <div key={loja.id} className="flex items-center space-x-3 p-3 rounded-lg border">
                            <Checkbox
                              id={`loja-${loja.id}`}
                              checked={selectedLojas.includes(loja.id)}
                              onCheckedChange={() => handleLojaToggle(loja.id)}
                            />
                            <label htmlFor={`loja-${loja.id}`} className="text-sm cursor-pointer flex-1 flex items-center gap-2">
                              {loja.tipo === 'cpd' ? <Factory className="h-4 w-4 text-blue-600" /> : <Store className="h-4 w-4" />}
                              {loja.nome}
                              {loja.tipo === 'cpd' && <Badge variant="outline" className="text-xs">CPD</Badge>}
                            </label>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    <TabsContent value="pages" className="mt-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Páginas são pré-definidas pelo perfil. Personalize apenas se necessário:
                      </p>
                      {renderPageCheckboxes(pageOverrides, setPageOverrides, selectedProfile)}
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
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
            <AlertDialogTitle>Remover Permissões?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingUser && (
                <>Isso removerá todas as permissões e vínculos de <strong>{deletingUser.nome}</strong>.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remover
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
              {cancelingInvite && <>O convite para <strong>{cancelingInvite.email}</strong> será cancelado.</>}
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
