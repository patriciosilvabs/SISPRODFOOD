// Configuração centralizada de todas as permissões do sistema

export interface Permission {
  key: string;
  label: string;
  description: string;
  section: string;
  dependsOn?: string[]; // Permissões que são automaticamente concedidas junto
}

export interface PermissionSection {
  key: string;
  label: string;
  description: string;
  permissions: Permission[];
}

// Definição de todas as permissões do sistema
export const PERMISSIONS_CONFIG: PermissionSection[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral e métricas do sistema',
    permissions: [
      {
        key: 'dashboard.view',
        label: 'Visualizar Dashboard',
        description: 'Acessar a página inicial com métricas e resumos',
        section: 'dashboard'
      }
    ]
  },
  {
    key: 'producao',
    label: 'Produção (CPD)',
    description: 'Gestão da produção e kanban',
    permissions: [
      {
        key: 'producao.resumo.view',
        label: 'Visualizar Resumo da Produção',
        description: 'Ver o painel Kanban de produção',
        section: 'producao'
      },
      {
        key: 'producao.resumo.manage',
        label: 'Gerenciar Produção',
        description: 'Mover cards, iniciar preparo, finalizar produção',
        section: 'producao',
        dependsOn: ['producao.resumo.view']
      }
    ]
  },
  {
    key: 'insumos',
    label: 'Estoque de Insumos',
    description: 'Gestão de matérias-primas',
    permissions: [
      {
        key: 'insumos.view',
        label: 'Visualizar Insumos',
        description: 'Ver estoque de insumos e movimentações',
        section: 'insumos'
      },
      {
        key: 'insumos.manage',
        label: 'Gerenciar Insumos',
        description: 'Registrar entradas, saídas e ajustes',
        section: 'insumos',
        dependsOn: ['insumos.view']
      }
    ]
  },
  {
    key: 'estoque_cpd_produtos',
    label: 'Estoque de Produtos (CPD)',
    description: 'Gestão do estoque central de produtos',
    permissions: [
      {
        key: 'estoque_cpd_produtos.view',
        label: 'Visualizar Estoque de Produtos',
        description: 'Ver estoque central de produtos no CPD',
        section: 'estoque_cpd_produtos'
      },
      {
        key: 'estoque_cpd_produtos.manage',
        label: 'Gerenciar Estoque de Produtos',
        description: 'Registrar entradas, saídas e ajustes de produtos',
        section: 'estoque_cpd_produtos',
        dependsOn: ['estoque_cpd_produtos.view']
      }
    ]
  },
  {
    key: 'contagem',
    label: 'Contagem de Porcionados',
    description: 'Contagem diária de itens porcionados',
    permissions: [
      {
        key: 'contagem.view',
        label: 'Visualizar Contagens',
        description: 'Ver contagens existentes',
        section: 'contagem'
      },
      {
        key: 'contagem.manage',
        label: 'Registrar Contagens',
        description: 'Inserir e editar contagens de porcionados',
        section: 'contagem',
        dependsOn: ['contagem.view']
      }
    ]
  },
  {
    key: 'estoque_loja',
    label: 'Estoque da Loja',
    description: 'Gestão do estoque de produtos da loja',
    permissions: [
      {
        key: 'estoque_loja.view',
        label: 'Visualizar Estoque',
        description: 'Ver estoque de produtos da loja',
        section: 'estoque_loja'
      },
      {
        key: 'estoque_loja.manage',
        label: 'Gerenciar Estoque',
        description: 'Registrar contagens e solicitar reposição',
        section: 'estoque_loja',
        dependsOn: ['estoque_loja.view']
      }
    ]
  },
  {
    key: 'romaneio',
    label: 'Romaneio / Logística',
    description: 'Gestão de romaneios e entregas',
    permissions: [
      {
        key: 'romaneio.view',
        label: 'Visualizar Romaneios',
        description: 'Ver romaneios existentes',
        section: 'romaneio'
      },
      {
        key: 'romaneio.create',
        label: 'Criar Romaneios',
        description: 'Criar novos romaneios de entrega',
        section: 'romaneio',
        dependsOn: ['romaneio.view']
      },
      {
        key: 'romaneio.send',
        label: 'Enviar Romaneios',
        description: 'Confirmar envio de romaneios para lojas',
        section: 'romaneio',
        dependsOn: ['romaneio.view']
      },
      {
        key: 'romaneio.receive',
        label: 'Receber Romaneios',
        description: 'Confirmar recebimento de romaneios na loja',
        section: 'romaneio',
        dependsOn: ['romaneio.view']
      },
      {
        key: 'romaneio.history',
        label: 'Ver Histórico',
        description: 'Acessar histórico completo de romaneios',
        section: 'romaneio',
        dependsOn: ['romaneio.view']
      }
    ]
  },
  {
    key: 'erros',
    label: 'Erros e Devoluções',
    description: 'Registro de ocorrências e devoluções',
    permissions: [
      {
        key: 'erros.view',
        label: 'Visualizar Ocorrências',
        description: 'Ver histórico de erros e devoluções',
        section: 'erros'
      },
      {
        key: 'erros.create',
        label: 'Registrar Ocorrências',
        description: 'Criar novos registros de erros/devoluções',
        section: 'erros',
        dependsOn: ['erros.view']
      }
    ]
  },
  {
    key: 'relatorios',
    label: 'Relatórios',
    description: 'Acesso aos relatórios do sistema',
    permissions: [
      {
        key: 'relatorios.producao',
        label: 'Relatório de Produção',
        description: 'Visualizar relatórios de produção',
        section: 'relatorios'
      },
      {
        key: 'relatorios.romaneios',
        label: 'Relatório de Romaneios',
        description: 'Visualizar relatórios de romaneios',
        section: 'relatorios'
      },
      {
        key: 'relatorios.estoque',
        label: 'Relatório de Estoque',
        description: 'Visualizar relatórios de estoque de produtos',
        section: 'relatorios'
      },
      {
        key: 'relatorios.insumos',
        label: 'Relatório de Insumos',
        description: 'Visualizar relatórios de insumos',
        section: 'relatorios'
      },
      {
        key: 'relatorios.consumo',
        label: 'Monitoramento de Consumo',
        description: 'Visualizar análise de consumo (IA)',
        section: 'relatorios'
      },
      {
        key: 'relatorios.diagnostico',
        label: 'Diagnóstico de Estoque',
        description: 'Visualizar diagnóstico inteligente de estoque',
        section: 'relatorios'
      }
    ]
  },
  {
    key: 'config',
    label: 'Configurações',
    description: 'Configurações do sistema',
    permissions: [
      {
        key: 'config.view',
        label: 'Ver Configurações',
        description: 'Acessar página de configurações',
        section: 'config'
      },
      {
        key: 'config.insumos',
        label: 'Gerenciar Insumos',
        description: 'Cadastrar e editar insumos do sistema',
        section: 'config',
        dependsOn: ['config.view']
      },
      {
        key: 'config.itens',
        label: 'Gerenciar Itens Porcionados',
        description: 'Cadastrar e editar itens porcionados',
        section: 'config',
        dependsOn: ['config.view']
      },
      {
        key: 'config.produtos',
        label: 'Gerenciar Produtos',
        description: 'Cadastrar e editar produtos de loja',
        section: 'config',
        dependsOn: ['config.view']
      },
      {
        key: 'config.lojas',
        label: 'Gerenciar Lojas',
        description: 'Cadastrar e editar lojas',
        section: 'config',
        dependsOn: ['config.view']
      },
      {
        key: 'config.usuarios',
        label: 'Gerenciar Usuários',
        description: 'Gerenciar usuários e permissões',
        section: 'config',
        dependsOn: ['config.view']
      },
      {
        key: 'config.sistema',
        label: 'Configurações do Sistema',
        description: 'Alarmes, otimização sazonal e outras configs',
        section: 'config',
        dependsOn: ['config.view']
      },
      {
        key: 'config.interface',
        label: 'Configurar Interface',
        description: 'Personalizar visibilidade de elementos da UI',
        section: 'config',
        dependsOn: ['config.view']
      }
    ]
  },
  {
    key: 'compras',
    label: 'Lista de Compras',
    description: 'Gestão de listas de compras',
    permissions: [
      {
        key: 'compras.view',
        label: 'Visualizar Lista de Compras',
        description: 'Ver lista de compras gerada por IA',
        section: 'compras'
      },
      {
        key: 'compras.manage',
        label: 'Gerenciar Lista de Compras',
        description: 'Editar e exportar lista de compras',
        section: 'compras',
        dependsOn: ['compras.view']
      }
    ]
  }
];

// Helper: Obter todas as chaves de permissão como array flat
export const getAllPermissionKeys = (): string[] => {
  return PERMISSIONS_CONFIG.flatMap(section => 
    section.permissions.map(p => p.key)
  );
};

// Helper: Obter permissão por chave
export const getPermissionByKey = (key: string): Permission | undefined => {
  for (const section of PERMISSIONS_CONFIG) {
    const permission = section.permissions.find(p => p.key === key);
    if (permission) return permission;
  }
  return undefined;
};

// Helper: Obter todas as dependências de uma permissão
export const getPermissionDependencies = (key: string): string[] => {
  const permission = getPermissionByKey(key);
  if (!permission || !permission.dependsOn) return [];
  
  const allDeps: string[] = [...permission.dependsOn];
  
  // Recursivamente buscar dependências de dependências
  for (const depKey of permission.dependsOn) {
    const nestedDeps = getPermissionDependencies(depKey);
    allDeps.push(...nestedDeps);
  }
  
  return [...new Set(allDeps)]; // Remover duplicatas
};

// Helper: Expandir permissões com suas dependências
export const expandPermissionsWithDependencies = (permissions: string[]): string[] => {
  const expanded = new Set<string>(permissions);
  
  for (const perm of permissions) {
    const deps = getPermissionDependencies(perm);
    deps.forEach(dep => expanded.add(dep));
  }
  
  return Array.from(expanded);
};

// Mapeamento de seções de permissão para páginas de UI
export const SECTION_TO_UI_PAGE: Record<string, string> = {
  'contagem': 'contagem_porcionados',
  'producao': 'resumo_producao',
  'insumos': 'estoque_insumos',
  'estoque_loja': 'estoque_loja',
  'romaneio': 'romaneio',
  'erros': 'erros_devolucoes',
  'relatorios': 'central_relatorios'
};

// Mapeamento de rotas para permissões necessárias
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/': ['dashboard.view'],
  '/resumo-da-producao': ['producao.resumo.view'],
  '/insumos': ['insumos.view'],
  '/estoque-produtos-cpd': ['estoque_cpd_produtos.view'],
  '/contagem-porcionados': ['contagem.view'],
  '/estoque-diario': ['estoque_loja.view'],
  '/romaneio-porcionados': ['romaneio.view'],
  '/erros-devolucoes': ['erros.view'],
  '/lista-de-compras-ia': ['compras.view'],
  '/central-de-relatorios': ['relatorios.producao', 'relatorios.romaneios', 'relatorios.estoque', 'relatorios.insumos', 'relatorios.consumo', 'relatorios.diagnostico'],
  '/configuracoes': ['config.view'],
  '/configurar-interface': ['config.interface'],
  '/gerenciar-usuarios': ['config.usuarios'],
  '/gerenciar-produtos': ['config.produtos'],
  '/itens-porcionados': ['config.itens'],
  '/lojas': ['config.lojas'],
  // Relatórios específicos
  '/relatorios/producao': ['relatorios.producao'],
  '/relatorios/romaneios': ['relatorios.romaneios'],
  '/relatorios/estoque-produtos': ['relatorios.estoque'],
  '/relatorios/insumos': ['relatorios.insumos'],
  '/relatorios/monitoramento-consumo': ['relatorios.consumo'],
  '/relatorios/diagnostico-estoque': ['relatorios.diagnostico'],
  '/relatorios/consumo-historico': ['relatorios.consumo']
};

// Helper: Verificar se usuário tem permissão para uma rota
export const hasRoutePermission = (
  route: string, 
  userPermissions: string[], 
  isAdmin: boolean,
  isSuperAdmin: boolean
): boolean => {
  // Admin e SuperAdmin têm acesso total
  if (isAdmin || isSuperAdmin) return true;
  
  const requiredPermissions = ROUTE_PERMISSIONS[route];
  
  // Se rota não está mapeada, negar acesso por padrão
  if (!requiredPermissions) return false;
  
  // Verificar se usuário tem pelo menos uma das permissões necessárias
  return requiredPermissions.some(perm => userPermissions.includes(perm));
};
