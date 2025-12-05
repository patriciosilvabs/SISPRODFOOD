import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function AceitarConvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { refreshOrganization } = useOrganization();
  
  const [status, setStatus] = useState<'loading' | 'checking' | 'accepting' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de convite inválido ou ausente');
      return;
    }

    checkAuthAndProcessInvite();
  }, [token]);

  const checkAuthAndProcessInvite = async () => {
    setStatus('checking');
    
    try {
      // Check if user is logged in (they should be after setting password via invite email)
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // User is not logged in - this shouldn't happen if they came from invite email
        // But if it does, show an error message
        setStatus('error');
        setMessage('Você precisa estar logado para aceitar o convite. Por favor, use o link enviado no email de convite para definir sua senha.');
        return;
      }

      // User is logged in, process the invite
      await processInvite();
    } catch (error: any) {
      console.error('Error checking auth:', error);
      setStatus('error');
      setMessage(error.message || 'Erro ao processar convite');
    }
  };

  const processInvite = async () => {
    setStatus('accepting');
    
    try {
      const { data, error } = await supabase.functions.invoke('aceitar-convite', {
        body: { token },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao aceitar convite');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setStatus('success');
      setMessage(data.message || 'Convite aceito com sucesso!');
      toast.success(data.message || 'Convite aceito com sucesso!');

      // Limpar token pendente do localStorage
      localStorage.removeItem('pendingInviteToken');

      // Atualizar contexto da organização ANTES de redirecionar
      await refreshOrganization();

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      setStatus('error');
      setMessage(error.message || 'Erro ao aceitar convite');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Convite de Funcionário</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Carregando...'}
            {status === 'checking' && 'Verificando convite...'}
            {status === 'accepting' && 'Processando convite...'}
            {status === 'success' && 'Convite aceito!'}
            {status === 'error' && 'Erro no convite'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {(status === 'loading' || status === 'checking' || status === 'accepting') && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-center text-muted-foreground">{message}</p>
              <p className="text-sm text-muted-foreground">Redirecionando para o sistema...</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-muted-foreground">{message}</p>
              <Button onClick={() => navigate('/auth')} variant="outline">
                Ir para Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
