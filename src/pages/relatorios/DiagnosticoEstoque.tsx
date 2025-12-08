import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Package, Clock, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DiagnosticoItem {
  item_id: string;
  item_nome: string;
  estoque_atual: number;
  consumo_medio_diario: number;
  dias_cobertura: number;
  status: 'critico' | 'alerta' | 'normal';
  sugestao_producao: number;
  ultima_producao_data: string | null;
  ultima_producao_usuario: string | null;
  ultima_movimentacao_data: string | null;
}

const DiagnosticoEstoque = () => {
  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagnostico();
  }, []);

  const loadDiagnostico = async () => {
    try {
      setLoading(true);

      // Buscar estoque atual CPD com data de movimentação
      const { data: estoqueCpd, error: estoqueError } = await supabase
        .from('estoque_cpd')
        .select('item_porcionado_id, quantidade, data_ultima_movimentacao');

      if (estoqueError) throw estoqueError;

      // Buscar itens porcionados
      const { data: itens, error: itensError } = await supabase
        .from('itens_porcionados')
        .select('id, nome');

      if (itensError) throw itensError;

      // Buscar produção dos últimos 30 dias para calcular consumo
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 30);

      const { data: producao, error: producaoError } = await supabase
        .from('producao_registros')
        .select('item_id, unidades_reais, data_fim, usuario_nome')
        .eq('status', 'finalizado')
        .gte('data_fim', dataInicio.toISOString())
        .order('data_fim', { ascending: false });

      if (producaoError) throw producaoError;

      // Calcular diagnóstico
      const diagnosticosArray: DiagnosticoItem[] = [];

      itens?.forEach((item) => {
        const estoque = estoqueCpd?.find((e) => e.item_porcionado_id === item.id);
        const estoqueAtual = Number(estoque?.quantidade || 0);

        // Calcular consumo médio diário
        const producaoItem = producao?.filter((p) => p.item_id === item.id);
        const totalProduzido = producaoItem?.reduce((sum, p) => sum + (p.unidades_reais || 0), 0) || 0;
        const consumoMedioDiario = totalProduzido / 30;

        // Calcular dias de cobertura
        const diasCobertura = consumoMedioDiario > 0 ? estoqueAtual / consumoMedioDiario : 999;

        // Determinar status
        let status: 'critico' | 'alerta' | 'normal' = 'normal';
        if (diasCobertura < 2) {
          status = 'critico';
        } else if (diasCobertura < 5) {
          status = 'alerta';
        }

        // Sugestão de produção (para manter 7 dias de cobertura)
        const estoqueIdeal = consumoMedioDiario * 7;
        const sugestaoProducao = Math.max(0, estoqueIdeal - estoqueAtual);

        // Buscar última produção do item
        const ultimaProducao = producaoItem?.[0];

        diagnosticosArray.push({
          item_id: item.id,
          item_nome: item.nome,
          estoque_atual: estoqueAtual,
          consumo_medio_diario: consumoMedioDiario,
          dias_cobertura: diasCobertura,
          status,
          sugestao_producao: Math.ceil(sugestaoProducao),
          ultima_producao_data: ultimaProducao?.data_fim || null,
          ultima_producao_usuario: ultimaProducao?.usuario_nome || null,
          ultima_movimentacao_data: estoque?.data_ultima_movimentacao || null,
        });
      });

      // Ordenar por dias de cobertura (menor primeiro)
      diagnosticosArray.sort((a, b) => a.dias_cobertura - b.dias_cobertura);

      setDiagnosticos(diagnosticosArray);
    } catch (error) {
      console.error('Erro ao carregar diagnóstico:', error);
      toast.error('Erro ao carregar diagnóstico de estoque');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critico':
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Crítico</Badge>;
      case 'alerta':
        return <Badge variant="secondary"><AlertTriangle className="mr-1 h-3 w-3" />Alerta</Badge>;
      case 'normal':
        return <Badge variant="default"><TrendingUp className="mr-1 h-3 w-3" />Normal</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const totalCriticos = diagnosticos.filter((d) => d.status === 'critico').length;
  const totalAlertas = diagnosticos.filter((d) => d.status === 'alerta').length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Analisando estoque...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Diagnóstico de Estoque</h1>
          <p className="text-muted-foreground">Analise a cobertura do estoque de porcionados</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Itens Analisados</p>
                  <p className="text-2xl font-bold">{diagnosticos.length}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status Crítico</p>
                  <p className="text-2xl font-bold text-destructive">{totalCriticos}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Alerta</p>
                  <p className="text-2xl font-bold text-secondary">{totalAlertas}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Diagnóstico */}
        <Card>
          <CardHeader>
            <CardTitle>Análise Detalhada por Item</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {diagnosticos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum item para análise
                </p>
              ) : (
                diagnosticos.map((diag) => (
                  <div
                    key={diag.item_id}
                    className="flex flex-col p-4 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-lg">{diag.item_nome}</p>
                        {getStatusBadge(diag.status)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-muted-foreground">Estoque Atual</p>
                        <p className="font-medium">{diag.estoque_atual} un</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Consumo Médio</p>
                        <p className="font-medium">{diag.consumo_medio_diario.toFixed(1)} un/dia</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dias de Cobertura</p>
                        <p className={`font-medium ${diag.dias_cobertura < 2 ? 'text-destructive' : diag.dias_cobertura < 5 ? 'text-secondary' : 'text-primary'}`}>
                          {diag.dias_cobertura > 999 ? '∞' : `${diag.dias_cobertura.toFixed(1)} dias`}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sugestão de Produção</p>
                        <p className="font-medium text-primary">{diag.sugestao_producao} un</p>
                      </div>
                    </div>

                    {/* Data, Hora e Usuário */}
                    <div className="flex flex-wrap gap-4 pt-3 border-t text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Última produção: {formatDateTime(diag.ultima_producao_data)}</span>
                      </div>
                      {diag.ultima_producao_usuario && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>por {diag.ultima_producao_usuario}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Última movimentação: {formatDateTime(diag.ultima_movimentacao_data)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DiagnosticoEstoque;