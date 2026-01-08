import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrendingUp, Volume2, Package, Building2, Box, Users, Store, Calendar, Settings2, Bell, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ConfigurarReservaDiariaModal } from '@/components/modals/ConfigurarReservaDiariaModal';
import { ConfigurarAlertasEstoqueModal } from '@/components/modals/ConfigurarAlertasEstoqueModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

const Configuracoes = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { organizationId } = useOrganization();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reservaModalOpen, setReservaModalOpen] = useState(false);
  const [alertasModalOpen, setAlertasModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentSoundUrl, setCurrentSoundUrl] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentSound();
  }, []);

  const loadCurrentSound = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_sistema')
        .select('valor')
        .eq('chave', 'alarm_sound_url')
        .maybeSingle();

      if (error) throw error;
      setCurrentSoundUrl(data?.valor || null);
    } catch (error) {
      console.error('Erro ao carregar som:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validar tipo de arquivo
      if (!file.type.includes('audio')) {
        toast.error('Por favor, selecione um arquivo de áudio válido');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleSaveSound = async () => {
    if (!selectedFile) {
      toast.error('Nenhum arquivo selecionado');
      return;
    }

    try {
      setUploading(true);

      // 1. Upload do arquivo para storage
      const fileName = `alarm-${Date.now()}.mp3`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('alarm-sounds')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from('alarm-sounds')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 3. Salvar URL na tabela de configurações
      const { error: configError } = await supabase
        .from('configuracoes_sistema')
        .upsert({
          chave: 'alarm_sound_url',
          valor: publicUrl,
          updated_at: new Date().toISOString(),
          organization_id: organizationId,
        }, {
          onConflict: 'chave,organization_id'
        });

      if (configError) throw configError;

      setCurrentSoundUrl(publicUrl);
      setSelectedFile(null);
      toast.success('Som do alarme salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar som:', error);
      toast.error('Erro ao salvar som do alarme');
    } finally {
      setUploading(false);
    }
  };

  const handleTestSound = () => {
    if (!currentSoundUrl) {
      // Tocar beep padrão
      toast.info('Nenhum som personalizado configurado. Tocando beep padrão...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      setTimeout(() => oscillator.stop(), 1000);
      return;
    }

    // Tocar som configurado
    const audio = new Audio(currentSoundUrl);
    audio.play().catch((err) => {
      console.error('Erro ao tocar som:', err);
      toast.error('Erro ao testar som');
    });
    toast.info('Tocando som configurado...');
  };

  const configCards = [
    {
      title: 'Otimização Sazonal (IA)',
      description: 'Ajuste o estoque ideal de porcionados com base na IA.',
      icon: TrendingUp,
      color: 'bg-cyan-100 text-cyan-600',
      onClick: () => toast.info('Funcionalidade em desenvolvimento'),
    },
    {
      title: 'Alertas de Estoque',
      description: 'Configure alertas automáticos por email quando itens atingirem níveis críticos.',
      icon: Bell,
      color: 'bg-red-100 text-red-600',
      onClick: () => setAlertasModalOpen(true),
    },
    {
      title: 'Reserva Mínima por Dia',
      description: 'Configure a reserva de segurança do CPD por dia da semana.',
      icon: Calendar,
      color: 'bg-orange-100 text-orange-600',
      onClick: () => setReservaModalOpen(true),
    },
    {
      title: 'Gerenciar Insumos',
      description: 'Cadastre e ajuste o estoque de matéria-prima.',
      icon: Package,
      color: 'bg-blue-100 text-blue-600',
      onClick: () => navigate('/insumos'),
    },
    {
      title: 'Gerenciar Itens Porcionados',
      description: 'Crie os itens produzidos a partir dos insumos.',
      icon: Building2,
      color: 'bg-blue-100 text-blue-600',
      onClick: () => navigate('/itens-porcionados'),
    },
    {
      title: 'Gerenciar Produtos',
      description: 'Cadastre caixas, molhos, materiais de limpeza, etc.',
      icon: Box,
      color: 'bg-green-100 text-green-600',
      onClick: () => navigate('/gerenciar-produtos'),
    },
    {
      title: 'Gerenciar Patrimônio',
      description: 'Controle os ativos da empresa como equipamentos e mobília.',
      icon: Building2,
      color: 'bg-purple-100 text-purple-600',
      onClick: () => toast.info('Funcionalidade em desenvolvimento'),
    },
    {
      title: 'Gerenciar Lojas',
      description: 'Adicione, edite ou remova as lojas do sistema.',
      icon: Store,
      color: 'bg-blue-100 text-blue-600',
      onClick: () => navigate('/lojas'),
    },
    {
      title: 'Gerenciar Usuários',
      description: 'Cadastre novos usuários e defina suas permissões.',
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
      onClick: () => navigate('/gerenciar-usuarios'),
    },
    ...(isAdmin() ? [{
      title: 'Lembretes de Áudio',
      description: 'Configure lembretes sonoros agendados para lembrar os usuários de suas tarefas.',
      icon: Megaphone,
      color: 'bg-violet-100 text-violet-600',
      onClick: () => navigate('/configurar-lembretes-audio'),
    }] : []),
    {
      title: 'Configurar Interface',
      description: 'Personalize quais elementos da interface os usuários podem ver.',
      icon: Settings2,
      color: 'bg-indigo-100 text-indigo-600',
      onClick: () => navigate('/configurar-interface'),
    },
  ];

  return (
    <Layout>
      <ConfigurarReservaDiariaModal 
        open={reservaModalOpen} 
        onOpenChange={setReservaModalOpen} 
      />
      <ConfigurarAlertasEstoqueModal 
        open={alertasModalOpen} 
        onOpenChange={setAlertasModalOpen} 
      />
      
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Otimização Sazonal Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={configCards[0].onClick}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${configCards[0].color}`}>
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{configCards[0].title}</h3>
                  <p className="text-sm text-muted-foreground">{configCards[0].description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Som do Alarme Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-lg bg-red-100 text-red-600">
                  <Volume2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">Som do Alarme</h3>
                  <p className="text-sm text-muted-foreground">
                    Personalize o som de notificação de "massa pronta".
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Enviar novo arquivo MP3:</label>
                  <Input 
                    type="file" 
                    accept="audio/mp3,audio/mpeg"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground mt-1">{selectedFile.name}</p>
                  )}
                  {!selectedFile && (
                    <p className="text-xs text-muted-foreground mt-1">Nenhum arquivo escolhido</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveSound} 
                    className="flex-1"
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? 'Salvando...' : 'Salvar Som'}
                  </Button>
                  <Button onClick={handleTestSound} variant="secondary" className="flex-1">
                    Testar Som {currentSoundUrl ? 'Atual' : 'Padrão'}
                  </Button>
                </div>
                {currentSoundUrl && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    ✓ Som personalizado configurado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gerenciar Insumos Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={configCards[1].onClick}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${configCards[1].color}`}>
                  <Package className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{configCards[1].title}</h3>
                  <p className="text-sm text-muted-foreground">{configCards[1].description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Other Config Cards */}
          {configCards.slice(2).map((card, index) => {
            const Icon = card.icon;
            return (
              <Card 
                key={index}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={card.onClick}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${card.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{card.title}</h3>
                      <p className="text-sm text-muted-foreground">{card.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default Configuracoes;
