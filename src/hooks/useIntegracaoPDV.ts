import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface IntegracaoPDV {
  id: string;
  organization_id: string;
  nome: string;
  api_url: string;
  api_key: string;
  ativo: boolean;
  notificar_romaneio: boolean;
  sincronizar_demanda: boolean;
  ultima_sincronizacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface PDVDemandItem {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  current_stock: number;
  target_stock: number;
  to_produce: number;
  status: 'critical' | 'low' | 'needed' | 'ok';
}

export interface PDVDemandResponse {
  success: boolean;
  date: string;
  day_of_week: number;
  store: {
    id: string;
    name: string;
  };
  demand: PDVDemandItem[];
}

export interface IntegracaoPDVLog {
  id: string;
  organization_id: string;
  direcao: 'pull' | 'push';
  endpoint: string;
  metodo: string;
  payload: any;
  resposta: any;
  status_code: number;
  sucesso: boolean;
  erro: string | null;
  duracao_ms: number;
  created_at: string;
}

export function useIntegracaoPDV() {
  const { organizationId } = useOrganization();
  const [config, setConfig] = useState<IntegracaoPDV | null>(null);
  const [logs, setLogs] = useState<IntegracaoPDVLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('integracoes_pdv')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;
      setConfig(data as IntegracaoPDV | null);
    } catch (error) {
      console.error('Erro ao buscar configuração PDV:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const fetchLogs = useCallback(async (limit = 50) => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('integracoes_pdv_log')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setLogs((data as IntegracaoPDVLog[]) || []);
    } catch (error) {
      console.error('Erro ao buscar logs PDV:', error);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, [fetchConfig, fetchLogs]);

  const saveConfig = async (newConfig: Partial<IntegracaoPDV>) => {
    if (!organizationId) return false;
    
    try {
      setSaving(true);
      
      if (config?.id) {
        // Update existing
        const { error } = await supabase
          .from('integracoes_pdv')
          .update({
            ...newConfig,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('integracoes_pdv')
          .insert({
            organization_id: organizationId,
            nome: newConfig.nome || 'PDV Pizzaria',
            api_url: newConfig.api_url!,
            api_key: newConfig.api_key!,
            ativo: newConfig.ativo ?? true,
            notificar_romaneio: newConfig.notificar_romaneio ?? true,
            sincronizar_demanda: newConfig.sincronizar_demanda ?? true,
          });

        if (error) throw error;
      }

      await fetchConfig();
      toast.success('Configuração salva com sucesso!');
      return true;
    } catch (error: any) {
      console.error('Erro ao salvar configuração PDV:', error);
      toast.error(`Erro ao salvar: ${error.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (): Promise<{ success: boolean; message: string }> => {
    if (!config?.api_url || !config?.api_key) {
      return { success: false, message: 'Configure a URL e chave de API primeiro' };
    }

    try {
      setSyncing(true);
      
      const { data, error } = await supabase.functions.invoke('pdv-sync', {
        body: null,
      });

      if (error) throw error;

      if (data?.success) {
        return { success: true, message: 'Conexão estabelecida com sucesso!' };
      } else {
        return { success: false, message: data?.message || 'Falha na conexão' };
      }
    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      return { success: false, message: error.message || 'Erro ao conectar' };
    } finally {
      setSyncing(false);
    }
  };

  const syncDemand = async (): Promise<PDVDemandResponse | null> => {
    try {
      setSyncing(true);
      
      const { data, error } = await supabase.functions.invoke('pdv-sync', {
        body: null,
      });

      if (error) throw error;

      await fetchLogs();
      
      if (data?.success && data?.data) {
        toast.success('Demanda sincronizada com sucesso!');
        return data.data as PDVDemandResponse;
      } else {
        toast.error(data?.message || 'Erro ao sincronizar demanda');
        return null;
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar demanda:', error);
      toast.error(`Erro: ${error.message}`);
      return null;
    } finally {
      setSyncing(false);
    }
  };

  const notifyShipment = async (
    romaneioId: string,
    externalId: string,
    items: Array<{ ingredient_name: string; quantity: number; unit: string }>,
    notes?: string
  ): Promise<boolean> => {
    if (!config?.ativo || !config?.notificar_romaneio) {
      console.log('Notificação PDV desabilitada');
      return true; // Not an error, just skipped
    }

    try {
      const { data, error } = await supabase.functions.invoke('pdv-notify-shipment', {
        body: {
          romaneio_id: romaneioId,
          external_id: externalId,
          items,
          notes,
        },
      });

      if (error) throw error;

      await fetchLogs();

      if (data?.success) {
        toast.success('PDV notificado sobre o envio');
        return true;
      } else if (data?.skipped) {
        // Integration disabled, not an error
        return true;
      } else {
        toast.warning(`PDV não foi notificado: ${data?.message || 'Erro desconhecido'}`);
        return false;
      }
    } catch (error: any) {
      console.error('Erro ao notificar PDV:', error);
      toast.warning(`Erro ao notificar PDV: ${error.message}`);
      return false;
    }
  };

  return {
    config,
    logs,
    loading,
    saving,
    syncing,
    isConfigured: !!config,
    isActive: config?.ativo ?? false,
    saveConfig,
    testConnection,
    syncDemand,
    notifyShipment,
    refreshConfig: fetchConfig,
    refreshLogs: fetchLogs,
  };
}
