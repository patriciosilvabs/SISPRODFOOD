import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

const ErrosDevolucoes = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Erros e Devoluções</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie erros e devoluções de produtos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Erros e Devoluções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Registre e acompanhe erros e devoluções.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ErrosDevolucoes;
