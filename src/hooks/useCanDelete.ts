import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para verificar se o usuário atual tem permissão para excluir itens.
 * Apenas Administradores (Admin) e SuperAdmins podem excluir dados.
 */
export const useCanDelete = () => {
  const { isAdmin, isSuperAdmin } = useAuth();
  
  // Pode excluir se for Admin ou SuperAdmin
  const canDelete = isAdmin() || isSuperAdmin();
  
  return { canDelete };
};
