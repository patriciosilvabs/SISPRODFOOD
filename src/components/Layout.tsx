import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useUserLoja } from '@/hooks/useUserLoja';
import { usePermissions } from '@/hooks/usePermissions';
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
  Warehouse
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from '@/components/ui/badge';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { profile, signOut, isAdmin, hasRole, isSuperAdmin } = useAuth();
  const { subscriptionStatus, daysRemaining, isTrialExpired } = useSubscription();
  const { primaryLoja } = useUserLoja();
  const { hasPermission, hasAnyPermission, loading: permissionsLoading } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;
  const showBackButton = location.pathname !== '/';
  
  // Mostrar loja vinculada para usuários com role Loja (não Admin/Produção)
  const isLojaUser = hasRole('Loja') && !isAdmin() && !hasRole('Produção');

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

  // Verificações baseadas em permissões granulares
  const canSeeDashboard = hasPermission('dashboard.view');
  const canSeeCPD = hasAnyPermission(['producao.resumo.view', 'producao.resumo.manage', 'insumos.view', 'insumos.manage', 'estoque_cpd_produtos.view', 'estoque_cpd_produtos.manage']);
  const canSeeProducao = hasAnyPermission(['producao.resumo.view', 'producao.resumo.manage']);
  const canSeeInsumos = hasAnyPermission(['insumos.view', 'insumos.manage']);
  const canSeeEstoqueProdutosCPD = hasAnyPermission(['estoque_cpd_produtos.view', 'estoque_cpd_produtos.manage']);
  const canSeeReposicaoLoja = hasAnyPermission(['reposicao_loja.view', 'reposicao_loja.enviar']);
  
  const canSeeLoja = hasAnyPermission(['contagem.view', 'contagem.manage', 'estoque_loja.view', 'estoque_loja.manage', 'erros.view', 'erros.create']);
  const canSeeContagem = hasAnyPermission(['contagem.view', 'contagem.manage']);
  const canSeeEstoqueLoja = hasAnyPermission(['estoque_loja.view', 'estoque_loja.manage']);
  const canSeeErros = hasAnyPermission(['erros.view', 'erros.create']);
  
  const canSeeLogistica = hasAnyPermission(['romaneio.view', 'romaneio.create', 'romaneio.send', 'romaneio.receive', 'romaneio.history']);
  
  const canSeeRelatorios = hasAnyPermission([
    'relatorios.producao', 'relatorios.romaneios', 'relatorios.estoque', 
    'relatorios.insumos', 'relatorios.consumo', 'relatorios.diagnostico'
  ]);
  
  const canSeeAdmin = hasAnyPermission([
    'config.view', 'config.insumos', 'config.itens', 'config.produtos', 
    'config.lojas', 'config.usuarios', 'config.sistema', 'compras.view', 'compras.manage'
  ]);
  const canSeeCompras = hasAnyPermission(['compras.view', 'compras.manage']);
  const canSeeConfig = hasAnyPermission([
    'config.view', 'config.insumos', 'config.itens', 'config.produtos', 
    'config.lojas', 'config.usuarios', 'config.sistema'
  ]);

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
      
      {/* LOGÍSTICA - Compartilhado entre CPD e Loja */}
      {canSeeLogistica && (
        <>
          <SectionLabel>Logística</SectionLabel>
          <NavLink to="/romaneio" icon={Truck}>Romaneio</NavLink>
        </>
      )}
      
      {/* RELATÓRIOS */}
      {canSeeRelatorios && (
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
            
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Olá,</span>
              <span className="font-medium">{profile?.nome}</span>
            </div>
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
          {navigation}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
