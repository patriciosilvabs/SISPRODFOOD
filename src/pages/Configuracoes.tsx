import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrendingUp, Volume2, Package, Building2, Box, Users, Store, Calendar, Settings2, Bell, Megaphone, Play, Trash2, Music, AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ConfigurarReservaDiariaModal } from '@/components/modals/ConfigurarReservaDiariaModal';
import { ConfigurarAlertasEstoqueModal } from '@/components/modals/ConfigurarAlertasEstoqueModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
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

const Configuracoes = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { organizationId } = useOrganization();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reservaModalOpen, setReservaModalOpen] = useState(false);
  const [alertasModalOpen, setAlertasModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentSoundUrl, setCurrentSoundUrl] = useState<string | null>(null);
  const [savedFileName, setSavedFileName] = useState<string | null>(null);
  const [resetContagensDialog, setResetContagensDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resettingContagens, setResettingContagens] = useState(false);

  useEffect(() => {
    loadCurrentSound();
  }, [organizationId]);

  // Listener Realtime para sincronizar visualização do som entre abas
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('alarm-sound-config-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracoes_sistema',
          filter: `chave=eq.alarm_sound_url`
        },
        (payload) => {
          const newRecord = payload.new as { organization_id?: string; valor?: string };
          
          // Verificar se é da mesma organização
          if (newRecord && newRecord.organization_id === organizationId) {
            console.log('Som do alarme atualizado via realtime na config:', newRecord.valor);
            
            if (newRecord.valor) {
              setCurrentSoundUrl(newRecord.valor);
              const urlParts = newRecord.valor.split('/');
              const fileName = urlParts[urlParts.length - 1];
              setSavedFileName(decodeURIComponent(fileName));
            } else {
              setCurrentSoundUrl(null);
              setSavedFileName(null);
            }
          }
          
          // Tratar DELETE
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { organization_id?: string };
            if (oldRecord && oldRecord.organization_id === organizationId) {
              setCurrentSoundUrl(null);
              setSavedFileName(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const loadCurrentSound = async () => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('configuracoes_sistema')
        .select('valor')
        .eq('chave', 'alarm_sound_url')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.valor) {
        setCurrentSoundUrl(data.valor);
        // Extrair nome do arquivo da URL
        const urlParts = data.valor.split('/');
        const fileName = urlParts[urlParts.length - 1];
        setSavedFileName(decodeURIComponent(fileName));
      } else {
        setCurrentSoundUrl(null);
        setSavedFileName(null);
      }
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
      setSavedFileName(fileName);
      setSelectedFile(null);
      // Reset o input de arquivo
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
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

  const handleRemoveSound = async () => {
    if (!organizationId) return;
    
    try {
      // Remover do banco de dados
      const { error } = await supabase
        .from('configuracoes_sistema')
        .delete()
        .eq('chave', 'alarm_sound_url')
        .eq('organization_id', organizationId);

      if (error) throw error;
      
      setCurrentSoundUrl(null);
      setSavedFileName(null);
      toast.success('Som removido. O alarme usará o beep padrão.');
    } catch (error) {
      console.error('Erro ao remover som:', error);
      toast.error('Erro ao remover som');
    }
  };

  const handleResetContagens = async () => {
    if (!organizationId || !user) return;
    
    setResettingContagens(true);
    
    try {
      // Determinar dia operacional atual (usando fuso de São Paulo)
      const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      
      // 1. Deletar contagens do dia
      const { error: errContagens } = await supabase
        .from('contagem_porcionados')
        .delete()
        .eq('organization_id', organizationId)
        .eq('dia_operacional', hoje);
      
      if (errContagens) throw errContagens;
      
      // 2. Deletar sessões do dia
      const { error: errSessoes } = await supabase
        .from('sessoes_contagem')
        .delete()
        .eq('organization_id', organizationId)
        .eq('dia_operacional', hoje);
      
      if (errSessoes) throw errSessoes;
      
      // 3. Limpar referências em romaneio_itens antes de deletar produções
      const { error: errLimparRef } = await supabase
        .from('romaneio_itens')
        .update({ producao_registro_id: null })
        .eq('organization_id', organizationId)
        .not('producao_registro_id', 'is', null);
      
      if (errLimparRef) throw errLimparRef;
      
      // 4. Deletar TODAS as produções (todos os status, qualquer data)
      const { error: errProducao } = await supabase
        .from('producao_registros')
        .delete()
        .eq('organization_id', organizationId);
      
      if (errProducao) throw errProducao;
      
      // 5. Registrar no audit log
      await supabase.from('audit_logs').insert({
        action: 'RESET_CONTAGENS',
        entity_type: 'contagem_porcionados',
        entity_id: null,
        details: { 
          dia: hoje, 
          descricao: 'Reset geral das contagens do dia'
        },
        user_id: user.id,
        user_email: user.email || '',
        organization_id: organizationId,
      });
      
      toast.success('Reset realizado com sucesso! Todas as contagens do dia foram zeradas.');
      setResetContagensDialog(false);
      setConfirmText('');
      
    } catch (error: any) {
      console.error('Erro no reset:', error);
      toast.error(`Erro ao resetar: ${error.message}`);
    } finally {
      setResettingContagens(false);
    }
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

      {/* Dialog de confirmação de reset */}
      <AlertDialog open={resetContagensDialog} onOpenChange={setResetContagensDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Atenção: Ação Irreversível
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Esta ação irá <strong>APAGAR permanentemente</strong>:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Todas as contagens de <strong>TODAS as lojas</strong> do dia atual</li>
                  <li>Todas as sessões de contagem em andamento</li>
                  <li><strong>TODAS as produções</strong> (qualquer status, qualquer data)</li>
                </ul>
                <p className="text-sm text-muted-foreground text-red-600 font-medium">
                  ⚠️ O painel "Resumo da Produção" ficará completamente vazio.
                </p>
                <p className="font-semibold pt-2">
                  Digite "CONFIRMAR" para prosseguir:
                </p>
                <Input 
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Digite CONFIRMAR"
                  className="mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText('')}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              disabled={confirmText !== 'CONFIRMAR' || resettingContagens}
              onClick={handleResetContagens}
              className="bg-red-600 hover:bg-red-700"
            >
              {resettingContagens ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetando...
                </>
              ) : (
                'Confirmar Reset'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
        </div>

        {/* Card de Reset - Apenas para Admin */}
        {isAdmin() && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-lg bg-red-200 text-red-700 dark:bg-red-900 dark:text-red-300">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1 text-red-700 dark:text-red-300">
                    Reset de Contagens
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Apagar todas as contagens do dia atual e recomeçar do zero.
                  </p>
                </div>
              </div>
              <Button 
                variant="destructive" 
                onClick={() => setResetContagensDialog(true)}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Resetar Contagens do Dia
              </Button>
            </CardContent>
          </Card>
        )}

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
              <div className="space-y-4">
                {/* Seção: Som Atualmente Configurado */}
                {currentSoundUrl && savedFileName && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded shrink-0">
                          <Music className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Som configurado
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 truncate" title={savedFileName}>
                            {savedFileName}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleTestSound}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900"
                          title="Testar som"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleRemoveSound}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900"
                          title="Remover som"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seção: Enviar novo arquivo */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {currentSoundUrl ? 'Substituir por novo arquivo:' : 'Enviar arquivo MP3:'}
                  </label>
                  <Input 
                    type="file" 
                    accept="audio/mp3,audio/mpeg"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                      📎 {selectedFile.name}
                    </p>
                  )}
                </div>

                {/* Botões */}
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveSound} 
                    className="flex-1"
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? 'Salvando...' : 'Salvar Som'}
                  </Button>
                  {!currentSoundUrl && (
                    <Button onClick={handleTestSound} variant="secondary" className="flex-1">
                      Testar Padrão
                    </Button>
                  )}
                </div>
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
