import { ReactNode } from 'react';
import { useUIPermissions } from '@/hooks/useUIPermissions';

interface UIGateProps {
  pagina: string;
  secao?: string;
  coluna?: string;
  acao?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Componente wrapper que renderiza children condicionalmente
 * baseado nas permissões de UI configuradas para a organização
 * 
 * @example
 * // Verificar seção
 * <UIGate pagina="contagem_porcionados" secao="header_resumo">
 *   <ResumoCard />
 * </UIGate>
 * 
 * // Verificar coluna
 * <UIGate pagina="contagem_porcionados" coluna="peso">
 *   <PesoInput />
 * </UIGate>
 * 
 * // Verificar ação
 * <UIGate pagina="contagem_porcionados" acao="salvar">
 *   <SaveButton />
 * </UIGate>
 */
export const UIGate = ({ 
  pagina, 
  secao, 
  coluna, 
  acao, 
  children, 
  fallback = null 
}: UIGateProps) => {
  const { isSecaoActive, isColunaActive, isAcaoActive, loading, isPageActive } = useUIPermissions(pagina);

  // Enquanto carrega, não renderiza nada
  if (loading) return null;

  // Verificar se página está ativa
  if (!isPageActive()) return <>{fallback}</>;

  // Verificar tipo de gate
  if (secao && !isSecaoActive(secao)) return <>{fallback}</>;
  if (coluna && !isColunaActive(coluna)) return <>{fallback}</>;
  if (acao && !isAcaoActive(acao)) return <>{fallback}</>;

  return <>{children}</>;
};

export default UIGate;
