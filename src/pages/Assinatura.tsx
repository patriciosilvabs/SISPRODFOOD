import { Layout } from '@/components/Layout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, Clock, CreditCard, Building2 } from 'lucide-react';

const Assinatura = () => {
  const { organizationName } = useOrganization();
  const { 
    subscriptionStatus, 
    daysRemaining, 
    isTrialExpired, 
    isSubscriptionActive,
    subscriptionPlan 
  } = useSubscription();

  const getStatusBadge = () => {
    if (isSubscriptionActive) {
      return <Badge className="bg-green-500">Ativo</Badge>;
    }
    if (isTrialExpired) {
      return <Badge variant="destructive">Trial Expirado</Badge>;
    }
    if (subscriptionStatus === 'trial') {
      return <Badge className="bg-amber-500">Trial - {daysRemaining} dias restantes</Badge>;
    }
    if (subscriptionStatus === 'pending_payment') {
      return <Badge className="bg-yellow-500">Pagamento Pendente</Badge>;
    }
    return <Badge variant="secondary">{subscriptionStatus}</Badge>;
  };

  const planos = [
    {
      nome: 'Básico',
      preco: 99,
      recursos: [
        'Até 2 lojas',
        'Até 5 usuários',
        'Relatórios básicos',
        'Suporte por email'
      ]
    },
    {
      nome: 'Profissional',
      preco: 199,
      destaque: true,
      recursos: [
        'Até 10 lojas',
        'Usuários ilimitados',
        'Relatórios avançados',
        'Lista de Compras IA',
        'Suporte prioritário'
      ]
    },
    {
      nome: 'Enterprise',
      preco: 399,
      recursos: [
        'Lojas ilimitadas',
        'Usuários ilimitados',
        'Relatórios customizados',
        'API de integração',
        'Suporte dedicado 24/7'
      ]
    }
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabeçalho com status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>{organizationName}</CardTitle>
                  <CardDescription>Gerenciar assinatura</CardDescription>
                </div>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
        </Card>

        {/* Alerta de trial expirado */}
        {isTrialExpired && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                <div>
                  <h3 className="font-semibold text-destructive">Período de teste expirado</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Seu período de teste gratuito terminou. Escolha um plano abaixo para continuar usando o sistema.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerta de trial ativo */}
        {subscriptionStatus === 'trial' && !isTrialExpired && (
          <Card className="border-amber-500 bg-amber-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Clock className="h-6 w-6 text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-700">Período de teste ativo</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Você tem <strong>{daysRemaining} dias</strong> restantes no período de teste gratuito.
                    Assine agora para garantir acesso ininterrupto ao sistema.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Planos */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Escolha seu plano</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {planos.map((plano) => (
              <Card 
                key={plano.nome} 
                className={plano.destaque ? 'border-primary ring-2 ring-primary' : ''}
              >
                <CardHeader>
                  {plano.destaque && (
                    <Badge className="w-fit mb-2">Mais popular</Badge>
                  )}
                  <CardTitle className="text-lg">{plano.nome}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">R$ {plano.preco}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plano.recursos.map((recurso, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                        {recurso}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plano.destaque ? 'default' : 'outline'}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Assinar {plano.nome}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Seção de pagamento PIX - placeholder para Woovi */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pagamento via PIX</CardTitle>
            <CardDescription>
              Após selecionar um plano, o QR Code PIX aparecerá aqui para pagamento instantâneo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 bg-muted rounded-lg border-2 border-dashed">
              <div className="text-center text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>QR Code PIX será exibido aqui</p>
                <p className="text-xs mt-1">(Integração Woovi)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info sobre assinatura ativa */}
        {isSubscriptionActive && (
          <Card className="border-green-500 bg-green-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Check className="h-6 w-6 text-green-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-700">Assinatura ativa</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Você está no plano <strong>{subscriptionPlan || 'Profissional'}</strong>.
                    Obrigado por ser nosso cliente!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Assinatura;
