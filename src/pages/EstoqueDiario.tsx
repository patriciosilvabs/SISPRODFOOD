import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

const EstoqueDiario = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Estoque Diário (Geral)</h1>
          <p className="text-muted-foreground mt-1">
            Controle o estoque diário geral do sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Estoque Diário Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Gerencie o estoque diário de todos os produtos.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EstoqueDiario;
