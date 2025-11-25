import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Factory } from 'lucide-react';

const Producao = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Produção</h1>
          <p className="text-muted-foreground mt-1">
            Gerenciar lotes e registros de produção
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Sistema de Produção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo de produção em desenvolvimento. Aqui você poderá:
            </p>
            <ul className="mt-4 space-y-2 text-muted-foreground">
              <li>• Criar lotes de produção</li>
              <li>• Registrar porcionamento de itens</li>
              <li>• Baixar insumos automaticamente</li>
              <li>• Controlar sobras e perdas</li>
              <li>• Finalizar produções</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Producao;
