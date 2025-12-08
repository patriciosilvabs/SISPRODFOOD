import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { Loader2, Bell, Mail, Clock, Send } from 'lucide-react';

interface ConfigurarAlertasEstoqueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConfigAlerta {
  id?: string;
  alertas_email_ativos: boolean;
  emails_destinatarios: string[];
  horario_envio_preferido: string;
  enviar_apenas_criticos: boolean;
  frequencia: 'diario' | 'semanal' | 'nunca';
}

export function ConfigurarAlertasEstoqueModal({
  open,
  onOpenChange,
}: ConfigurarAlertasEstoqueModalProps) {
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [config, setConfig] = useState<ConfigAlerta>({
    alertas_email_ativos: true,
    emails_destinatarios: [],
    horario_envio_preferido: '08:00',
    enviar_apenas_criticos: false,
    frequencia: 'diario',
  });
  const [emailsText, setEmailsText] = useState('');

  useEffect(() => {
    if (open && organizationId) {
      fetchConfig();
    }
  }, [open, organizationId]);

  const fetchConfig = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracao_alertas')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: data.id,
          alertas_email_ativos: data.alertas_email_ativos ?? true,
          emails_destinatarios: data.emails_destinatarios || [],
          horario_envio_preferido: data.horario_envio_preferido || '08:00',
          enviar_apenas_criticos: data.enviar_apenas_criticos ?? false,
          frequencia: (data.frequencia as 'diario' | 'semanal' | 'nunca') || 'diario',
        });
        setEmailsText((data.emails_destinatarios || []).join('\n'));
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast.error('Erro ao carregar configuração de alertas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      const emails = emailsText
        .split('\n')
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));

      const dataToSave = {
        organization_id: organizationId,
        alertas_email_ativos: config.alertas_email_ativos,
        emails_destinatarios: emails,
        horario_envio_preferido: config.horario_envio_preferido,
        enviar_apenas_criticos: config.enviar_apenas_criticos,
        frequencia: config.frequencia,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('configuracao_alertas')
        .upsert(dataToSave, {
          onConflict: 'organization_id',
        });

      if (error) throw error;

      toast.success('Configuração de alertas salva com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração de alertas');
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarAlertaAgora = async () => {
    setEnviandoTeste(true);
    try {
      const { data, error } = await supabase.functions.invoke('verificar-alertas-estoque', {
        body: {},
      });

      if (error) throw error;

      toast.success(data?.message || 'Verificação de alertas executada!');
    } catch (error) {
      console.error('Erro ao enviar alerta:', error);
      toast.error('Erro ao executar verificação de alertas');
    } finally {
      setEnviandoTeste(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas de Estoque
          </DialogTitle>
          <DialogDescription>
            Configure como e quando receber alertas sobre estoque baixo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Ativar alertas */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="alertas-ativos">Receber alertas por email</Label>
                <p className="text-sm text-muted-foreground">
                  Ative para receber emails automáticos
                </p>
              </div>
              <Switch
                id="alertas-ativos"
                checked={config.alertas_email_ativos}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, alertas_email_ativos: checked }))
                }
              />
            </div>

            {/* Frequência */}
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select
                value={config.frequencia}
                onValueChange={(value: 'diario' | 'semanal' | 'nunca') =>
                  setConfig((prev) => ({ ...prev, frequencia: value }))
                }
                disabled={!config.alertas_email_ativos}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="nunca">Nunca</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Horário */}
            <div className="space-y-2">
              <Label htmlFor="horario" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horário preferido
              </Label>
              <Input
                id="horario"
                type="time"
                value={config.horario_envio_preferido}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    horario_envio_preferido: e.target.value,
                  }))
                }
                disabled={!config.alertas_email_ativos || config.frequencia === 'nunca'}
              />
            </div>

            {/* Apenas críticos */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="apenas-criticos">Apenas itens críticos</Label>
                <p className="text-sm text-muted-foreground">
                  Ignorar itens "urgentes", alertar só críticos
                </p>
              </div>
              <Switch
                id="apenas-criticos"
                checked={config.enviar_apenas_criticos}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, enviar_apenas_criticos: checked }))
                }
                disabled={!config.alertas_email_ativos}
              />
            </div>

            {/* Emails adicionais */}
            <div className="space-y-2">
              <Label htmlFor="emails" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Emails adicionais (um por linha)
              </Label>
              <Textarea
                id="emails"
                placeholder="compras@empresa.com&#10;gerente@empresa.com"
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
                rows={3}
                disabled={!config.alertas_email_ativos}
              />
              <p className="text-xs text-muted-foreground">
                Admins da organização recebem automaticamente
              </p>
            </div>

            {/* Botões */}
            <div className="flex flex-col gap-2 pt-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>

              <Button
                variant="secondary"
                onClick={handleEnviarAlertaAgora}
                disabled={enviandoTeste || !config.alertas_email_ativos}
                className="w-full"
              >
                {enviandoTeste ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Alerta Agora (Teste)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
