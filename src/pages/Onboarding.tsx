import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, UserPlus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Onboarding() {
  const [modo, setModo] = useState<'escolha' | 'criar' | 'aguardar'>('escolha');
  const [nomeOrganizacao, setNomeOrganizacao] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { refreshOrganization } = useOrganization();
  const navigate = useNavigate();

  const handleCriarOrganizacao = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (nomeOrganizacao.trim().length < 3) {
      toast.error('Nome da organização deve ter pelo menos 3 caracteres');
      return;
    }

    if (nomeOrganizacao.trim().length > 100) {
      toast.error('Nome da organização deve ter no máximo 100 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('criar-organizacao', {
        body: {
          nome: nomeOrganizacao.trim(),
          userId: user.id
        }
      });

      if (error) {
        console.error('Erro ao criar organização:', error);
        toast.error('Erro ao criar organização. Tente novamente.');
        return;
      }

      if (!data.success) {
        toast.error(data.error || 'Erro ao criar organização');
        return;
      }

      toast.success('Organização criada com sucesso!');
      
      // Recarregar dados da organização
      await refreshOrganization();
      
      // Redirecionar para dashboard
      navigate('/');
    } catch (error) {
      console.error('Erro ao criar organização:', error);
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (modo === 'escolha') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Bem-vindo! 🎉</h1>
            <p className="text-muted-foreground text-lg">
              Para começar, escolha uma das opções abaixo
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Opção 1: Criar Organização */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all hover:border-primary"
              onClick={() => setModo('criar')}
            >
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Criar Organização</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Crie sua própria organização e comece a gerenciar seu negócio imediatamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Você será o administrador
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Acesso completo ao sistema
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Convide membros da sua equipe
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Opção 2: Aguardar Convite */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all hover:border-primary"
              onClick={() => setModo('aguardar')}
            >
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <UserPlus className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Aguardar Convite</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Já faz parte de uma organização? Aguarde o convite do administrador
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Peça ao administrador para convidá-lo
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Aguarde a vinculação à organização
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Acesso será liberado após aprovação
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (modo === 'criar') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Criar Organização</CardTitle>
                <CardDescription>
                  Digite o nome da sua organização
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Organização *</Label>
              <Input
                id="nome"
                placeholder="Ex: Padaria Central"
                value={nomeOrganizacao}
                onChange={(e) => setNomeOrganizacao(e.target.value)}
                disabled={loading}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 3 caracteres, máximo 100 caracteres
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setModo('escolha');
                  setNomeOrganizacao('');
                }}
                disabled={loading}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={handleCriarOrganizacao}
                disabled={loading || nomeOrganizacao.trim().length < 3}
                className="flex-1"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Organização
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // modo === 'aguardar'
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Aguardar Convite</CardTitle>
              <CardDescription>
                Você será adicionado em breve
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <p className="text-sm">
              <strong>Como funciona:</strong>
            </p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Entre em contato com o administrador da sua organização</li>
              <li>Informe o email cadastrado: <strong className="text-foreground">{user?.email}</strong></li>
              <li>O administrador irá vinculá-lo à organização</li>
              <li>Após a vinculação, você terá acesso ao sistema</li>
            </ol>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => setModo('escolha')}
              className="w-full"
            >
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
