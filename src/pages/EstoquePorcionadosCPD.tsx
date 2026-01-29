import { Layout } from '@/components/Layout';
import { AjusteEstoquePorcionadosCPD } from '@/components/cpd/AjusteEstoquePorcionadosCPD';
import { useCPDLoja } from '@/hooks/useCPDLoja';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const EstoquePorcionadosCPD = () => {
  const { cpdLoja, cpdLojaId, loading } = useCPDLoja();

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!cpdLoja || !cpdLojaId) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Estoque Porcionados (CPD)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ajuste de estoque de porcionados do Centro de Produção
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                CPD Não Configurado
              </CardTitle>
              <CardDescription>
                Não foi encontrado um Centro de Produção e Distribuição (CPD) configurado para sua organização.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Para utilizar esta funcionalidade, é necessário cadastrar uma loja do tipo "CPD" 
                no menu <strong>Administração → Configurações → Lojas</strong>.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Estoque Porcionados (CPD)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ajuste de estoque de porcionados do Centro de Produção
          </p>
        </div>

        <AjusteEstoquePorcionadosCPD
          cpdLojaId={cpdLojaId}
          cpdLojaNome={cpdLoja.nome}
        />
      </div>
    </Layout>
  );
};

export default EstoquePorcionadosCPD;
