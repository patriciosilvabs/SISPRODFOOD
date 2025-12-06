// Configuração centralizada de UI Permissions
// Define estrutura de páginas, seções, colunas e ações configuráveis

export interface UISecaoConfig {
  id: string;
  nome: string;
  descricao?: string;
}

export interface UIColunaConfig {
  id: string;
  nome: string;
  campo?: string;
}

export interface UIAcaoConfig {
  id: string;
  nome: string;
  descricao?: string;
}

export interface UIPageConfig {
  id: string;
  nome: string;
  descricao: string;
  secoes: UISecaoConfig[];
  colunas: UIColunaConfig[];
  acoes: UIAcaoConfig[];
}

export interface UIPermissionsConfig {
  ativo: boolean;
  secoes: Record<string, { ativo: boolean }>;
  colunas: Record<string, { ativo: boolean }>;
  acoes: Record<string, { ativo: boolean }>;
}

// Configuração padrão onde tudo está ativo
export const getDefaultConfig = (pageConfig: UIPageConfig): UIPermissionsConfig => ({
  ativo: true,
  secoes: Object.fromEntries(pageConfig.secoes.map(s => [s.id, { ativo: true }])),
  colunas: Object.fromEntries(pageConfig.colunas.map(c => [c.id, { ativo: true }])),
  acoes: Object.fromEntries(pageConfig.acoes.map(a => [a.id, { ativo: true }]))
});

export const UI_PAGES_CONFIG: UIPageConfig[] = [
  {
    id: 'contagem_porcionados',
    nome: 'Contagem de Porcionados',
    descricao: 'Contagem diária de itens porcionados por loja',
    secoes: [
      { id: 'header_resumo', nome: 'Resumo Superior', descricao: 'Cards de resumo no topo da página' },
      { id: 'lista_itens', nome: 'Lista de Itens', descricao: 'Lista principal de itens para contagem' }
    ],
    colunas: [
      { id: 'item', nome: 'Item', campo: 'nome' },
      { id: 'sobra', nome: 'Final/Sobra', campo: 'final_sobra' },
      { id: 'peso', nome: 'Peso Total', campo: 'peso_total_g' },
      { id: 'ideal', nome: 'Ideal Amanhã', campo: 'ideal_amanha' },
      { id: 'a_produzir', nome: 'A Produzir' },
      { id: 'acao', nome: 'Ação' }
    ],
    acoes: [
      { id: 'salvar', nome: 'Salvar Contagem', descricao: 'Botão de salvar contagem individual' },
      { id: 'configurar_ideal', nome: 'Configurar Ideal Semanal', descricao: 'Abrir modal de estoque ideal' }
    ]
  },
  {
    id: 'resumo_producao',
    nome: 'Resumo da Produção',
    descricao: 'Kanban de acompanhamento de produção',
    secoes: [
      { id: 'kanban', nome: 'Quadro Kanban', descricao: 'Colunas de status da produção' },
      { id: 'alertas_estoque', nome: 'Alertas de Estoque', descricao: 'Indicadores de estoque insuficiente' },
      { id: 'detalhes_insumos', nome: 'Detalhes de Insumos', descricao: 'Breakdown de ingredientes' }
    ],
    colunas: [
      { id: 'col_a_produzir', nome: 'Coluna A Produzir' },
      { id: 'col_em_preparo', nome: 'Coluna Em Preparo' },
      { id: 'col_porcionamento', nome: 'Coluna Em Porcionamento' },
      { id: 'col_finalizado', nome: 'Coluna Finalizado' }
    ],
    acoes: [
      { id: 'iniciar_preparo', nome: 'Iniciar Preparo', descricao: 'Mover item para preparo' },
      { id: 'concluir_preparo', nome: 'Concluir Preparo', descricao: 'Finalizar etapa de preparo' },
      { id: 'finalizar_producao', nome: 'Finalizar Produção', descricao: 'Concluir produção do item' }
    ]
  },
  {
    id: 'estoque_insumos',
    nome: 'Estoque de Insumos',
    descricao: 'Gerenciamento de matérias-primas',
    secoes: [
      { id: 'lista_insumos', nome: 'Lista de Insumos', descricao: 'Tabela principal de insumos' },
      { id: 'alertas_minimo', nome: 'Alertas de Mínimo', descricao: 'Indicadores de estoque baixo' }
    ],
    colunas: [
      { id: 'nome', nome: 'Nome' },
      { id: 'quantidade', nome: 'Quantidade em Estoque' },
      { id: 'unidade', nome: 'Unidade' },
      { id: 'estoque_minimo', nome: 'Estoque Mínimo' },
      { id: 'ultima_movimentacao', nome: 'Última Movimentação' },
      { id: 'acoes', nome: 'Ações' }
    ],
    acoes: [
      { id: 'adicionar', nome: 'Adicionar Insumo', descricao: 'Criar novo insumo' },
      { id: 'editar', nome: 'Editar Insumo', descricao: 'Modificar insumo existente' },
      { id: 'entrada', nome: 'Registrar Entrada', descricao: 'Adicionar quantidade ao estoque' },
      { id: 'saida', nome: 'Registrar Saída', descricao: 'Remover quantidade do estoque' }
    ]
  },
  {
    id: 'estoque_loja',
    nome: 'Estoque da Loja',
    descricao: 'Controle de estoque por loja',
    secoes: [
      { id: 'contagem_loja', nome: 'Contagem Loja', descricao: 'Aba de contagem de produtos' },
      { id: 'envio_cpd', nome: 'Envio CPD', descricao: 'Aba de envio do CPD' },
      { id: 'receber_reposicao', nome: 'Receber Reposição', descricao: 'Aba de recebimento' }
    ],
    colunas: [
      { id: 'produto', nome: 'Produto' },
      { id: 'categoria', nome: 'Categoria' },
      { id: 'estoque_atual', nome: 'Estoque Atual' },
      { id: 'estoque_minimo', nome: 'Estoque Mínimo' },
      { id: 'a_enviar', nome: 'A Enviar' },
      { id: 'acoes', nome: 'Ações' }
    ],
    acoes: [
      { id: 'salvar_contagem', nome: 'Salvar Contagem', descricao: 'Salvar contagem da loja' },
      { id: 'confirmar_envio', nome: 'Confirmar Envio', descricao: 'Confirmar envio do CPD' },
      { id: 'confirmar_recebimento', nome: 'Confirmar Recebimento', descricao: 'Confirmar recebimento' }
    ]
  },
  {
    id: 'romaneio',
    nome: 'Romaneio',
    descricao: 'Gestão de romaneios e transferências',
    secoes: [
      { id: 'criar_romaneio', nome: 'Criar Romaneio', descricao: 'Aba de criação de romaneio' },
      { id: 'receber_porcionados', nome: 'Receber Porcionados', descricao: 'Aba de recebimento' },
      { id: 'historico', nome: 'Histórico', descricao: 'Aba de histórico de romaneios' },
      { id: 'romaneio_avulso', nome: 'Romaneio Avulso', descricao: 'Transferência entre lojas' }
    ],
    colunas: [
      { id: 'item', nome: 'Item' },
      { id: 'quantidade', nome: 'Quantidade' },
      { id: 'peso', nome: 'Peso' },
      { id: 'loja', nome: 'Loja' },
      { id: 'status', nome: 'Status' },
      { id: 'data', nome: 'Data' }
    ],
    acoes: [
      { id: 'enviar_romaneio', nome: 'Enviar Romaneio', descricao: 'Confirmar envio de romaneio' },
      { id: 'confirmar_recebimento', nome: 'Confirmar Recebimento', descricao: 'Confirmar recebimento' },
      { id: 'excluir_romaneio', nome: 'Excluir Romaneio', descricao: 'Excluir romaneio pendente' }
    ]
  },
  {
    id: 'erros_devolucoes',
    nome: 'Erros e Devoluções',
    descricao: 'Registro de ocorrências e devoluções',
    secoes: [
      { id: 'nova_ocorrencia', nome: 'Nova Ocorrência', descricao: 'Formulário de registro' },
      { id: 'historico', nome: 'Histórico', descricao: 'Lista de ocorrências anteriores' }
    ],
    colunas: [
      { id: 'descricao', nome: 'Descrição' },
      { id: 'loja', nome: 'Loja' },
      { id: 'data', nome: 'Data' },
      { id: 'usuario', nome: 'Usuário' },
      { id: 'foto', nome: 'Foto' }
    ],
    acoes: [
      { id: 'registrar', nome: 'Registrar Ocorrência', descricao: 'Salvar nova ocorrência' },
      { id: 'capturar_foto', nome: 'Capturar Foto', descricao: 'Tirar foto da ocorrência' }
    ]
  },
  {
    id: 'central_relatorios',
    nome: 'Central de Relatórios',
    descricao: 'Hub de relatórios e analytics',
    secoes: [
      { id: 'cards_relatorios', nome: 'Cards de Relatórios', descricao: 'Grid de acesso aos relatórios' }
    ],
    colunas: [],
    acoes: [
      { id: 'acessar_monitoramento', nome: 'Monitoramento de Consumo', descricao: 'Relatório de consumo' },
      { id: 'acessar_producao', nome: 'Relatório de Produção', descricao: 'Relatório de produção' },
      { id: 'acessar_romaneios', nome: 'Relatório de Romaneios', descricao: 'Relatório de romaneios' },
      { id: 'acessar_estoque', nome: 'Relatório de Estoque', descricao: 'Relatório de estoque' },
      { id: 'acessar_insumos', nome: 'Relatório de Insumos', descricao: 'Relatório de insumos' },
      { id: 'acessar_diagnostico', nome: 'Diagnóstico de Estoque', descricao: 'Diagnóstico inteligente' }
    ]
  }
];

// Função para encontrar configuração de página por ID
export const getPageConfigById = (paginaId: string): UIPageConfig | undefined => {
  return UI_PAGES_CONFIG.find(p => p.id === paginaId);
};
