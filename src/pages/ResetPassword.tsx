import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Lock, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // Verificar se há um hash de recuperação na URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    if (type !== 'recovery') {
      toast({
        title: "Link inválido",
        description: "Este link de recuperação é inválido ou expirou.",
        variant: "destructive",
      });
      navigate('/auth');
    }
  }, [navigate, toast]);

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        // Tratar erro específico de senha igual à anterior
        if (error.message.toLowerCase().includes('same password') || (error as any).code === 'same_password') {
          toast({
            title: "Senha inválida",
            description: "A nova senha deve ser diferente da senha atual.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Senha redefinida!",
        description: "Sua senha foi alterada com sucesso. Faça login com a nova senha.",
      });

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-accent/5 to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-2">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Redefinir Senha</CardTitle>
          <CardDescription>Digite sua nova senha abaixo</CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleResetPassword)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Redefinindo...' : 'Redefinir Senha'}
              </Button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Voltar para o login
                </button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
