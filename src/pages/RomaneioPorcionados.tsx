import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck } from 'lucide-react';

const RomaneioPorcionados = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Romaneio Porcionados</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os romaneios de envio de porcionados
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Romaneio de Porcionados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Crie e gerencie romaneios de envio para as lojas.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RomaneioPorcionados;
