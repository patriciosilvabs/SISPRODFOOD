import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Building2, 
  CreditCard, 
  Users, 
  Tag, 
  LogOut,
  Shield,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface SuperAdminLayoutProps {
  children: ReactNode;
  title?: string;
}

const menuItems = [
  { title: 'Dashboard', url: '/super-admin', icon: LayoutDashboard },
  { title: 'Organizações', url: '/super-admin/organizacoes', icon: Building2 },
  { title: 'Assinaturas', url: '/super-admin/assinaturas', icon: CreditCard },
  { title: 'Usuários', url: '/super-admin/usuarios', icon: Users },
  { title: 'Planos', url: '/super-admin/planos', icon: Tag },
];

export const SuperAdminLayout = ({ children, title }: SuperAdminLayoutProps) => {
  const { signOut, profile } = useAuth();
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r border-border">
          <SidebarContent>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Shield className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Super Admin</h2>
                  <p className="text-xs text-muted-foreground">Painel Administrativo</p>
                </div>
              </div>
            </div>

            {/* Menu */}
            <SidebarGroup>
              <SidebarGroupLabel>Navegação</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <Link
                            to={item.url}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                              isActive 
                                ? 'bg-destructive/10 text-destructive font-medium' 
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                            <span>{item.title}</span>
                            {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* User Info */}
            <div className="mt-auto p-4 border-t border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-destructive">
                    {profile?.nome?.charAt(0).toUpperCase() || 'S'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{profile?.nome || 'Super Admin'}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start gap-2"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-background">
            <SidebarTrigger />
            {title && (
              <h1 className="text-lg font-semibold">{title}</h1>
            )}
          </header>

          {/* Content */}
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
