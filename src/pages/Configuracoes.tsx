import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

const Configuracoes = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Configurações do sistema e gerenciamento de usuários
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo de configurações em desenvolvimento. Aqui você poderá:
            </p>
            <ul className="mt-4 space-y-2 text-muted-foreground">
              <li>• Gerenciar usuários e permissões</li>
              <li>• Atribuir cargos (Admin, Produção, Loja)</li>
              <li>• Configurar acesso às lojas por usuário</li>
              <li>• Definir parâmetros do sistema</li>
              <li>• Visualizar logs de atividades</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Configuracoes;
