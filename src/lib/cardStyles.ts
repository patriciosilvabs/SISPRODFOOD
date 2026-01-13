// Padrão de cores neutras para cards - Sistema de Design
// Usa apenas cores neutras com bordas coloridas sutis para indicar estados

export const cardStyles = {
  // Estados base - background neutro com borda colorida
  success: 'bg-gray-50 dark:bg-gray-800/50 border-l-4 border-l-emerald-400 dark:border-l-emerald-500',
  warning: 'bg-gray-50 dark:bg-gray-800/50 border-l-4 border-l-amber-400 dark:border-l-amber-500',
  error: 'bg-gray-50 dark:bg-gray-800/50 border-l-4 border-l-red-400 dark:border-l-red-500',
  info: 'bg-gray-50 dark:bg-gray-800/50 border-l-4 border-l-blue-400 dark:border-l-blue-500',
  neutral: 'bg-white dark:bg-gray-900 border-l-4 border-l-gray-300 dark:border-l-gray-600',
  
  // Cards padrão (sem borda lateral colorida)
  default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
  elevated: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-md',
  
  // Badges neutros com cores sutis
  badge: {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    error: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    info: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    neutral: 'bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
  },
  
  // Texto - sempre legível
  text: {
    primary: 'text-gray-900 dark:text-gray-100',
    secondary: 'text-gray-600 dark:text-gray-400',
    muted: 'text-gray-500 dark:text-gray-500',
  },
  
  // Indicadores de status (para números, ícones)
  indicator: {
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
  }
};

// Helper para aplicar estilos de card com estado
export const getCardStateClass = (
  state: 'success' | 'warning' | 'error' | 'info' | 'neutral' | null
) => {
  if (!state) return cardStyles.default;
  return cardStyles[state];
};
