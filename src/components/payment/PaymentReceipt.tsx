import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WooviChargeResponse } from '@/types/payment';
import { Check, Clock, X, Receipt } from 'lucide-react';

interface PaymentReceiptProps {
  charge: WooviChargeResponse;
  planoNome: string;
}

export const PaymentReceipt = ({ charge, planoNome }: PaymentReceiptProps) => {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          label: 'Pago',
          icon: Check,
          variant: 'default' as const,
          className: 'bg-green-500',
        };
      case 'EXPIRED':
        return {
          label: 'Expirado',
          icon: X,
          variant: 'destructive' as const,
          className: '',
        };
      default:
        return {
          label: 'Aguardando',
          icon: Clock,
          variant: 'secondary' as const,
          className: 'bg-amber-500',
        };
    }
  };

  const statusConfig = getStatusConfig(charge.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Recibo de Pagamento
          </CardTitle>
          <Badge className={statusConfig.className} variant={statusConfig.variant}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Plano</span>
          <span className="font-medium">{planoNome}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-medium">{formatCurrency(charge.value)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">ID da Transação</span>
          <span className="font-mono text-xs">{charge.correlationID.slice(0, 8)}...</span>
        </div>
        {charge.expiresAt && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Validade</span>
            <span>{new Date(charge.expiresAt).toLocaleString('pt-BR')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
