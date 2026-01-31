// Configuração de páginas e perfis de acesso
// Perfis: 'admin' (is_admin=true), 'cpd' (vinculado a loja tipo CPD), 'loja' (vinculado a loja comum)

export type UserProfile = 'admin' | 'cpd' | 'loja';

export interface PageConfig {
  route: string;
  label: string;
  description: string;
  icon?: string;
  section: 'geral' | 'cpd' | 'loja' | 'logistica' | 'relatorios' | 'admin';
}

// Todas as páginas do sistema
export const SYSTEM_PAGES: PageConfig[] = [
  // GERAL
  { route: '/', label: 'Dashboard', description: 'Visão geral do sistema', section: 'geral' },
  
  // CPD - Produção
  { route: '/resumo-da-producao', label: 'Resumo da Produção', description: 'Kanban de produção', section: 'cpd' },
  { route: '/painel-kanban', label: 'Painel Kanban', description: 'Kanban visual', section: 'cpd' },
  { route: '/producao', label: 'Produção', description: 'Gestão de produção', section: 'cpd' },
  { route: '/atender-pedidos-diarios', label: 'Pedidos Diários', description: 'Atender pedidos', section: 'cpd' },
  { route: '/insumos', label: 'Estoque de Insumos', description: 'Gerenciar insumos', section: 'cpd' },
  { route: '/estoque-produtos-cpd', label: 'Estoque de Produtos CPD', description: 'Produtos no CPD', section: 'cpd' },
  { route: '/estoque-porcionados-cpd', label: 'Estoque Porcionados (CPD)', description: 'Ajuste de estoque porcionados', section: 'cpd' },
  { route: '/reposicao-loja', label: 'Reposição de Lojas', description: 'Enviar produtos para lojas', section: 'cpd' },
  
  // LOJA
  { route: '/contagem-porcionados', label: 'Contagem Porcionados', description: 'Contagem de itens', section: 'loja' },
  { route: '/receber-porcionados', label: 'Receber Porcionados', description: 'Receber itens', section: 'loja' },
  { route: '/estoque-loja', label: 'Meu Estoque', description: 'Estoque da loja', section: 'loja' },
  { route: '/erros-devolucoes', label: 'Erros e Devoluções', description: 'Registrar ocorrências', section: 'loja' },
  
  // LOGÍSTICA (compartilhado)
  { route: '/romaneio', label: 'Romaneio', description: 'Envio e recebimento', section: 'logistica' },
  
  // RELATÓRIOS
  { route: '/central-de-relatorios', label: 'Central de Relatórios', description: 'Todos os relatórios', section: 'relatorios' },
  { route: '/relatorios/producao', label: 'Relatório de Produção', description: 'Histórico de produção', section: 'relatorios' },
  { route: '/relatorios/romaneios', label: 'Relatório de Romaneios', description: 'Histórico de romaneios', section: 'relatorios' },
  { route: '/relatorios/estoque-produtos', label: 'Relatório de Estoque', description: 'Status de estoque', section: 'relatorios' },
  { route: '/relatorios/insumos', label: 'Relatório de Insumos', description: 'Consumo de insumos', section: 'relatorios' },
  { route: '/relatorios/monitoramento-consumo', label: 'Monitoramento de Consumo', description: 'Análise de consumo', section: 'relatorios' },
  { route: '/relatorios/diagnostico-estoque', label: 'Diagnóstico de Estoque', description: 'Análise de estoque', section: 'relatorios' },
  { route: '/relatorios/consumo-historico', label: 'Consumo Histórico', description: 'Histórico de consumo', section: 'relatorios' },
  { route: '/relatorios/dashboard-consumo', label: 'Dashboard Consumo', description: 'Análise de consumo', section: 'relatorios' },
  { route: '/relatorios/movimentacoes', label: 'Histórico Movimentações', description: 'Log de movimentações', section: 'relatorios' },
  
  // ADMINISTRAÇÃO
  { route: '/lista-de-compras-ia', label: 'Lista de Compras IA', description: 'Sugestões de compras', section: 'admin' },
  { route: '/configuracoes', label: 'Configurações', description: 'Configurar sistema', section: 'admin' },
  { route: '/gerenciar-usuarios', label: 'Gerenciar Usuários', description: 'Usuários e permissões', section: 'admin' },
  { route: '/gerenciar-produtos', label: 'Gerenciar Produtos', description: 'Cadastro de produtos', section: 'admin' },
  { route: '/itens-porcionados', label: 'Itens Porcionados', description: 'Cadastro de itens', section: 'admin' },
  { route: '/lojas', label: 'Gerenciar Lojas', description: 'Cadastro de lojas', section: 'admin' },
  { route: '/configurar-lembretes-audio', label: 'Lembretes de Áudio', description: 'Configurar lembretes sonoros', section: 'admin' },
  { route: '/configurar-integracao-pdv', label: 'Integração PDV', description: 'Configurar integração com PDV externo', section: 'admin' },
  { route: '/demanda-pdv', label: 'Demanda PDV', description: 'Visualizar demanda do PDV', section: 'cpd' },
];

// Páginas default por perfil
export const PROFILE_DEFAULT_PAGES: Record<UserProfile, string[]> = {
  admin: SYSTEM_PAGES.map(p => p.route), // Admin tem acesso a tudo por padrão
  cpd: [
    '/',
    '/resumo-da-producao',
    '/insumos',
    '/estoque-produtos-cpd',
    '/reposicao-loja',
    '/estoque-porcionados-cpd',
    '/romaneio',
    '/central-de-relatorios',
    '/relatorios/producao',
    '/relatorios/romaneios',
    '/relatorios/estoque-produtos',
    '/relatorios/insumos',
    '/relatorios/monitoramento-consumo',
    '/relatorios/diagnostico-estoque',
    '/relatorios/consumo-historico',
  ],
  loja: [
    '/',
    '/contagem-porcionados',
    '/estoque-loja',
    '/erros-devolucoes',
    '/romaneio',
  ],
};

// Páginas agrupadas por seção para exibição
export const PAGE_SECTIONS = {
  geral: { label: 'Geral', pages: SYSTEM_PAGES.filter(p => p.section === 'geral') },
  cpd: { label: 'CPD - Produção', pages: SYSTEM_PAGES.filter(p => p.section === 'cpd') },
  loja: { label: 'Loja', pages: SYSTEM_PAGES.filter(p => p.section === 'loja') },
  logistica: { label: 'Logística', pages: SYSTEM_PAGES.filter(p => p.section === 'logistica') },
  relatorios: { label: 'Relatórios', pages: SYSTEM_PAGES.filter(p => p.section === 'relatorios') },
  admin: { label: 'Administração', pages: SYSTEM_PAGES.filter(p => p.section === 'admin') },
};

export const getPageByRoute = (route: string): PageConfig | undefined => {
  return SYSTEM_PAGES.find(p => p.route === route);
};

export const getProfileLabel = (profile: UserProfile): string => {
  const labels: Record<UserProfile, string> = {
    admin: 'Administrador',
    cpd: 'Operador CPD',
    loja: 'Operador Loja',
  };
  return labels[profile];
};
