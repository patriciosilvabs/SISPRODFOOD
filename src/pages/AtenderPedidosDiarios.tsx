import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

const AtenderPedidosDiarios = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Atender Pedidos Diários</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e atenda os pedidos diários das lojas
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Pedidos Diários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Processe e atenda os pedidos diários das lojas.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AtenderPedidosDiarios;
