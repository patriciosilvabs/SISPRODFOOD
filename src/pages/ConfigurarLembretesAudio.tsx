import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Volume2, Clock, Calendar, Users, Loader2, AlertTriangle } from 'lucide-react';
import { useCanDelete } from '@/hooks/useCanDelete';

interface LembreteAudio {
  id: string;
  titulo: string;
  descricao: string | null;
  audio_url: string;
  horario: string;
  dias_semana: number[];
  ativo: boolean;
  perfis_destino: string[];
}

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const PERFIS = ['Admin', 'Produção', 'Loja'];

export default function ConfigurarLembretesAudio() {
  const { organizationId, loading: orgLoading } = useOrganization();
  const { isAdmin, loading: authLoading } = useAuth();
  const { canDelete } = useCanDelete();
  const [lembretes, setLembretes] = useState<LembreteAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lembreteParaExcluir, setLembreteParaExcluir] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '',
    titulo: '',
    descricao: '',
    audio_url: '',
    horario: '08:00',
    dias_semana: [1, 2, 3, 4, 5] as number[],
    ativo: true,
    perfis_destino: [] as string[],
  });

  const isEditing = !!formData.id;

  useEffect(() => {
    if (organizationId) {
      loadLembretes();
    } else if (!orgLoading) {
      setLoading(false);
    }
  }, [organizationId, orgLoading]);

  const loadLembretes = async () => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('lembretes_audio')
        .select('*')
        .eq('organization_id', organizationId)
        .order('horario');

      if (error) throw error;
      setLembretes(data || []);
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error);
      toast.error('Erro ao carregar lembretes');
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = () => {
    setFormData({
      id: '',
      titulo: '',
      descricao: '',
      audio_url: '',
      horario: '08:00',
      dias_semana: [1, 2, 3, 4, 5],
      ativo: true,
      perfis_destino: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (lembrete: LembreteAudio) => {
    setFormData({
      id: lembrete.id,
      titulo: lembrete.titulo,
      descricao: lembrete.descricao || '',
      audio_url: lembrete.audio_url,
      horario: lembrete.horario.substring(0, 5),
      dias_semana: lembrete.dias_semana,
      ativo: lembrete.ativo,
      perfis_destino: lembrete.perfis_destino,
    });
    setModalOpen(true);
  };

  const handleUploadAudio = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      toast.error('Por favor, selecione um arquivo de áudio');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${organizationId}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('lembretes-audio')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('lembretes-audio')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, audio_url: urlData.publicUrl }));
      toast.success('Áudio enviado com sucesso');
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      toast.error('Erro ao enviar áudio');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.titulo.trim()) {
      toast.error('O título é obrigatório');
      return;
    }
    if (!formData.audio_url) {
      toast.error('O arquivo de áudio é obrigatório');
      return;
    }
    if (formData.dias_semana.length === 0) {
      toast.error('Selecione pelo menos um dia da semana');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        organization_id: organizationId,
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || null,
        audio_url: formData.audio_url,
        horario: formData.horario + ':00',
        dias_semana: formData.dias_semana,
        ativo: formData.ativo,
        perfis_destino: formData.perfis_destino,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('lembretes_audio')
          .update(payload)
          .eq('id', formData.id);

        if (error) throw error;
        toast.success('Lembrete atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('lembretes_audio')
          .insert(payload);

        if (error) throw error;
        toast.success('Lembrete criado com sucesso');
      }

      setModalOpen(false);
      loadLembretes();
    } catch (error) {
      console.error('Erro ao salvar lembrete:', error);
      toast.error('Erro ao salvar lembrete');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lembreteParaExcluir) return;

    try {
      const { error } = await supabase
        .from('lembretes_audio')
        .delete()
        .eq('id', lembreteParaExcluir);

      if (error) throw error;
      toast.success('Lembrete excluído com sucesso');
      loadLembretes();
    } catch (error) {
      console.error('Erro ao excluir lembrete:', error);
      toast.error('Erro ao excluir lembrete');
    } finally {
      setDeleteDialogOpen(false);
      setLembreteParaExcluir(null);
    }
  };

  const toggleDia = (dia: number) => {
    setFormData(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia].sort(),
    }));
  };

  const togglePerfil = (perfil: string) => {
    setFormData(prev => ({
      ...prev,
      perfis_destino: prev.perfis_destino.includes(perfil)
        ? prev.perfis_destino.filter(p => p !== perfil)
        : [...prev.perfis_destino, perfil],
    }));
  };

  const formatDias = (dias: number[]) => {
    return dias.map(d => DIAS_SEMANA.find(ds => ds.value === d)?.label).join(', ');
  };

  const testarAudio = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch(err => {
      console.error('Erro ao tocar áudio:', err);
      toast.error('Erro ao reproduzir áudio');
    });
  };

  if (loading || authLoading || orgLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin()) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Apenas administradores podem configurar lembretes de áudio.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lembretes de Áudio</h1>
            <p className="text-muted-foreground">
              Configure lembretes sonoros para lembrar os usuários de suas tarefas
            </p>
          </div>
          <Button onClick={openNewModal}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lembrete
          </Button>
        </div>

        {lembretes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Volume2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhum lembrete configurado ainda.
                <br />
                Clique em "Novo Lembrete" para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lembretes.map(lembrete => (
              <Card key={lembrete.id} className={!lembrete.ativo ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{lembrete.titulo}</CardTitle>
                      {lembrete.descricao && (
                        <CardDescription className="line-clamp-2">
                          {lembrete.descricao}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => testarAudio(lembrete.audio_url)}
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(lembrete)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setLembreteParaExcluir(lembrete.id);
                            setDeleteDialogOpen(true);
                          }}
                          title="Excluir lembrete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{lembrete.horario.substring(0, 5)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDias(lembrete.dias_semana)}</span>
                  </div>
                  {lembrete.perfis_destino.length > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{lembrete.perfis_destino.join(', ')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      lembrete.ativo 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {lembrete.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de Criação/Edição */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? 'Editar Lembrete' : 'Novo Lembrete'}
              </DialogTitle>
              <DialogDescription>
                Configure um lembrete de áudio para os usuários
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={e => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Ex: Contagem Matinal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={e => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição do lembrete (opcional)"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Arquivo de Áudio *</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadAudio(file);
                    }}
                    disabled={uploading}
                  />
                  {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
                </div>
                {formData.audio_url && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Volume2 className="h-4 w-4" />
                    <span>Áudio carregado</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testarAudio(formData.audio_url)}
                    >
                      Testar
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="horario">Horário *</Label>
                <Input
                  id="horario"
                  type="time"
                  value={formData.horario}
                  onChange={e => setFormData(prev => ({ ...prev, horario: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Dias da Semana *</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map(dia => (
                    <label
                      key={dia.value}
                      className={`flex items-center justify-center w-12 h-10 rounded-md cursor-pointer border transition-colors ${
                        formData.dias_semana.includes(dia.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.dias_semana.includes(dia.value)}
                        onChange={() => toggleDia(dia.value)}
                        className="sr-only"
                      />
                      {dia.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Perfis Destinatários</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Deixe vazio para enviar para todos
                </p>
                <div className="flex flex-wrap gap-4">
                  {PERFIS.map(perfil => (
                    <label key={perfil} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={formData.perfis_destino.includes(perfil)}
                        onCheckedChange={() => togglePerfil(perfil)}
                      />
                      <span className="text-sm">{perfil}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, ativo: checked }))}
                />
                <Label htmlFor="ativo">Lembrete ativo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este lembrete? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
