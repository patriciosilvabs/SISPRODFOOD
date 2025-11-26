import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { 
  Package, 
  ShoppingBag, 
  Store, 
  Factory, 
  BarChart3, 
  LogOut, 
  Menu,
  Settings,
  Search,
  LayoutDashboard,
  Trash2,
  FileText,
  Flag,
  Truck,
  ClipboardList,
  AlertTriangle,
  ShoppingCart,
  Clock
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { profile, signOut, isAdmin, hasRole } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const NavLink = ({ to, icon: Icon, children }: { to: string; icon: any; children: ReactNode }) => (
    <Link to={to}>
      <Button
        variant={isActive(to) ? 'default' : 'ghost'}
        className="w-full justify-start"
      >
        <Icon className="mr-2 h-4 w-4" />
        {children}
      </Button>
    </Link>
  );

  const navigation = (
    <nav className="space-y-2">
      <NavLink to="/" icon={BarChart3}>Dashboard</NavLink>
      
      {(isAdmin() || hasRole('Produção')) && (
        <>
          <NavLink to="/resumo-da-producao" icon={Search}>Resumo da Produção</NavLink>
          <NavLink to="/painel-kanban" icon={LayoutDashboard}>Painel Kanban</NavLink>
          <NavLink to="/estoque-diario" icon={Trash2}>Estoque Diário (Geral)</NavLink>
          <NavLink to="/atender-pedidos-diarios" icon={FileText}>Atender Pedidos Diários</NavLink>
          <NavLink to="/insumos" icon={Package}>Estoque de Insumos</NavLink>
          <NavLink to="/contagem-porcionados" icon={Flag}>Contagem Porcionados</NavLink>
          <NavLink to="/romaneio-porcionados" icon={Truck}>Romaneio Porcionados</NavLink>
          <NavLink to="/receber-porcionados" icon={ClipboardList}>Receber Porcionados</NavLink>
          <NavLink to="/erros-devolucoes" icon={AlertTriangle}>Erros e Devoluções</NavLink>
          <NavLink to="/lista-de-compras-ia" icon={ShoppingCart}>Lista de Compras IA</NavLink>
          <NavLink to="/itens-porcionados" icon={ShoppingBag}>Itens Porcionados</NavLink>
          <NavLink to="/producao" icon={Factory}>Produção</NavLink>
        </>
      )}
      
      {(isAdmin() || hasRole('Loja')) && (
        <NavLink to="/lojas" icon={Store}>Lojas</NavLink>
      )}
      
      <NavLink to="/central-de-relatorios" icon={Clock}>Central de Relatórios</NavLink>
      
      {isAdmin() && (
        <NavLink to="/configuracoes" icon={Settings}>Configurações</NavLink>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold">Menu</h2>
                  </div>
                  {navigation}
                </div>
              </SheetContent>
            </Sheet>
            
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold hidden sm:inline-block">Sistema de Estoque</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Olá,</span>
              <span className="font-medium">{profile?.nome}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-64 border-r min-h-[calc(100vh-4rem)] p-4">
          {navigation}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
