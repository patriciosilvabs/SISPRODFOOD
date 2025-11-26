import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flag } from 'lucide-react';

const ContagemPorcionados = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Contagem Porcionados</h1>
          <p className="text-muted-foreground mt-1">
            Realize a contagem de itens porcionados
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Contagem de Porcionados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Faça a contagem e ajuste de estoque de porcionados.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ContagemPorcionados;
