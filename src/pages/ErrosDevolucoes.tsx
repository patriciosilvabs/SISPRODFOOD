import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Camera } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  const { user } = useAuth();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [selectedLoja, setSelectedLoja] = useState('');
  const [descricao, setDescricao] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLojas();
    loadOcorrencias();
  }, []);

  const loadLojas = async () => {
    const { data, error } = await supabase
      .from('lojas')
      .select('id, nome')
      .order('nome');
    
    if (error) {
      toast.error('Erro ao carregar lojas');
      return;
    }
    
    setLojas(data || []);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFoto(e.target.files[0]);
    }
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
        });

      if (error) throw error;

      toast.success('Ocorrência registrada com sucesso');
      
      // Limpar formulário
      setSelectedLoja('');
      setDescricao('');
      setFoto(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

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
        <div>
          <h1 className="text-3xl font-bold">Registro de Erros e Devoluções</h1>
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
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="foto-input"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Tirar Foto
                    </Button>
                    {foto && (
                      <span className="text-sm text-muted-foreground self-center">
                        {foto.name}
                      </span>
                    )}
                  </div>
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
                        <p className="font-medium">
                          Ocorrência em:{' '}
                          <span className="text-primary">{ocorrencia.loja_nome}</span>
                        </p>
                        <p className="text-sm">{ocorrencia.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(ocorrencia.created_at), "dd/MM/yyyy, HH:mm:ss", { locale: ptBR })}
                          {' '}por {ocorrencia.usuario_nome}
                        </p>
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
