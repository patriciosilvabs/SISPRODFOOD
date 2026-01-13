import { Button } from '@/components/ui/button';
import { 
  ChevronDown, ChevronUp, PlayCircle, CheckCircle, Clock, 
  AlertCircle, RefreshCw 
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

interface LojaContagemSectionProps {
  loja: Loja;
  sessao?: SessaoContagem;
  isOpen: boolean;
  onToggle: () => void;
  onIniciarSessao: () => void;
  onReiniciarSessao: () => void;
  children: React.ReactNode;
}

const getStatusBadge = (sessao?: SessaoContagem) => {
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
}: LojaContagemSectionProps) => {
  const isSessaoAtiva = sessao?.status === 'em_andamento';

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
            {getStatusBadge(sessao)}
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
          {/* Tela de Iniciar Sessão */}
          {(!sessao || sessao.status === 'pendente') && (
            <div className="flex flex-col items-center justify-center p-10 bg-warning/5">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                <PlayCircle className="h-8 w-8 text-warning" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Contagem não iniciada</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Clique para iniciar a contagem do dia operacional. 
                Todos os campos deverão ser preenchidos antes de encerrar.
              </p>
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
            <div className="flex flex-col items-center justify-center p-10 bg-success/5">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h3 className="text-lg font-bold text-success mb-2">
                Contagem Encerrada
              </h3>
              <p className="text-muted-foreground text-center mb-2">
                Encerrada por: <span className="font-medium">{sessao.encerrado_por_nome}</span>
              </p>
              {sessao.encerrado_em && (
                <p className="text-sm text-muted-foreground mb-4">
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
                className="mt-2 border-2 border-warning text-warning hover:bg-warning/10 rounded-xl"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reiniciar Contagem
              </Button>
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
