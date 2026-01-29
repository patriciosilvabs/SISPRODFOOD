import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useUserLoja } from '@/hooks/useUserLoja';
import { usePageAccess } from '@/hooks/usePageAccess';
import { Button } from '@/components/ui/button';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Package, 
  BarChart3, 
  LogOut, 
  Menu,
  Settings,
  Truck,
  AlertTriangle,
  ShoppingCart,
  Clock,
  ArrowLeft,
  Factory,
  ClipboardList,
  Boxes,
  MapPin,
  Shield,
  Warehouse,
  Store,
  Sun,
  Moon
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from '@/components/ui/badge';
import { getProfileLabel } from '@/lib/page-access-config';
import { LembretesAudioPlayer } from '@/components/LembretesAudioPlayer';
import { ThemeToggle } from '@/components/ThemeToggle';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { profile, signOut, isSuperAdmin } = useAuth();
  const { subscriptionStatus, daysRemaining, isTrialExpired } = useSubscription();
  const { primaryLoja } = useUserLoja();
  const { hasPageAccess, profile: userProfile, loading: pageAccessLoading } = usePageAccess();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;
  const showBackButton = location.pathname !== '/';
  
  // Mostrar loja vinculada para usuários com perfil loja
  const isLojaUser = userProfile === 'loja';

  const NavLink = ({ to, icon: Icon, children }: { to: string; icon: any; children: ReactNode }) => (
    <Link to={to}>
      <Button
        variant={isActive(to) ? 'default' : 'ghost'}
        className="w-full justify-start"
        size="sm"
      >
        <Icon className="mr-2 h-4 w-4" />
        {children}
      </Button>
    </Link>
  );

  const SectionLabel = ({ children }: { children: ReactNode }) => (
    <div className="px-3 py-2 mt-4 first:mt-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
    </div>
  );

  // Verificações baseadas no novo sistema de perfis
  const canSeeDashboard = hasPageAccess('/');
  
  // CPD - Produção
  const canSeeProducao = hasPageAccess('/resumo-da-producao');
  const canSeeInsumos = hasPageAccess('/insumos');
  const canSeeEstoqueProdutosCPD = hasPageAccess('/estoque-produtos-cpd');
  const canSeeEstoquePorcionadosCPD = hasPageAccess('/estoque-porcionados-cpd');
  const canSeeReposicaoLoja = hasPageAccess('/reposicao-loja');
  const canSeeCPD = canSeeProducao || canSeeInsumos || canSeeEstoqueProdutosCPD || canSeeEstoquePorcionadosCPD || canSeeReposicaoLoja;
  
  // Loja
  const canSeeContagem = hasPageAccess('/contagem-porcionados');
  const canSeeEstoqueLoja = hasPageAccess('/estoque-loja');
  const canSeeErros = hasPageAccess('/erros-devolucoes');
  const canSeeLoja = canSeeContagem || canSeeEstoqueLoja || canSeeErros;
  
  // Logística
  const canSeeRomaneio = hasPageAccess('/romaneio');
  
  // Relatórios
  const canSeeCentralRelatorios = hasPageAccess('/central-de-relatorios');
  
  // Admin
  const canSeeCompras = hasPageAccess('/lista-de-compras-ia');
  const canSeeConfig = hasPageAccess('/configuracoes');
  const canSeeAdmin = canSeeCompras || canSeeConfig;

  const navigation = (
    <nav className="space-y-1">
      {/* GERAL */}
      {canSeeDashboard && (
        <>
          <SectionLabel>Geral</SectionLabel>
          <NavLink to="/" icon={BarChart3}>Dashboard</NavLink>
        </>
      )}
      
      {/* CPD - Centro de Produção */}
      {canSeeCPD && (
        <>
          <SectionLabel>CPD - Produção</SectionLabel>
          {canSeeProducao && (
            <NavLink to="/resumo-da-producao" icon={Factory}>Resumo da Produção</NavLink>
          )}
          {canSeeInsumos && (
            <NavLink to="/insumos" icon={Package}>Estoque de Insumos</NavLink>
          )}
          {canSeeEstoqueProdutosCPD && (
            <NavLink to="/estoque-produtos-cpd" icon={Warehouse}>Estoque de Produtos</NavLink>
          )}
          {canSeeEstoquePorcionadosCPD && (
            <NavLink to="/estoque-porcionados-cpd" icon={Boxes}>Estoque Porcionados</NavLink>
          )}
          {canSeeReposicaoLoja && (
            <NavLink to="/reposicao-loja" icon={Store}>Reposição de Lojas</NavLink>
          )}
        </>
      )}
      
      {/* LOJA */}
      {canSeeLoja && (
        <>
          <SectionLabel>Loja</SectionLabel>
          {canSeeContagem && (
            <NavLink to="/contagem-porcionados" icon={ClipboardList}>Contagem Porcionados</NavLink>
          )}
          {canSeeEstoqueLoja && (
            <NavLink to="/estoque-loja" icon={Boxes}>Meu Estoque</NavLink>
          )}
          {canSeeErros && (
            <NavLink to="/erros-devolucoes" icon={AlertTriangle}>Erros e Devoluções</NavLink>
          )}
        </>
      )}
      
      {/* LOGÍSTICA */}
      {canSeeRomaneio && (
        <>
          <SectionLabel>Logística</SectionLabel>
          <NavLink to="/romaneio" icon={Truck}>Romaneio</NavLink>
        </>
      )}
      
      {/* RELATÓRIOS */}
      {canSeeCentralRelatorios && (
        <>
          <SectionLabel>Relatórios</SectionLabel>
          <NavLink to="/central-de-relatorios" icon={Clock}>Central de Relatórios</NavLink>
        </>
      )}
      
      {/* ADMINISTRAÇÃO */}
      {canSeeAdmin && (
        <>
          <SectionLabel>Administração</SectionLabel>
          {canSeeCompras && (
            <NavLink to="/lista-de-compras-ia" icon={ShoppingCart}>Lista de Compras IA</NavLink>
          )}
          {canSeeConfig && (
            <NavLink to="/configuracoes" icon={Settings}>Configurações</NavLink>
          )}
        </>
      )}

      {/* SUPER ADMIN */}
      {isSuperAdmin() && (
        <>
          <SectionLabel>Super Admin</SectionLabel>
          <NavLink to="/super-admin" icon={Shield}>Painel Super Admin</NavLink>
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Banner de Trial */}
      {subscriptionStatus === 'trial' && !isTrialExpired && daysRemaining !== null && (
        <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-sm">
          <Clock className="inline h-4 w-4 mr-1 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-800 dark:text-amber-200">
            Período de teste: <strong>{daysRemaining} dias restantes</strong>
          </span>
          <Link 
            to="/assinatura" 
            className="ml-2 underline text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
          >
            Assinar agora
          </Link>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4">
                <div className="flex flex-col h-full">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold">Menu</h2>
                    {userProfile && !isSuperAdmin() && (
                      <Badge variant="outline" className="mt-1">
                        {getProfileLabel(userProfile)}
                      </Badge>
                    )}
                  </div>
                  {navigation}
                </div>
              </SheetContent>
            </Sheet>
            
            {showBackButton && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(-1)}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
            )}
            
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <Package className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm hidden sm:inline-block">Sistema de Estoque</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Badge da Loja Vinculada */}
            {isLojaUser && primaryLoja && (
              <Badge variant="secondary" className="hidden sm:flex items-center gap-1 bg-primary/10 text-primary border-primary/20">
                <MapPin className="h-3 w-3" />
                {primaryLoja.loja_nome}
              </Badge>
            )}
            
            {/* Badge do Perfil */}
            {userProfile && !isSuperAdmin() && (
              <Badge variant="outline" className="hidden sm:flex">
                {getProfileLabel(userProfile)}
              </Badge>
            )}
            
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Olá,</span>
              <span className="font-medium">{profile?.nome}</span>
            </div>
            
            {/* Toggle de Tema */}
            <ThemeToggle />
            
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Badge da Loja para Mobile */}
        {isLojaUser && primaryLoja && (
          <div className="sm:hidden border-t bg-primary/5 px-4 py-1.5 flex items-center justify-center gap-1 text-xs text-primary">
            <MapPin className="h-3 w-3" />
            <span className="font-medium">{primaryLoja.loja_nome}</span>
          </div>
        )}
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-56 border-r min-h-[calc(100vh-3.5rem)] p-3">
          {userProfile && !isSuperAdmin() && (
            <div className="mb-4 px-3">
              <Badge variant="outline" className="w-full justify-center">
                {getProfileLabel(userProfile)}
              </Badge>
            </div>
          )}
          {navigation}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Player de Lembretes de Áudio */}
      <LembretesAudioPlayer />
    </div>
  );
};
