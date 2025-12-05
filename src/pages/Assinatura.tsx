import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useWooviPayment } from '@/hooks/useWooviPayment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PixPaymentModal } from '@/components/payment/PixPaymentModal';
import { PlanoAssinatura, PLANOS_CONFIG } from '@/types/payment';
import { AlertTriangle, Check, Clock, CreditCard, Building2 } from 'lucide-react';

const StatusBadge = ({ subscriptionStatus, daysRemaining, isTrialExpired, isSubscriptionActive }: any) => {
  if (isSubscriptionActive) return <Badge className="bg-green-500">Ativo</Badge>;
  if (isTrialExpired) return <Badge variant="destructive">Trial Expirado</Badge>;
  if (subscriptionStatus === 'trial') return <Badge className="bg-amber-500">Trial - {daysRemaining} dias restantes</Badge>;
  if (subscriptionStatus === 'pending_payment') return <Badge className="bg-yellow-500">Pagamento Pendente</Badge>;
  return <Badge variant="secondary">{subscriptionStatus}</Badge>;
};

const PlanoCard = ({ plano, onAssinar, destaque }: any) => (
  <Card className={destaque ? 'border-primary ring-2 ring-primary' : ''}>
    <CardHeader>
      {destaque && <Badge className="w-fit mb-2">Mais popular</Badge>}
      <CardTitle className="text-lg">{plano.nome}</CardTitle>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold">R$ {plano.preco / 100}</span>
        <span className="text-muted-foreground">/mês</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <ul className="space-y-2">
        {plano.recursos.map((recurso: string, idx: number) => (
          <li key={idx} className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500 shrink-0" />
            {recurso}
          </li>
        ))}
      </ul>
      <Button className="w-full" variant={destaque ? 'default' : 'outline'} onClick={onAssinar}>
        <CreditCard className="h-4 w-4 mr-2" />
        Assinar {plano.nome}
      </Button>
    </CardContent>
  </Card>
);

const Assinatura = () => {
  const { organizationName, organizationId } = useOrganization();
  const { subscriptionStatus, daysRemaining, isTrialExpired, isSubscriptionActive, subscriptionPlan } = useSubscription();
  const { isLoading, error, charge, createCharge, reset } = useWooviPayment();
  const [selectedPlano, setSelectedPlano] = useState<PlanoAssinatura | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAssinar = async (plano: PlanoAssinatura) => {
    if (!organizationId) return;
    setSelectedPlano(plano);
    setModalOpen(true);
    await createCharge(organizationId, plano);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    reset();
    setSelectedPlano(null);
  };

  const planos = Object.entries(PLANOS_CONFIG).map(([key, config]) => ({ id: key as PlanoAssinatura, ...config }));
  const selectedPlanoConfig = selectedPlano ? PLANOS_CONFIG[selectedPlano] : null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
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
              <StatusBadge subscriptionStatus={subscriptionStatus} daysRemaining={daysRemaining} isTrialExpired={isTrialExpired} isSubscriptionActive={isSubscriptionActive} />
            </div>
          </CardHeader>
        </Card>

        {isTrialExpired && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                <div>
                  <h3 className="font-semibold text-destructive">Período de teste expirado</h3>
                  <p className="text-sm text-muted-foreground mt-1">Seu período de teste gratuito terminou. Escolha um plano abaixo.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {subscriptionStatus === 'trial' && !isTrialExpired && (
          <Card className="border-amber-500 bg-amber-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Clock className="h-6 w-6 text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-700">Período de teste ativo</h3>
                  <p className="text-sm text-muted-foreground mt-1">Você tem <strong>{daysRemaining} dias</strong> restantes no período de teste gratuito.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">Escolha seu plano</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {planos.map((plano) => (
              <PlanoCard key={plano.id} plano={plano} destaque={'destaque' in plano && plano.destaque} onAssinar={() => handleAssinar(plano.id)} />
            ))}
          </div>
        </div>

        {isSubscriptionActive && (
          <Card className="border-green-500 bg-green-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Check className="h-6 w-6 text-green-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-700">Assinatura ativa</h3>
                  <p className="text-sm text-muted-foreground mt-1">Você está no plano <strong>{subscriptionPlan || 'Profissional'}</strong>. Obrigado por ser nosso cliente!</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <PixPaymentModal open={modalOpen} onOpenChange={handleCloseModal} charge={charge} planoNome={selectedPlanoConfig?.nome || ''} isLoading={isLoading} error={error} />
      </div>
    </Layout>
  );
};

export default Assinatura;
