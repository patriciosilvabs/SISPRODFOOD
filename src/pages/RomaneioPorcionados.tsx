import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, ClipboardList, RefreshCw } from 'lucide-react';

const RomaneioPorcionados = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Romaneio</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie romaneios de envio, recebimento e reposição de estoque das lojas
          </p>
        </div>

        <Tabs defaultValue="romaneio" className="w-full">
          <TabsList>
            <TabsTrigger value="romaneio" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Criar Romaneio
            </TabsTrigger>
            <TabsTrigger value="receber" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Receber Porcionados
            </TabsTrigger>
            <TabsTrigger value="reposicao" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reposição de Estoque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="romaneio">
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
          </TabsContent>

          <TabsContent value="receber">
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
          </TabsContent>

          <TabsContent value="reposicao">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Reposição de Estoque das Lojas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Módulo em desenvolvimento. Gerencie os pedidos de reposição de estoque das lojas.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default RomaneioPorcionados;
