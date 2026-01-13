import { useState, useEffect } from 'react';
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
  const { organizationId, refreshOrganization } = useOrganization();
  const navigate = useNavigate();

  // Se já tem organização, não deveria estar aqui - redirecionar
  useEffect(() => {
    if (organizationId) {
      navigate('/');
    }
  }, [organizationId, navigate]);

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
          nome: nomeOrganizacao.trim()
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">Bem-vindo! 🎉</h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Para começar, escolha uma das opções abaixo
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Opção 1: Criar Organização */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all hover:border-blue-500 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              onClick={() => setModo('criar')}
            >
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-2xl text-gray-900 dark:text-gray-100">Criar Organização</CardTitle>
                </div>
                <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                  Crie sua própria organização e comece a gerenciar seu negócio imediatamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Você será o administrador
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Acesso completo ao sistema
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Convide membros da sua equipe
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Opção 2: Aguardar Convite */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all hover:border-blue-500 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              onClick={() => setModo('aguardar')}
            >
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-2xl text-gray-900 dark:text-gray-100">Aguardar Convite</CardTitle>
                </div>
                <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                  Já faz parte de uma organização? Aguarde o convite do administrador
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Peça ao administrador para convidá-lo
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Aguarde a vinculação à organização
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-2xl text-gray-900 dark:text-gray-100">Criar Organização</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-2xl text-gray-900 dark:text-gray-100">Aguardar Convite</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Você será adicionado em breve
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
            <p className="text-sm text-gray-900 dark:text-gray-100">
              <strong>Como funciona:</strong>
            </p>
            <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
              <li>Entre em contato com o administrador da sua organização</li>
              <li>Informe o email cadastrado: <strong className="text-gray-900 dark:text-gray-100">{user?.email}</strong></li>
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
