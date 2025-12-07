import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Assinatura from "./pages/Assinatura";
import Insumos from "./pages/Insumos";
import ItensPorcionados from "./pages/ItensPorcionados";
import Producao from "./pages/Producao";
import Lojas from "./pages/Lojas";
import Configuracoes from "./pages/Configuracoes";
import GerenciarProdutos from "./pages/GerenciarProdutos";
import EstoqueProdutosCPD from "./pages/EstoqueProdutosCPD";
// ConfigurarInterface foi removido - sistema simplificado para perfis
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import ResumoDaProducao from "./pages/ResumoDaProducao";
import PainelKanban from "./pages/PainelKanban";
import EstoqueLoja from "./pages/EstoqueLoja";
import ReposicaoLoja from "./pages/ReposicaoLoja";
import AtenderPedidosDiarios from "./pages/AtenderPedidosDiarios";
import ContagemPorcionados from "./pages/ContagemPorcionados";
import Romaneio from "./pages/Romaneio";
import ReceberPorcionados from "./pages/ReceberPorcionados";
import ErrosDevolucoes from "./pages/ErrosDevolucoes";
import ListaDeComprasIA from "./pages/ListaDeComprasIA";
import CentralDeRelatorios from "./pages/CentralDeRelatorios";
import MonitoramentoConsumo from "./pages/relatorios/MonitoramentoConsumo";
import RelatorioProducao from "./pages/relatorios/RelatorioProducao";
import RelatorioRomaneios from "./pages/relatorios/RelatorioRomaneios";
import RelatorioEstoqueProdutos from "./pages/relatorios/RelatorioEstoqueProdutos";
import RelatorioInsumos from "./pages/relatorios/RelatorioInsumos";
import DiagnosticoEstoque from "./pages/relatorios/DiagnosticoEstoque";
import RelatorioConsumoHistorico from "./pages/relatorios/RelatorioConsumoHistorico";
import NotFound from "./pages/NotFound";
import AceitarConvite from "./pages/AceitarConvite";
import {
  SuperAdminDashboard,
  SuperAdminOrganizacoes,
  SuperAdminAssinaturas,
  SuperAdminUsuarios,
  SuperAdminPlanos,
} from "./pages/super-admin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <SubscriptionProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/aceitar-convite" element={<AceitarConvite />} />
          <Route
            path="/assinatura"
            element={
              <ProtectedRoute requiredRoles={['Admin']}>
                <Assinatura />
              </ProtectedRoute>
            }
          />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/resumo-da-producao"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                      <ResumoDaProducao />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/painel-kanban"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                      <PainelKanban />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/estoque-loja"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção', 'Loja']}>
                      <EstoqueLoja />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reposicao-loja"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                      <ReposicaoLoja />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/atender-pedidos-diarios"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção', 'Loja']}>
                      <AtenderPedidosDiarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/insumos"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                      <Insumos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/estoque-produtos-cpd"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                      <EstoqueProdutosCPD />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/contagem-porcionados"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção', 'Loja']}>
                      <ContagemPorcionados />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/romaneio"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção', 'Loja']}>
                      <Romaneio />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/receber-porcionados"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção', 'Loja']}>
                      <ReceberPorcionados />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/erros-devolucoes"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção', 'Loja']}>
                      <ErrosDevolucoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lista-de-compras-ia"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                      <ListaDeComprasIA />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/itens-porcionados"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                      <ItensPorcionados />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/producao"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                      <Producao />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lojas"
                  element={
                    <ProtectedRoute requiredRoles={['Admin', 'Loja']}>
                      <Lojas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/gerenciar-usuarios"
                  element={
                    <ProtectedRoute requiredRoles={['Admin']}>
                      <GerenciarUsuarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/central-de-relatorios"
                  element={
                    <ProtectedRoute>
                      <CentralDeRelatorios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracoes"
                  element={
                    <ProtectedRoute requiredRoles={['Admin']}>
                      <Configuracoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/gerenciar-produtos"
                  element={
                    <ProtectedRoute requiredRoles={['Admin']}>
                      <GerenciarProdutos />
                    </ProtectedRoute>
                  }
                />
                {/* Rota /configurar-interface removida - sistema simplificado */}
                <Route
                  path="/relatorios/monitoramento-consumo"
                  element={
                    <ProtectedRoute>
                      <MonitoramentoConsumo />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorios/producao"
                  element={
                    <ProtectedRoute>
                      <RelatorioProducao />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorios/romaneios"
                  element={
                    <ProtectedRoute>
                      <RelatorioRomaneios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorios/estoque-produtos"
                  element={
                    <ProtectedRoute>
                      <RelatorioEstoqueProdutos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorios/insumos"
                  element={
                    <ProtectedRoute>
                      <RelatorioInsumos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorios/diagnostico-estoque"
                  element={
                    <ProtectedRoute>
                      <DiagnosticoEstoque />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorios/consumo-historico"
                  element={
                    <ProtectedRoute>
                      <RelatorioConsumoHistorico />
                    </ProtectedRoute>
                  }
                />
                {/* Super Admin Routes */}
                <Route
                  path="/super-admin"
                  element={
                    <ProtectedRoute requiredRoles={['SuperAdmin']}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/organizacoes"
                  element={
                    <ProtectedRoute requiredRoles={['SuperAdmin']}>
                      <SuperAdminOrganizacoes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/assinaturas"
                  element={
                    <ProtectedRoute requiredRoles={['SuperAdmin']}>
                      <SuperAdminAssinaturas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/usuarios"
                  element={
                    <ProtectedRoute requiredRoles={['SuperAdmin']}>
                      <SuperAdminUsuarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/planos"
                  element={
                    <ProtectedRoute requiredRoles={['SuperAdmin']}>
                      <SuperAdminPlanos />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SubscriptionProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
