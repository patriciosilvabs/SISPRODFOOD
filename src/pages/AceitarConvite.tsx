import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, Lock } from 'lucide-react';

export default function AceitarConvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { refreshOrganization } = useOrganization();
  
  const [status, setStatus] = useState<'loading' | 'form' | 'processing' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [inviteInfo, setInviteInfo] = useState<{ email: string; organizationName: string } | null>(null);
  
  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de convite inválido ou ausente');
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Validate token by calling edge function without password (just to get invite info)
      const { data, error } = await supabase.functions.invoke('aceitar-convite', {
        body: { token, action: 'validate' },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao validar convite');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Token is valid, show form
      setInviteInfo({
        email: data.email,
        organizationName: data.organizationName,
      });
      setStatus('form');
    } catch (error: any) {
      console.error('Error validating token:', error);
      setStatus('error');
      setMessage(error.message || 'Convite inválido ou expirado');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setStatus('processing');

    try {
      // Accept invite with new password
      const { data, error } = await supabase.functions.invoke('aceitar-convite', {
        body: { token, action: 'accept', password },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao aceitar convite');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Login with the new credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteInfo!.email,
        password: password,
      });

      if (signInError) {
        throw new Error('Convite aceito, mas houve erro ao fazer login. Tente fazer login manualmente.');
      }

      setStatus('success');
      setMessage(data.message || 'Convite aceito com sucesso!');
      toast.success('Bem-vindo! Convite aceito com sucesso.');

      // Clear pending invite token
      localStorage.removeItem('pendingInviteToken');

      // Refresh organization context
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
          <CardTitle className="flex items-center justify-center gap-2">
            <Lock className="h-5 w-5" />
            Convite de Funcionário
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Validando convite...'}
            {status === 'form' && `Você foi convidado para ${inviteInfo?.organizationName}`}
            {status === 'processing' && 'Processando...'}
            {status === 'success' && 'Convite aceito!'}
            {status === 'error' && 'Erro no convite'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === 'loading' && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}

          {status === 'form' && inviteInfo && (
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Você está entrando como:</p>
                <p className="font-medium">{inviteInfo.email}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Defina sua senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirme sua senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite a senha novamente"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full">
                Aceitar Convite e Entrar
              </Button>
            </form>
          )}

          {status === 'processing' && (
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
