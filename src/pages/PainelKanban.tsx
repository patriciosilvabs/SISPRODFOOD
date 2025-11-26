import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';

const PainelKanban = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Painel Kanban</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as tarefas e produções em formato Kanban
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Painel Kanban
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Organize e visualize o fluxo de trabalho em formato Kanban.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PainelKanban;
