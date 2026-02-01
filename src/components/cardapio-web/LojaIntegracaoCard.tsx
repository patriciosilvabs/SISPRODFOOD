import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Copy, RefreshCw, Eye, EyeOff, Store, Plus, Loader2, Plug, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { IntegracaoCardapioWebComLoja } from '@/hooks/useCardapioWebIntegracao';

interface LojaInfo {
  id: string;
  nome: string;
  codigo_cardapio_web: string | null;
  tipo: string | null;
}

interface TestResult {
  success: boolean;
  message: string;
}

interface LojaIntegracaoCardProps {
  loja: LojaInfo;
  integracao: IntegracaoCardapioWebComLoja | null;
  onCreateIntegracao: (lojaId: string, ambiente: 'sandbox' | 'producao') => Promise<void>;
  onUpdateStatus: (id: string, ativo: boolean) => void;
  onRegenerateToken: (id: string) => void;
  onTestConnection?: (token: string) => Promise<{ success: boolean; message: string; ambiente: string }>;
  isCreating: boolean;
  isUpdating: boolean;
}

export function LojaIntegracaoCard({
  loja,
  integracao,
  onCreateIntegracao,
  onUpdateStatus,
  onRegenerateToken,
  onTestConnection,
  isCreating,
  isUpdating,
}: LojaIntegracaoCardProps) {
  const [showToken, setShowToken] = useState(false);
  const [selectedAmbiente, setSelectedAmbiente] = useState<'sandbox' | 'producao'>('sandbox');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleCopyToken = () => {
    if (integracao?.token) {
      navigator.clipboard.writeText(integracao.token);
      toast.success('Token copiado!');
    }
  };

  const handleCopyWebhookUrl = () => {
    if (integracao?.url_webhook) {
      navigator.clipboard.writeText(integracao.url_webhook);
      toast.success('URL copiada!');
    }
  };

  const handleCreate = async () => {
    await onCreateIntegracao(loja.id, selectedAmbiente);
  };

  const handleTestConnection = async () => {
    if (!integracao?.token || !onTestConnection) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await onTestConnection(integracao.token);
      setTestResult({ success: true, message: result.message });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Sem integração configurada
  if (!integracao) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Store className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">{loja.nome}</CardTitle>
                <CardDescription>
                  {loja.codigo_cardapio_web 
                    ? `Código: ${loja.codigo_cardapio_web}` 
                    : 'Código não configurado'}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              Não configurada
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loja.codigo_cardapio_web && (
            <p className="text-sm text-muted-foreground">
              ⚠️ Configure o código do Cardápio Web na página de Lojas antes de ativar a integração.
            </p>
          )}
          <div className="flex items-center gap-3">
            <Select value={selectedAmbiente} onValueChange={(v) => setSelectedAmbiente(v as 'sandbox' | 'producao')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={handleCreate} 
              disabled={isCreating}
              className="flex-1"
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Configurar Integração
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Com integração configurada
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              integracao.ativo ? 'bg-primary/10' : 'bg-muted'
            }`}>
              <Store className={`h-5 w-5 ${integracao.ativo ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <CardTitle className="text-lg">{loja.nome}</CardTitle>
              <CardDescription>
                Código: {loja.codigo_cardapio_web || 'Não configurado'} • {integracao.ambiente === 'producao' ? 'Produção' : 'Sandbox'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={integracao.ativo ? 'default' : 'secondary'}>
              {integracao.ativo ? 'Ativa' : 'Inativa'}
            </Badge>
            <Switch
              checked={integracao.ativo}
              onCheckedChange={(ativo) => onUpdateStatus(integracao.id, ativo)}
              disabled={isUpdating}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook URL */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
          <div className="flex gap-2">
            <Input 
              value={integracao.url_webhook || ''} 
              readOnly 
              className="font-mono text-xs h-9"
            />
            <Button variant="outline" size="sm" onClick={handleCopyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Token */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Token (X-API-KEY)</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input 
                type={showToken ? 'text' : 'password'}
                value={integracao.token} 
                readOnly 
                className="font-mono text-xs h-9 pr-10"
              />
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute right-0 top-0 h-full px-2"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyToken}>
              <Copy className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerar Token?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O token atual será invalidado e você precisará atualizar a configuração no Cardápio Web.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onRegenerateToken(integracao.id)}>
                    Regenerar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Test Connection Button */}
        {onTestConnection && (
          <div className="pt-2 space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plug className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>
            
            {testResult && (
              <div className={`flex items-center gap-2 text-sm p-2 rounded-md ${
                testResult.success 
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                  : 'bg-destructive/10 text-destructive'
              }`}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
