import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';

const ListaDeComprasIA = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Lista de Compras IA</h1>
          <p className="text-muted-foreground mt-1">
            Lista de compras inteligente gerada por IA
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Lista de Compras com IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. IA gerará lista de compras baseada em consumo e previsão.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ListaDeComprasIA;
