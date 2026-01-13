import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Snowflake, RefreshCw, PlayCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProductionStatus {
  producao_ativa: boolean;
  total_a_produzir: number;
  total_em_andamento: number;
  total_finalizado: number;
  primeiro_preparo_em: string | null;
}

export function CutoffStatusPanel() {
  const { organizationId } = useOrganization();
  const [status, setStatus] = useState<ProductionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProductionStatus = async () => {
    if (!organizationId) return;
    
    try {
      // Buscar loja CPD para obter dia operacional
      const { data: cpdLoja } = await supabase
        .from('lojas')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('tipo', 'cpd')
        .maybeSingle();

      // Buscar data operacional
      let hoje: string;
      if (cpdLoja?.id) {
        const { data: diaOp } = await supabase.rpc('calcular_dia_operacional', { p_loja_id: cpdLoja.id });
        hoje = diaOp || new Date().toISOString().split('T')[0];
      } else {
        const { data: dataServidor } = await supabase.rpc('get_current_date');
        hoje = dataServidor || new Date().toISOString().split('T')[0];
      }

      // Buscar registros de produção do dia
      const { data: registros } = await supabase
        .from('producao_registros')
        .select('id, status, data_inicio_preparo')
        .eq('organization_id', organizationId)
        .eq('data_referencia', hoje);

      const totalAProduzir = registros?.filter(r => r.status === 'a_produzir').length || 0;
      const totalEmAndamento = registros?.filter(r => ['em_preparo', 'em_porcionamento'].includes(r.status)).length || 0;
      const totalFinalizado = registros?.filter(r => r.status === 'finalizado').length || 0;
      
      // Verificar se há produção ativa (em_preparo, em_porcionamento, finalizado)
      const producaoAtiva = registros?.some(r => 
        ['em_preparo', 'em_porcionamento', 'finalizado'].includes(r.status)
      ) || false;

      // Buscar primeiro preparo do dia
      const primeiroPreparo = registros
        ?.filter(r => r.data_inicio_preparo)
        .sort((a, b) => new Date(a.data_inicio_preparo!).getTime() - new Date(b.data_inicio_preparo!).getTime())[0];

      setStatus({
        producao_ativa: producaoAtiva,
        total_a_produzir: totalAProduzir,
        total_em_andamento: totalEmAndamento,
        total_finalizado: totalFinalizado,
        primeiro_preparo_em: primeiroPreparo?.data_inicio_preparo || null,
      });
    } catch (error) {
      console.error('Erro ao carregar status de produção:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductionStatus();
  }, [organizationId]);

  // Atualizar a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(loadProductionStatus, 30000);
    return () => clearInterval(interval);
  }, [organizationId]);

  if (loading) {
    return null;
  }

  const totalRegistros = (status?.total_a_produzir || 0) + (status?.total_em_andamento || 0) + (status?.total_finalizado || 0);

  if (totalRegistros === 0) {
    return null;
  }

  return (
    <Card className={`mb-4 border-l-4 ${status?.producao_ativa ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
      <CardContent className="py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {status?.producao_ativa ? (
              <>
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Snowflake className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-blue-700 dark:text-blue-300">
                      Produção Iniciada
                    </p>
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      Demanda Travada
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {status?.total_em_andamento} em andamento • {status?.total_finalizado} finalizados
                    {status?.primeiro_preparo_em && (
                      <> • Início às {format(new Date(status.primeiro_preparo_em), 'HH:mm', { locale: ptBR })}</>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-amber-700 dark:text-amber-300">
                      Demanda Aberta
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {status?.total_a_produzir} pendentes
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A demanda pode ser alterada até iniciar o preparo de um lote
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadProductionStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}