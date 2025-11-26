import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Insumos from "./pages/Insumos";
import ItensPorcionados from "./pages/ItensPorcionados";
import Producao from "./pages/Producao";
import Lojas from "./pages/Lojas";
import Configuracoes from "./pages/Configuracoes";
import GerenciarProdutos from "./pages/GerenciarProdutos";
import ResumoDaProducao from "./pages/ResumoDaProducao";
import PainelKanban from "./pages/PainelKanban";
import EstoqueDiario from "./pages/EstoqueDiario";
import AtenderPedidosDiarios from "./pages/AtenderPedidosDiarios";
import ContagemPorcionados from "./pages/ContagemPorcionados";
import RomaneioPorcionados from "./pages/RomaneioPorcionados";
import ReceberPorcionados from "./pages/ReceberPorcionados";
import ErrosDevolucoes from "./pages/ErrosDevolucoes";
import ListaDeComprasIA from "./pages/ListaDeComprasIA";
import CentralDeRelatorios from "./pages/CentralDeRelatorios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
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
              path="/estoque-diario"
              element={
                <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                  <EstoqueDiario />
                </ProtectedRoute>
              }
            />
            <Route
              path="/atender-pedidos-diarios"
              element={
                <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
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
              path="/contagem-porcionados"
              element={
                <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                  <ContagemPorcionados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/romaneio-porcionados"
              element={
                <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                  <RomaneioPorcionados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receber-porcionados"
              element={
                <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
                  <ReceberPorcionados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/erros-devolucoes"
              element={
                <ProtectedRoute requiredRoles={['Admin', 'Produção']}>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
