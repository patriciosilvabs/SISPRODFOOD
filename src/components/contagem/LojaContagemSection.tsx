import { Button } from '@/components/ui/button';
import { 
  ChevronDown, ChevronUp, PlayCircle, CheckCircle, Clock, 
  AlertCircle, RefreshCw, TrendingUp, Lock, Timer
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Loja {
  id: string;
  nome: string;
  responsavel: string;
}

interface SessaoContagem {
  id: string;
  status: string;
  iniciado_por_nome?: string;
  encerrado_por_nome?: string;
  encerrado_em?: string;
}

interface JanelaStatus {
  status: 'antes' | 'dentro' | 'depois';
  horaInicio: string;
  horaFim: string;
  horaAtual: string;
  tempoAteAbrir?: string;
  tempoAteFechar?: string;
  mensagem: string;
}

interface ResumoItem {
  itemId: string;
  itemNome: string;
  finalSobra: number;
  idealDoDia: number;
  aProduzir: number;
}

interface LojaContagemSectionProps {
  loja: Loja;
  sessao?: SessaoContagem;
  isOpen: boolean;
  onToggle: () => void;
  onIniciarSessao: () => void;
  onReiniciarSessao: () => void;
  children: React.ReactNode;
  // Para seção de produção extra quando encerrada
  itensProducaoExtra?: Array<{
    id: string;
    nome: string;
  }>;
  onSolicitarProducaoExtra?: (itemId: string, itemNome: string) => void;
  isAdmin?: boolean;
  // Status da janela de contagem
  janelaStatus?: JanelaStatus;
  // Resumo da contagem quando encerrada
  resumoContagem?: ResumoItem[];
}

const getStatusBadge = (sessao?: SessaoContagem, janelaStatus?: JanelaStatus) => {
  // Se a janela está fechada (antes ou depois), mostrar badge apropriado
  if (janelaStatus?.status === 'antes') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        <Lock className="h-3.5 w-3.5" /> Aguardando Janela
      </span>
    );
  }
  
  if (janelaStatus?.status === 'depois' && sessao?.status !== 'encerrada') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold uppercase tracking-wide">
        <Lock className="h-3.5 w-3.5" /> Janela Fechada
      </span>
    );
  }

  switch (sessao?.status) {
    case 'encerrada':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold uppercase tracking-wide">
          <CheckCircle className="h-3.5 w-3.5" /> Encerrada
        </span>
      );
    case 'em_andamento':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide animate-pulse">
          <Clock className="h-3.5 w-3.5" /> Contando...
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold uppercase tracking-wide">
          <AlertCircle className="h-3.5 w-3.5" /> Pendente
        </span>
      );
  }
};

export const LojaContagemSection = ({
  loja,
  sessao,
  isOpen,
  onToggle,
  onIniciarSessao,
  onReiniciarSessao,
  children,
  itensProducaoExtra,
  onSolicitarProducaoExtra,
  isAdmin,
  janelaStatus,
  resumoContagem,
}: LojaContagemSectionProps) => {
  const isSessaoAtiva = sessao?.status === 'em_andamento';
  const isJanelaAberta = janelaStatus?.status === 'dentro';
  const isAntesJanela = janelaStatus?.status === 'antes';
  const isDepoisJanela = janelaStatus?.status === 'depois';

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onToggle}
      className="bg-card rounded-xl border-2 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-lg text-foreground">{loja.nome}</span>
            <span className="text-sm text-muted-foreground">({loja.responsavel})</span>
            {getStatusBadge(sessao, janelaStatus)}
          </div>
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t-2">
          {/* Banner de status da janela */}
          {janelaStatus && (
            <div className={`flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium ${
              isAntesJanela ? 'bg-muted text-muted-foreground' :
              isDepoisJanela && sessao?.status !== 'encerrada' ? 'bg-destructive/10 text-destructive' :
              isJanelaAberta ? 'bg-primary/10 text-primary' : ''
            }`}>
              <Timer className="h-3.5 w-3.5" />
              {janelaStatus.mensagem}
            </div>
          )}

          {/* Tela Antes da Janela Abrir */}
          {isAntesJanela && (!sessao || sessao.status === 'pendente') && (
            <div className="flex flex-col items-center justify-center p-10 bg-muted/30">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Aguardando Horário</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                A janela de contagem abre às <span className="font-bold">{janelaStatus?.horaInicio}</span>.
              </p>
              {janelaStatus?.tempoAteAbrir && (
                <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-full border-2">
                  <Timer className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Abre em {janelaStatus.tempoAteAbrir}</span>
                </div>
              )}
            </div>
          )}

          {/* Tela Depois da Janela Fechar (sem sessão encerrada) */}
          {isDepoisJanela && (!sessao || sessao.status === 'pendente') && (
            <div className="flex flex-col bg-destructive/5">
              <div className="flex flex-col items-center justify-center p-8">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                  <Lock className="h-7 w-7 text-destructive" />
                </div>
                <h3 className="text-lg font-bold text-destructive mb-1">
                  Janela de Contagem Encerrada
                </h3>
                <p className="text-muted-foreground text-center text-sm mb-4">
                  O horário para contagem normal já passou. 
                  {janelaStatus?.horaFim && ` (encerrou às ${janelaStatus.horaFim})`}
                </p>
              </div>

              {/* Seção de Produção Extra - disponível para todos após fechamento */}
              {itensProducaoExtra && itensProducaoExtra.length > 0 && onSolicitarProducaoExtra && (
                <div className="border-t-2 border-destructive/20 p-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Solicitar Produção Extra
                    </h4>
                  </div>
                  
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {itensProducaoExtra.map((item) => (
                      <Button
                        key={item.id}
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSolicitarProducaoExtra(item.id, item.nome);
                        }}
                        className="justify-between h-auto py-2.5 px-3 text-left border-2 hover:bg-primary/5 hover:border-primary/30"
                      >
                        <span className="font-medium text-sm truncate">{item.nome}</span>
                        <TrendingUp className="h-4 w-4 text-primary shrink-0 ml-2" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tela de Iniciar Sessão (apenas quando janela está aberta) */}
          {isJanelaAberta && (!sessao || sessao.status === 'pendente') && (
            <div className="flex flex-col items-center justify-center p-10 bg-warning/5">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                <PlayCircle className="h-8 w-8 text-warning" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Contagem não iniciada</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Clique para iniciar a contagem do dia operacional. 
                Todos os campos deverão ser preenchidos antes de encerrar.
              </p>
              {janelaStatus?.tempoAteFechar && (
                <p className="text-xs text-muted-foreground mb-4">
                  ⏱ Janela fecha em {janelaStatus.tempoAteFechar}
                </p>
              )}
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onIniciarSessao();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-6 rounded-xl shadow-md"
                size="lg"
              >
                <PlayCircle className="h-5 w-5 mr-2" />
                Iniciar Contagem de Hoje
              </Button>
            </div>
          )}

          {/* Sessão Encerrada */}
          {sessao?.status === 'encerrada' && (
            <div className="flex flex-col bg-success/5">
              {/* Mensagem de encerramento */}
              <div className="flex flex-col items-center justify-center p-8">
                <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mb-3">
                  <CheckCircle className="h-7 w-7 text-success" />
                </div>
                <h3 className="text-lg font-bold text-success mb-1">
                  Contagem Encerrada
                </h3>
                <p className="text-muted-foreground text-center text-sm mb-1">
                  Encerrada por: <span className="font-medium">{sessao.encerrado_por_nome}</span>
                </p>
                {sessao.encerrado_em && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {format(new Date(sessao.encerrado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
                
                {/* Botão para reiniciar contagem */}
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onReiniciarSessao();
                  }}
                  variant="outline"
                  size="sm"
                  className="border-2 border-warning text-warning hover:bg-warning/10 rounded-xl"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reiniciar Contagem
                </Button>
              </div>

              {/* Resumo da Contagem */}
              {resumoContagem && resumoContagem.length > 0 && (
                <div className="border-t-2 border-success/20 p-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 text-center">
                    Resumo da Contagem
                  </h4>
                  
                {/* Cards de totais */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-card rounded-lg p-3 border text-center">
                    <p className="text-xs text-muted-foreground">Total Ideal</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {resumoContagem.reduce((sum, i) => sum + i.idealDoDia, 0)}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg p-3 border text-center">
                    <p className="text-xs text-muted-foreground">Total Sobras</p>
                    <p className="text-2xl font-bold text-foreground">
                      {resumoContagem.reduce((sum, i) => sum + i.finalSobra, 0)}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg p-3 border text-center">
                    <p className="text-xs text-muted-foreground">Total a Produzir</p>
                    <p className="text-2xl font-bold text-success">
                      {resumoContagem.reduce((sum, i) => sum + i.aProduzir, 0)}
                    </p>
                  </div>
                </div>

                {/* Tabela de itens */}
                <div className="bg-card rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-foreground">Item</th>
                        <th className="text-right px-3 py-2 font-medium text-foreground">Ideal</th>
                        <th className="text-right px-3 py-2 font-medium text-foreground">Sobra</th>
                        <th className="text-right px-3 py-2 font-medium text-foreground">A Produzir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumoContagem.map((item) => (
                        <tr key={item.itemId} className="border-t border-border">
                          <td className="px-3 py-2 text-foreground">
                            {item.itemNome}
                          </td>
                          <td className="px-3 py-2 text-right text-blue-600 font-medium">
                            {item.idealDoDia}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {item.finalSobra}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-success">
                            {item.aProduzir > 0 ? item.aProduzir : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              )}

                  {/* Seção de Produção Extra - disponível para todos após encerramento */}
                  {itensProducaoExtra && itensProducaoExtra.length > 0 && onSolicitarProducaoExtra && (
                <div className="border-t-2 border-success/20 p-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Solicitar Produção Extra
                    </h4>
                  </div>
                  
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {itensProducaoExtra.map((item) => (
                      <Button
                        key={item.id}
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSolicitarProducaoExtra(item.id, item.nome);
                        }}
                        className="justify-between h-auto py-2.5 px-3 text-left border-2 hover:bg-primary/5 hover:border-primary/30"
                      >
                        <span className="font-medium text-sm truncate">{item.nome}</span>
                        <TrendingUp className="h-4 w-4 text-primary shrink-0 ml-2" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Formulário de Contagem (sessão ativa) */}
          {isSessaoAtiva && (
            <div className="p-4 space-y-3">
              {children}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
