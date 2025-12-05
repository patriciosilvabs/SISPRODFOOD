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

const Assinatura = () => {
  const { organizationName, organizationId } = useOrganization();
  const { subscriptionStatus, daysRemaining, isTrialExpired, isSubscriptionActive, subscriptionPlan } = useSubscription();
  const { isLoading, error, charge, createCharge, reset } = useWooviPayment();
  const [selectedPlano, setSelectedPlano] = useState<PlanoAssinatura | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const getStatusBadge = () => {
    if (isSubscriptionActive) return <Badge className="bg-green-500">Ativo</Badge>;
    if (isTrialExpired) return <Badge variant="destructive">Trial Expirado</Badge>;
    if (subscriptionStatus === 'trial') return <Badge className="bg-amber-500">Trial - {daysRemaining} dias restantes</Badge>;
    if (subscriptionStatus === 'pending_payment') return <Badge className="bg-yellow-500">Pagamento Pendente</Badge>;
    return <Badge variant="secondary">{subscriptionStatus}</Badge>;
  };

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

  const planos = Object.entries(PLANOS_CONFIG).map(([key, config]) => ({
    id: key as PlanoAssinatura,
    ...config,
  }));

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
              {getStatusBadge()}
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
                  <p className="text-sm text-muted-foreground mt-1">
                    Seu período de teste gratuito terminou. Escolha um plano abaixo para continuar usando o sistema.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}