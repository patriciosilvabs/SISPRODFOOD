import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

const ResumoDaProducao = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Resumo da Produção</h1>
          <p className="text-muted-foreground mt-1">
            Visualize o resumo consolidado da produção
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Resumo da Produção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Aqui você terá acesso ao resumo consolidado de todas as produções.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ResumoDaProducao;
