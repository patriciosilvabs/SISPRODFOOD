import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Camera, X, RefreshCw, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Loja {
  id: string;
  nome: string;
}

interface Ocorrencia {
  id: string;
  loja_id: string;
  loja_nome: string;
  descricao: string;
  foto_url: string | null;
  usuario_nome: string;
  created_at: string;
}

const ErrosDevolucoes = () => {
  const { user, roles, isAdmin, hasRole } = useAuth();
  const { organizationId } = useOrganization();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [selectedLoja, setSelectedLoja] = useState('');
  const [descricao, setDescricao] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Verificar se usuário é apenas Loja (sem Admin ou Produção)
  const isLojaUser = hasRole('Loja') && !isAdmin() && !hasRole('Produção');

  useEffect(() => {
    if (user) {
      loadLojas();
      loadOcorrencias();
    }

    // Cleanup: fechar câmera quando componente desmontar
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [user]);

  // Efeito para conectar stream ao vídeo quando câmera ativa
  useEffect(() => {
    if (cameraAtiva && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(err => {
        console.error('Erro ao iniciar vídeo:', err);
      });
    }
  }, [cameraAtiva]);

  const loadLojas = async () => {
    try {
      let lojasData: Loja[] = [];

      if (isLojaUser && user) {
        // Usuário Loja: buscar apenas lojas vinculadas via lojas_acesso
        const { data: lojasAcesso, error: acessoError } = await supabase
          .from('lojas_acesso')
          .select('loja_id')
          .eq('user_id', user.id);

        if (acessoError) throw acessoError;

        const lojasIds = lojasAcesso?.map(la => la.loja_id) || [];

        if (lojasIds.length > 0) {
          const { data, error } = await supabase
            .from('lojas')
            .select('id, nome')
            .in('id', lojasIds)
            .order('nome');

          if (error) throw error;
          lojasData = data || [];
        }
      } else {
        // Admin/Produção: ver todas as lojas
        const { data, error } = await supabase
          .from('lojas')
          .select('id, nome')
          .order('nome');

        if (error) throw error;
        lojasData = data || [];
      }

      setLojas(lojasData);
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
      toast.error('Erro ao carregar lojas');
    }
  };

  const loadOcorrencias = async () => {
    const { data, error } = await supabase
      .from('erros_devolucoes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Erro ao carregar ocorrências');
      return;
    }
    
    setOcorrencias(data || []);
  };

  const abrirCamera = async () => {
    try {
      let stream: MediaStream;
      
      try {
        // Tenta câmera traseira primeiro (ideal para mobile)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      } catch {
        // Se falhar, tenta câmera frontal/padrão (desktop)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      }
      
      // Armazena o stream PRIMEIRO
      streamRef.current = stream;
      
      // DEPOIS ativa a câmera (renderiza o <video>)
      // O useEffect vai conectar o stream ao vídeo
      setCameraAtiva(true);
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      toast.error('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const fecharCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraAtiva(false);
  };

  const tirarFoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setFoto(file);
          setFotoPreview(URL.createObjectURL(blob));
          fecharCamera();
          toast.success('Foto capturada com sucesso');
        }
      }, 'image/jpeg', 0.85);
    }
  };

  const removerFoto = () => {
    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
    }
    setFoto(null);
    setFotoPreview(null);
  };

  const uploadFoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('erros-devolucoes')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('erros-devolucoes')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      return null;
    }
  };

  const handleExcluirOcorrencia = async (ocorrencia: Ocorrencia) => {
    if (!isAdmin()) {
      toast.error('Apenas administradores podem excluir ocorrências');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir esta ocorrência de "${ocorrencia.loja_nome}"?\n\nEsta ação é PERMANENTE e IRREVERSÍVEL.`)) {
      return;
    }

    setDeleting(ocorrencia.id);

    try {
      // Se houver foto, excluir do Storage primeiro
      if (ocorrencia.foto_url) {
        const urlParts = ocorrencia.foto_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        const { error: storageError } = await supabase.storage
          .from('erros-devolucoes')
          .remove([fileName]);

        if (storageError) {
          console.error('Erro ao excluir foto do storage:', storageError);
        }
      }

      // Excluir o registro da tabela
      const { error } = await supabase
        .from('erros_devolucoes')
        .delete()
        .eq('id', ocorrencia.id);

      if (error) throw error;

      toast.success('Ocorrência excluída com sucesso');
      loadOcorrencias();
    } catch (error) {
      console.error('Erro ao excluir ocorrência:', error);
      toast.error('Erro ao excluir ocorrência');
    } finally {
      setDeleting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLoja || !descricao.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    setLoading(true);

    try {
      // Upload da foto, se houver
      let fotoUrl = null;
      if (foto) {
        fotoUrl = await uploadFoto(foto);
        if (!fotoUrl) {
          toast.error('Erro ao fazer upload da foto');
          setLoading(false);
          return;
        }
      }

      // Buscar nome da loja
      const lojaSelecionada = lojas.find(l => l.id === selectedLoja);
      if (!lojaSelecionada) {
        toast.error('Loja não encontrada');
        setLoading(false);
        return;
      }

      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      if (!organizationId) {
        toast.error('Organização não identificada. Faça login novamente.');
        setLoading(false);
        return;
      }

      // Inserir ocorrência
      const { error } = await supabase
        .from('erros_devolucoes')
        .insert({
          loja_id: selectedLoja,
          loja_nome: lojaSelecionada.nome,
          descricao: descricao.trim(),
          foto_url: fotoUrl,
          usuario_id: user.id,
          usuario_nome: profile?.nome || user.email || 'Usuário',
          organization_id: organizationId,
        });

      if (error) throw error;

      toast.success('Ocorrência registrada com sucesso');
      
      // Limpar formulário
      setSelectedLoja('');
      setDescricao('');
      removerFoto();

      // Recarregar ocorrências
      loadOcorrencias();
    } catch (error) {
      console.error('Erro ao registrar ocorrência:', error);
      toast.error('Erro ao registrar ocorrência');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Registro de Erros e Devoluções</h1>
          <Button variant="outline" size="sm" onClick={() => { loadLojas(); loadOcorrencias(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário de Nova Ocorrência */}
          <Card>
            <CardHeader>
              <CardTitle>Nova Ocorrência</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loja">Loja</Label>
                  <Select value={selectedLoja} onValueChange={setSelectedLoja}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {lojas.map((loja) => (
                        <SelectItem key={loja.id} value={loja.id}>
                          {loja.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Motivo do Erro / Devolução</Label>
                  <Textarea
                    id="descricao"
                    placeholder="Descreva o item e o problema. Ex: Pizza de calabresa com borda queimada..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Foto do Produto</Label>
                  
                  {!cameraAtiva && !foto && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={abrirCamera}
                      className="w-full"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      📷 Tirar Foto
                    </Button>
                  )}

                  {cameraAtiva && (
                    <div className="space-y-2">
                      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={tirarFoto}
                          className="flex-1"
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Capturar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={fecharCamera}
                        >
                          <X className="h-4 w-4" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {foto && fotoPreview && (
                    <div className="space-y-2">
                      <div className="relative">
                        <img
                          src={fotoPreview}
                          alt="Foto capturada"
                          className="rounded-lg w-full h-auto max-h-64 object-cover border-2 border-border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={removerFoto}
                          className="absolute top-2 right-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Foto capturada: {foto.name}
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-destructive hover:bg-destructive/90"
                  disabled={loading}
                >
                  {loading ? 'Registrando...' : 'Registrar Ocorrência'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Histórico de Ocorrências */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Ocorrências</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ocorrencias.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma ocorrência registrada ainda.
                  </p>
                ) : (
                  ocorrencias.map((ocorrencia) => (
                    <Card key={ocorrencia.id} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">
                              Ocorrência em:{' '}
                              <span className="text-primary">{ocorrencia.loja_nome}</span>
                            </p>
                            <p className="text-sm">{ocorrencia.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(ocorrencia.created_at), "dd/MM/yyyy, HH:mm:ss", { locale: ptBR })}
                              {' '}por {ocorrencia.usuario_nome}
                            </p>
                          </div>
                          
                          {/* Botão Excluir - apenas para Admin */}
                          {isAdmin() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => handleExcluirOcorrencia(ocorrencia)}
                              disabled={deleting === ocorrencia.id}
                              title="Excluir ocorrência"
                            >
                              <Trash2 className={`h-4 w-4 ${deleting === ocorrencia.id ? 'animate-pulse' : ''}`} />
                            </Button>
                          )}
                        </div>
                        
                        {ocorrencia.foto_url && (
                          <div className="mt-2">
                            <img
                              src={ocorrencia.foto_url}
                              alt="Foto da ocorrência"
                              className="rounded-md max-w-full h-auto max-h-48 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ErrosDevolucoes;
