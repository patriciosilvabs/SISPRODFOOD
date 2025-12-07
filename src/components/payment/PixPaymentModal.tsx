import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WooviChargeResponse } from '@/types/payment';
import { Copy, Check, Clock, QrCode, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PixPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge: WooviChargeResponse | null;
  planoNome: string;
  isLoading?: boolean;
  error?: string | null;
  paymentStatus: 'pending' | 'paid' | 'expired';
  onCheckStatus: () => Promise<void>;
  onPaymentConfirmed?: () => void;
  organizationId?: string;
}

export const PixPaymentModal = ({
  open,
  onOpenChange,
  charge,
  planoNome,
  isLoading,
  error,
  paymentStatus,
  onCheckStatus,
  onPaymentConfirmed,
}: PixPaymentModalProps) => {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 minutos
  const [isChecking, setIsChecking] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Timer de expiração
  useEffect(() => {
    if (!charge?.expiresAt) {
      setTimeLeft(900);
      return;
    }

    const expiresAt = new Date(charge.expiresAt).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [charge?.expiresAt]);

  // Polling para verificar status do pagamento
  useEffect(() => {
    if (!open || !charge || paymentStatus !== 'pending' || timeLeft <= 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Verificar a cada 3 segundos para resposta mais rápida
    pollingRef.current = setInterval(async () => {
      setIsChecking(true);
      await onCheckStatus();
      setIsChecking(false);
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [open, charge, paymentStatus, timeLeft, onCheckStatus]);

  // Quando pagamento for confirmado
  useEffect(() => {
    if (paymentStatus === 'paid') {
      toast.success('🎉 Pagamento confirmado! Bem-vindo ao SimChef!');
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      // Delay maior para celebrar o sucesso antes de redirecionar
      setTimeout(() => {
        onPaymentConfirmed?.();
      }, 3000);
    }
  }, [paymentStatus, onPaymentConfirmed]);

  const handleCopyCode = async () => {
    if (!charge?.brCode) return;

    try {
      await navigator.clipboard.writeText(charge.brCode);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar código');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    await onCheckStatus();
    setIsChecking(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Pagamento PIX
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code ou copie o código para pagar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">Gerando QR Code...</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {/* Status de pagamento confirmado */}
          {paymentStatus === 'paid' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-in zoom-in duration-300">
              <div className="rounded-full bg-green-100 p-6 animate-bounce">
                <CheckCircle className="h-20 w-20 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-green-600">🎉 Pagamento Confirmado!</h3>
                <p className="text-muted-foreground">Sua assinatura do plano {planoNome} foi ativada.</p>
                <p className="text-sm text-muted-foreground">Redirecionando para o sistema...</p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                  <span className="text-green-600 font-medium">Preparando seu acesso...</span>
                </div>
              </div>
            </div>
          )}

          {/* Status expirado */}
          {paymentStatus === 'expired' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="rounded-full bg-orange-100 p-4">
                <AlertCircle className="h-16 w-16 text-orange-600" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-orange-600">PIX Expirado</h3>
                <p className="text-muted-foreground mt-1">O código PIX expirou. Por favor, gere um novo.</p>
              </div>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          )}

          {charge && !isLoading && paymentStatus === 'pending' && (
            <>
              {/* Plano e Valor */}
              <div className="text-center border-b pb-4">
                <p className="text-sm text-muted-foreground">Plano {planoNome}</p>
                <p className="text-2xl font-bold">{formatCurrency(charge.value)}</p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                {charge.qrCodeImage ? (
                  <img
                    src={charge.qrCodeImage}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-lg border"
                  />
                ) : (
                  <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                    <QrCode className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Timer e Status de verificação */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className={timeLeft < 60 ? 'text-destructive font-medium' : ''}>
                    Expira em {formatTime(timeLeft)}
                  </span>
                </div>
                
                {/* Indicador de verificação */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {isChecking ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Verificando pagamento...</span>
                    </>
                  ) : (
                    <span>Verificação automática ativa</span>
                  )}
                </div>
              </div>

              {/* Código PIX */}
              {charge.brCode && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Código PIX Copia e Cola:</p>
                  <div className="relative">
                    <div className="bg-muted p-3 rounded-lg text-xs font-mono break-all max-h-20 overflow-y-auto">
                      {charge.brCode}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={handleCopyCode}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Botão verificar manualmente */}
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleManualCheck}
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Já paguei, verificar
                  </>
                )}
              </Button>

              {/* ID da Cobrança */}
              <p className="text-xs text-muted-foreground text-center">
                ID: {charge.correlationID}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
