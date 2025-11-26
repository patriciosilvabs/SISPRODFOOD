import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

const ReceberPorcionados = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Receber Porcionados</h1>
          <p className="text-muted-foreground mt-1">
            Registre o recebimento de porcionados nas lojas
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Recebimento de Porcionados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Confirme e registre o recebimento de porcionados.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ReceberPorcionados;
