import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

const CentralDeRelatorios = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Central de Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Acesse todos os relatórios do sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Relatórios do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Visualize relatórios consolidados e análises.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CentralDeRelatorios;
