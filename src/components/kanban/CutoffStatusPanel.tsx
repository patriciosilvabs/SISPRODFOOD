import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, Snowflake, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CutoffStatus {
  congelado: boolean;
  hora_cutoff: string;
  itens_congelados: number;
  congelado_em: string | null;
  passou_cutoff: boolean;
  hora_atual: string;
}

export function CutoffStatusPanel() {
  const { organizationId } = useOrganization();
  const [status, setStatus] = useState<CutoffStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [congelando, setCongelando] = useState(false);
  const autoCongelarAttempted = useRef(false);

  const loadCutoffStatus = async () => {
    if (!organizationId) return;
    
    try {
      // Buscar loja CPD para obter cutoff e fuso horário
      const { data: cpdLoja } = await supabase
        .from('lojas')
        .select('id, cutoff_operacional, fuso_horario')
        .eq('organization_id', organizationId)
        .eq('tipo', 'cpd')
        .maybeSingle();

      const fusoHorario = cpdLoja?.fuso_horario || 'America/Sao_Paulo';
      const horaCutoff = cpdLoja?.cutoff_operacional || '03:00:00';

      // Buscar data operacional
      let hoje: string;
      if (cpdLoja?.id) {
        const { data: diaOp } = await supabase.rpc('calcular_dia_operacional', { p_loja_id: cpdLoja.id });
        hoje = diaOp || new Date().toISOString().split('T')[0];
      } else {
        const { data: dataServidor } = await supabase.rpc('get_current_date');
        hoje = dataServidor || new Date().toISOString().split('T')[0];
      }

      // Calcular hora atual no fuso horário da organização
      const horaAtual = new Date().toLocaleTimeString('pt-BR', { 
        timeZone: fusoHorario, 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });

      // Verificar se passou do cutoff (comparando strings HH:MM)
      const cutoffHHMM = horaCutoff.substring(0, 5);
      const passouCutoff = horaAtual >= cutoffHHMM;

      // Verificar se há demandas congeladas hoje
      const { data: demandasCongeladas, count } = await supabase
        .from('demanda_congelada')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('dia_producao', hoje);

      const primeiraCongelada = demandasCongeladas?.[0];

      setStatus({
        congelado: (count || 0) > 0,
        hora_cutoff: horaCutoff,
        itens_congelados: count || 0,
        congelado_em: primeiraCongelada?.congelado_em || null,
        passou_cutoff: passouCutoff,
        hora_atual: horaAtual,
      });
    } catch (error) {
      console.error('Erro ao carregar status do cutoff:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCutoffStatus();
  }, [organizationId]);

  // Auto-congelar quando detectar que passou do cutoff sem ter congelado
  useEffect(() => {
    if (status && !status.congelado && status.passou_cutoff && !congelando && !autoCongelarAttempted.current) {
      autoCongelarAttempted.current = true;
      handleCongelarManualmente();
    }
  }, [status]);

  const handleCongelarManualmente = async () => {
    if (!organizationId) return;
    
    setCongelando(true);
    try {
      // Buscar data operacional
      const { data: cpdLoja } = await supabase
        .from('lojas')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('tipo', 'cpd')
        .maybeSingle();

      let hoje: string;
      if (cpdLoja?.id) {
        const { data: diaOp } = await supabase.rpc('calcular_dia_operacional', { p_loja_id: cpdLoja.id });
        hoje = diaOp || new Date().toISOString().split('T')[0];
      } else {
        const { data: dataServidor } = await supabase.rpc('get_current_date');
        hoje = dataServidor || new Date().toISOString().split('T')[0];
      }

      // Chamar função de congelamento
      const { data, error } = await supabase.rpc('congelar_demanda_cutoff', {
        p_organization_id: organizationId,
        p_dia_producao: hoje,
      });

      if (error) throw error;

      const result = data as { success: boolean; itens_congelados: number };
      toast.success(`Demanda congelada! ${result.itens_congelados} itens fixados.`);
      autoCongelarAttempted.current = false;
      loadCutoffStatus();
    } catch (error) {
      console.error('Erro ao congelar demanda:', error);
      toast.error('Erro ao congelar demanda');
    } finally {
      setCongelando(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Card className="mb-4 border-l-4 border-l-primary">
      <CardContent className="py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {/* Estado 1: Demanda Congelada (azul) */}
            {status?.congelado ? (
              <>
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Snowflake className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-blue-700 dark:text-blue-300">
                      Demanda Congelada
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {status.hora_cutoff.substring(0, 5)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {status.itens_congelados} item(ns) com demanda fixa
                    {status.congelado_em && (
                      <> • Congelado às {format(new Date(status.congelado_em), 'HH:mm', { locale: ptBR })}</>
                    )}
                  </p>
                </div>
              </>
            ) : status?.passou_cutoff ? (
              /* Estado 2: Cutoff Pendente (vermelho) - passou do horário mas não congelou */
              <>
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-red-700 dark:text-red-300">
                      Cutoff Pendente!
                    </p>
                    <Badge variant="destructive" className="text-xs">
                      {status.hora_cutoff.substring(0, 5)}
                    </Badge>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    O horário passou e a demanda ainda não foi congelada • {congelando ? 'Congelando...' : 'Clique para congelar'}
                  </p>
                </div>
              </>
            ) : (
              /* Estado 3: Aguardando Cutoff (amarelo) - antes do horário */
              <>
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-amber-700 dark:text-amber-300">
                      Aguardando Cutoff
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {status?.hora_cutoff?.substring(0, 5) || '03:00'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Demanda pode ser alterada até o horário de corte
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadCutoffStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
            {!status?.congelado && (
              <Button
                variant={status?.passou_cutoff ? 'destructive' : 'default'}
                size="sm"
                onClick={handleCongelarManualmente}
                disabled={congelando}
                className={!status?.passou_cutoff ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                {congelando ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Snowflake className="h-4 w-4 mr-2" />
                )}
                Congelar Agora
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
