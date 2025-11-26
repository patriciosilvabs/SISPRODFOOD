import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Clock, Truck, Box, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';

const CentralDeRelatorios = () => {
  const reports = [
    {
      title: 'Monitoramento de Consumo (IA)',
      description: 'Acompanhe alertas e ajustes automáticos de estoque.',
      icon: Bot,
      color: 'bg-blue-100 text-blue-600',
      onClick: () => toast.info('Funcionalidade em desenvolvimento'),
    },
    {
      title: 'Relatório de Produção',
      description: 'Histórico detalhado de toda a produção.',
      icon: Clock,
      color: 'bg-blue-100 text-blue-600',
      onClick: () => toast.info('Funcionalidade em desenvolvimento'),
    },
    {
      title: 'Relatório de Romaneios',
      description: 'Histórico de envios de porcionados e divergências.',
      icon: Truck,
      color: 'bg-orange-100 text-orange-600',
      onClick: () => toast.info('Funcionalidade em desenvolvimento'),
    },
    {
      title: 'Relatório de Estoque de Produtos',
      description: 'Visualize o estoque atual dos produtos gerais.',
      icon: Box,
      color: 'bg-green-100 text-green-600',
      onClick: () => toast.info('Funcionalidade em desenvolvimento'),
    },
    {
      title: 'Relatório de Insumos',
      description: 'Entradas e saídas de insumos do CPD.',
      icon: FileText,
      color: 'bg-cyan-100 text-cyan-600',
      onClick: () => toast.info('Funcionalidade em desenvolvimento'),
    },
    {
      title: 'Diagnóstico de Estoque',
      description: 'Analise a cobertura do estoque de porcionados.',
      icon: Search,
      color: 'bg-purple-100 text-purple-600',
      onClick: () => toast.info('Funcionalidade em desenvolvimento'),
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
