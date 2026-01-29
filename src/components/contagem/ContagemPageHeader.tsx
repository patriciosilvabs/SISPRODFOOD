import { Button } from '@/components/ui/button';
import { RefreshCw, Eye, EyeOff } from 'lucide-react';

interface ContagemPageHeaderProps {
  showDetails: boolean;
  isAdmin: boolean;
  loading: boolean;
  isCPDOnly?: boolean;
  onToggleDetails: () => void;
  onRefresh: () => void;
}

export const ContagemPageHeader = ({
  showDetails,
  isAdmin,
  loading,
  isCPDOnly = false,
  onToggleDetails,
  onRefresh,
}: ContagemPageHeaderProps) => {
  const title = isCPDOnly ? 'Estoque de Porcionados' : 'Contagem de Porcionados';
  const subtitle = isCPDOnly 
    ? 'Visualize e ajuste o estoque de porcionados do CPD'
    : 'Registre a sobra do dia e acompanhe a demanda de produção';

  return (
    <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Button 
            size="sm" 
            variant={showDetails ? "default" : "outline"}
            onClick={onToggleDetails}
            className="h-10 rounded-xl border-2"
          >
            {showDetails ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
          </Button>
        )}
        <Button 
          size="icon" 
          onClick={onRefresh} 
          disabled={loading} 
          variant="outline" 
          className="h-10 w-10 rounded-xl border-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
};
