import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Clock, Truck, Box, FileText, Search, TrendingUp, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UltimaAtualizacao {
  monitoramento: string | null;
  producao: string | null;
  consumoHistorico: string | null;
  romaneios: string | null;
  estoqueProdutos: string | null;
  insumos: string | null;
  diagnostico: string | null;
}

const CentralDeRelatorios = () => {
  const navigate = useNavigate();
  const [ultimasAtualizacoes, setUltimasAtualizacoes] = useState<UltimaAtualizacao>({
    monitoramento: null,
    producao: null,
    consumoHistorico: null,
    romaneios: null,
    estoqueProdutos: null,
    insumos: null,
    diagnostico: null,
  });

  useEffect(() => {
    fetchUltimasAtualizacoes();
  }, []);

  const fetchUltimasAtualizacoes = async () => {
    try {
      // Buscar última produção finalizada
      const { data: producaoData } = await supabase
        .from('producao_registros')
        .select('data_fim')
        .eq('status', 'finalizado')
        .order('data_fim', { ascending: false })
        .limit(1);

      // Buscar último consumo histórico
      const { data: consumoData } = await supabase
        .from('consumo_historico')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      // Buscar último romaneio (de qualquer tipo)
      const { data: romaneioPorcionadoData } = await supabase
        .from('romaneios')
        .select('data_criacao')
        .order('data_criacao', { ascending: false })
        .limit(1);

      const { data: romaneioProdutoData } = await supabase
        .from('romaneios_produtos')
        .select('data_criacao')
        .order('data_criacao', { ascending: false })
        .limit(1);

      const { data: romaneioAvulsoData } = await supabase
        .from('romaneios_avulsos')
        .select('data_criacao')
        .order('data_criacao', { ascending: false })
        .limit(1);

      // Pegar a mais recente entre os 3 tipos de romaneio
      const datasRomaneio = [
        romaneioPorcionadoData?.[0]?.data_criacao,
        romaneioProdutoData?.[0]?.data_criacao,
        romaneioAvulsoData?.[0]?.data_criacao,
      ].filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());

      // Buscar última movimentação de estoque produtos
      const { data: estoqueData } = await supabase
        .from('estoque_cpd_produtos')
        .select('data_ultima_movimentacao')
        .order('data_ultima_movimentacao', { ascending: false })
        .limit(1);

      // Buscar última movimentação de insumos
      const { data: insumosData } = await supabase
        .from('insumos_log')
        .select('data')
        .order('data', { ascending: false })
        .limit(1);

      // Buscar última contagem (para diagnóstico)
      const { data: contagemData } = await supabase
        .from('contagem_porcionados')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1);

      setUltimasAtualizacoes({
        monitoramento: consumoData?.[0]?.created_at || null,
        producao: producaoData?.[0]?.data_fim || null,
        consumoHistorico: consumoData?.[0]?.created_at || null,
        romaneios: datasRomaneio[0] || null,
        estoqueProdutos: estoqueData?.[0]?.data_ultima_movimentacao || null,
        insumos: insumosData?.[0]?.data || null,
        diagnostico: contagemData?.[0]?.updated_at || null,
      });
    } catch (error) {
      console.error('Erro ao buscar últimas atualizações:', error);
    }
  };

  const formatarUltimaAtualizacao = (data: string | null) => {
    if (!data) return null;
    try {
      return formatDistanceToNow(new Date(data), { locale: ptBR, addSuffix: true });
    } catch {
      return null;
    }
  };

  const reports = [
    {
      title: 'Monitoramento de Consumo (IA)',
      description: 'Acompanhe alertas e ajustes automáticos de estoque.',
      icon: Bot,
      color: 'bg-blue-100 text-blue-600',
      onClick: () => navigate('/relatorios/monitoramento-consumo'),
      ultimaAtualizacao: ultimasAtualizacoes.monitoramento,
    },
    {
      title: 'Relatório de Produção',
      description: 'Histórico detalhado de toda a produção.',
      icon: Clock,
      color: 'bg-blue-100 text-blue-600',
      onClick: () => navigate('/relatorios/producao'),
      ultimaAtualizacao: ultimasAtualizacoes.producao,
    },
    {
      title: 'Histórico de Consumo Real vs Programado',
      description: 'Análise de perdas e eficiência na produção.',
      icon: TrendingUp,
      color: 'bg-indigo-100 text-indigo-600',
      onClick: () => navigate('/relatorios/consumo-historico'),
      ultimaAtualizacao: ultimasAtualizacoes.consumoHistorico,
    },
    {
      title: 'Relatório de Romaneios',
      description: 'Histórico de envios de porcionados e divergências.',
      icon: Truck,
      color: 'bg-orange-100 text-orange-600',
      onClick: () => navigate('/relatorios/romaneios'),
      ultimaAtualizacao: ultimasAtualizacoes.romaneios,
    },
    {
      title: 'Relatório de Estoque de Produtos',
      description: 'Visualize o estoque atual dos produtos gerais.',
      icon: Box,
      color: 'bg-green-100 text-green-600',
      onClick: () => navigate('/relatorios/estoque-produtos'),
      ultimaAtualizacao: ultimasAtualizacoes.estoqueProdutos,
    },
    {
      title: 'Relatório de Insumos',
      description: 'Entradas e saídas de insumos do CPD.',
      icon: FileText,
      color: 'bg-cyan-100 text-cyan-600',
      onClick: () => navigate('/relatorios/insumos'),
      ultimaAtualizacao: ultimasAtualizacoes.insumos,
    },
    {
      title: 'Diagnóstico de Estoque',
      description: 'Analise a cobertura do estoque de porcionados.',
      icon: Search,
      color: 'bg-purple-100 text-purple-600',
      onClick: () => navigate('/relatorios/diagnostico-estoque'),
      ultimaAtualizacao: ultimasAtualizacoes.diagnostico,
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Central de Relatórios</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report, index) => {
            const Icon = report.icon;
            const ultimaAtualizacaoFormatada = formatarUltimaAtualizacao(report.ultimaAtualizacao);
            
            return (
              <Card 
                key={index}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={report.onClick}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${report.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{report.title}</h3>
                      <p className="text-sm text-muted-foreground">{report.description}</p>
                      
                      {ultimaAtualizacaoFormatada && (
                        <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Última atualização: {ultimaAtualizacaoFormatada}</span>
                        </div>
                      )}
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

export default CentralDeRelatorios;
