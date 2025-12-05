import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';

export default function AceitarConvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'checking' | 'accepting' | 'success' | 'error' | 'need-auth'>('loading');
  const [message, setMessage] = useState('');
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);

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
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // User needs to login/register first
        // Try to get invite info to show email
        const { data: invite } = await supabase
          .from('convites_pendentes')
          .select('email')
          .eq('token', token)
          .eq('status', 'pendente')
          .single();
        
        if (invite) {
          setInviteEmail(invite.email);
        }
        
        setStatus('need-auth');
        setMessage('Você precisa fazer login ou criar uma conta para aceitar o convite');
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

  const handleLoginRedirect = () => {
    // Store the invite token to process after login
    localStorage.setItem('pendingInviteToken', token || '');
    navigate('/auth');
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
            {status === 'need-auth' && 'Autenticação necessária'}
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
              <Button onClick={() => navigate('/')} variant="outline">
                Voltar ao Início
              </Button>
            </>
          )}
          
          {status === 'need-auth' && (
            <>
              <Mail className="h-12 w-12 text-primary" />
              <p className="text-center text-muted-foreground">{message}</p>
              {inviteEmail && (
                <div className="bg-primary/10 border border-primary/20 px-4 py-3 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">Este convite é para:</p>
                  <p className="font-semibold text-primary text-lg">{inviteEmail}</p>
                </div>
              )}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
                  <strong>Importante:</strong> Use o mesmo email acima ao criar sua conta ou fazer login.
                </p>
              </div>
              <Button onClick={handleLoginRedirect} className="w-full">
                Fazer Login / Criar Conta
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
