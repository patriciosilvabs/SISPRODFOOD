import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { useIntegracaoPDV } from '@/hooks/useIntegracaoPDV';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const ConfigurarIntegracaoPDV = () => {
  const { 
    config, 
    logs, 
    loading, 
    saving, 
    syncing, 
    isConfigured,
    saveConfig, 
    testConnection,
    refreshLogs
  } = useIntegracaoPDV();

  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [notificarRomaneio, setNotificarRomaneio] = useState(true);
  const [sincronizarDemanda, setSincronizarDemanda] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (config) {
      setApiUrl(config.api_url || '');
      setApiKey(config.api_key || '');
      setAtivo(config.ativo);
      setNotificarRomaneio(config.notificar_romaneio);
      setSincronizarDemanda(config.sincronizar_demanda);
    }
  }, [config]);

  const handleSave = async () => {
    if (!apiUrl.trim()) {
      toast.error('URL da API é obrigatória');
      return;
    }
    if (!apiKey.trim()) {
      toast.error('Chave de API é obrigatória');
      return;
    }

    await saveConfig({
      api_url: apiUrl.trim(),
      api_key: apiKey.trim(),
      ativo,
      notificar_romaneio: notificarRomaneio,
      sincronizar_demanda: sincronizarDemanda,
    });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    // Save first if needed
    if (!isConfigured || apiUrl !== config?.api_url || apiKey !== config?.api_key) {
      const saved = await saveConfig({
        api_url: apiUrl.trim(),
        api_key: apiKey.trim(),
        ativo,
        notificar_romaneio: notificarRomaneio,
        sincronizar_demanda: sincronizarDemanda,
      });
      if (!saved) {
        setTesting(false);
        return;
      }
    }

    const result = await testConnection();
    setTestResult(result);
    setTesting(false);
    
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integração com PDV Externo</h1>
          <p className="text-muted-foreground mt-1">
            Configure a conexão com o sistema PDV da pizzaria para sincronizar demanda e notificar envios.
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isConfigured && config?.ativo ? (
                  <>
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                      <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Integração Ativa</p>
                      {config?.ultima_sincronizacao && (
                        <p className="text-sm text-muted-foreground">
                          Última sincronização: {format(new Date(config.ultima_sincronizacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800">
                      <WifiOff className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium">Integração {isConfigured ? 'Desativada' : 'Não Configurada'}</p>
                      <p className="text-sm text-muted-foreground">
                        {isConfigured ? 'Ative a integração para sincronizar dados' : 'Configure os dados de conexão abaixo'}
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {testResult && (
                <Badge variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Falha</>
                  )}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Conexão</CardTitle>
              <CardDescription>
                Insira os dados fornecidos pelo sistema PDV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiUrl">URL da API PDV</Label>
                <Input
                  id="apiUrl"
                  placeholder="https://exemplo.supabase.co/functions/v1"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">Chave de API (X-API-KEY)</Label>
                <div className="flex gap-2">
                  <Input
                    id="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="Sua chave de API"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Integração Ativa</Label>
                    <p className="text-sm text-muted-foreground">
                      Habilitar comunicação com o PDV
                    </p>
                  </div>
                  <Switch
                    checked={ativo}
                    onCheckedChange={setAtivo}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificar Romaneio</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificação ao despachar romaneio
                    </p>
                  </div>
                  <Switch
                    checked={notificarRomaneio}
                    onCheckedChange={setNotificarRomaneio}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sincronizar Demanda</Label>
                    <p className="text-sm text-muted-foreground">
                      Buscar demanda de produção do PDV
                    </p>
                  </div>
                  <Switch
                    checked={sincronizarDemanda}
                    onCheckedChange={setSincronizarDemanda}
                  />
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || !apiUrl || !apiKey}
                  className="flex-1"
                >
                  {testing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testando...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" /> Testar Conexão</>
                  )}
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={saving || !apiUrl || !apiKey}
                  className="flex-1"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Salvar</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logs Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico de Requisições</CardTitle>
                  <CardDescription>
                    Últimas 50 requisições para o PDV
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => refreshLogs()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma requisição registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border ${
                          log.sucesso 
                            ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                            : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {log.direcao === 'pull' ? (
                              <ArrowDownCircle className="h-4 w-4 text-blue-500" />
                            ) : (
                              <ArrowUpCircle className="h-4 w-4 text-orange-500" />
                            )}
                            <span className="font-mono text-sm">
                              {log.metodo} {log.endpoint}
                            </span>
                          </div>
                          <Badge variant={log.sucesso ? 'outline' : 'destructive'} className="text-xs">
                            {log.status_code || 'ERR'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </span>
                          <span>{log.duracao_ms}ms</span>
                        </div>
                        {log.erro && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {log.erro}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ConfigurarIntegracaoPDV;
