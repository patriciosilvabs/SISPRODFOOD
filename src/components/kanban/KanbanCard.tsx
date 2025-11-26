import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProducaoRegistro {
  id: string;
  item_nome: string;
  status: string;
  unidades_programadas: number | null;
  unidades_reais: number | null;
  peso_programado_kg: number | null;
  peso_final_kg: number | null;
  peso_preparo_kg?: number | null;
  sobra_preparo_kg?: number | null;
  data_inicio: string | null;
  data_inicio_preparo?: string | null;
  data_inicio_porcionamento?: string | null;
  data_fim: string | null;
  usuario_nome: string;
}

type StatusColumn = 'a_produzir' | 'em_preparo' | 'em_porcionamento' | 'finalizado';

interface KanbanCardProps {
  registro: ProducaoRegistro;
  columnId: StatusColumn;
  onAction: () => void;
}

export function KanbanCard({ registro, columnId, onAction }: KanbanCardProps) {
  const getButtonConfig = () => {
    switch (columnId) {
      case 'a_produzir':
        return { 
          label: 'Ir para Preparo', 
          icon: ArrowRight, 
          variant: 'default' as const 
        };
      case 'em_preparo':
        return { 
          label: 'Ir para Porcionamento', 
          icon: ArrowRight, 
          variant: 'default' as const 
        };
      case 'em_porcionamento':
        return { 
          label: 'Finalizar Porcionamento', 
          icon: CheckCircle2, 
          variant: 'default' as const 
        };
      default:
        return null;
    }
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig?.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-2">
            <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <h4 className="font-semibold text-sm leading-tight flex-1">
              {registro.item_nome}
            </h4>
          </div>

          {/* Informações por coluna */}
          <div className="space-y-1.5 text-xs">
            {/* A PRODUZIR */}
            {columnId === 'a_produzir' && (
              <>
                {registro.unidades_programadas && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">📦 Programadas:</span>
                    <Badge variant="secondary" className="font-semibold">
                      {registro.unidades_programadas} un
                    </Badge>
                  </div>
                )}
                {registro.peso_programado_kg && (
                  <p className="text-muted-foreground">
                    ⚖️ Peso prog.: <span className="font-medium">{registro.peso_programado_kg} kg</span>
                  </p>
                )}
              </>
            )}

            {/* EM PREPARO */}
            {columnId === 'em_preparo' && (
              <>
                {registro.unidades_programadas && (
                  <p className="text-muted-foreground">
                    📦 Programadas: <span className="font-medium">{registro.unidades_programadas} un</span>
                  </p>
                )}
                {registro.data_inicio_preparo && (
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">
                      Em preparo desde {format(new Date(registro.data_inicio_preparo), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* EM PORCIONAMENTO */}
            {columnId === 'em_porcionamento' && (
              <>
                {registro.unidades_programadas && (
                  <p className="text-muted-foreground">
                    📦 Programadas: <span className="font-medium">{registro.unidades_programadas} un</span>
                  </p>
                )}
                {registro.peso_preparo_kg && (
                  <p className="text-muted-foreground">
                    ⚖️ Peso preparo: <span className="font-medium text-foreground">{registro.peso_preparo_kg} kg</span>
                  </p>
                )}
                {registro.sobra_preparo_kg !== null && registro.sobra_preparo_kg !== undefined && (
                  <p className="text-muted-foreground">
                    🗑️ Sobra preparo: <span className="font-medium text-foreground">{registro.sobra_preparo_kg} kg</span>
                  </p>
                )}
                {registro.data_inicio_porcionamento && (
                  <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">
                      Porcionando desde {format(new Date(registro.data_inicio_porcionamento), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* FINALIZADO */}
            {columnId === 'finalizado' && (
              <>
                {registro.unidades_reais && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">✅ Reais:</span>
                    <Badge variant="default" className="font-semibold bg-green-600">
                      {registro.unidades_reais} un
                    </Badge>
                  </div>
                )}
                {registro.peso_final_kg && (
                  <p className="text-muted-foreground">
                    ⚖️ Peso final: <span className="font-medium text-foreground">{registro.peso_final_kg} kg</span>
                  </p>
                )}
                {registro.data_fim && (
                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="font-medium">
                      Finalizado às {format(new Date(registro.data_fim), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Usuário e Data */}
          <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
            <p className="font-medium">👤 {registro.usuario_nome}</p>
            {registro.data_inicio && columnId === 'a_produzir' && (
              <p>
                🕐 {format(new Date(registro.data_inicio), 'dd/MM HH:mm', { locale: ptBR })}
              </p>
            )}
          </div>

          {/* Botão de Ação */}
          {buttonConfig && (
            <Button 
              onClick={onAction}
              className="w-full mt-2"
              variant={buttonConfig.variant}
              size="sm"
            >
              {ButtonIcon && <ButtonIcon className="h-4 w-4 mr-2" />}
              {buttonConfig.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
