import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RegistroAntigo {
  id: string;
  item_nome: string;
  unidades_programadas: number | null;
  data_referencia?: string;
}

interface CancelarProducoesAntigasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrosAntigos: RegistroAntigo[];
  onConfirm: (observacao: string) => Promise<void>;
}

export const CancelarProducoesAntigasModal = ({
  open,
  onOpenChange,
  registrosAntigos,
  onConfirm,
}: CancelarProducoesAntigasModalProps) => {
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Agrupar registros por data
  const registrosPorData = registrosAntigos.reduce((acc, registro) => {
    const data = registro.data_referencia || 'Sem data';
    if (!acc[data]) {
      acc[data] = [];
    }
    acc[data].push(registro);
    return acc;
  }, {} as Record<string, RegistroAntigo[]>);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(observacao);
      setObservacao('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(isOpen);
      if (!isOpen) {
        setObservacao('');
      }
    }
  };

  const formatarData = (dataStr: string) => {
    if (dataStr === 'Sem data') return dataStr;
    try {
      const [ano, mes, dia] = dataStr.split('-').map(Number);
      const data = new Date(ano, mes - 1, dia);
      return format(data, "dd 'de' MMMM", { locale: ptBR });
    } catch {
      return dataStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancelar Produções de Dias Anteriores
          </DialogTitle>
          <DialogDescription>
            As produções listadas abaixo não foram realizadas no dia programado e serão canceladas.
            Como ainda estavam em "A Produzir", nenhum estoque foi consumido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo por data */}
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {Object.entries(registrosPorData)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([data, registros]) => (
                <div key={data} className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{formatarData(data)}</span>
                    <Badge variant="secondary" className="text-xs">
                      {registros.length} {registros.length === 1 ? 'item' : 'itens'}
                    </Badge>
                  </div>
                  <div className="space-y-1 pl-6">
                    {registros.map((registro) => (
                      <div key={registro.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {registro.item_nome}
                        </span>
                        <span className="font-mono text-xs">
                          {registro.unidades_programadas || 0} un
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-medium">Total a cancelar:</span>
            <Badge variant="destructive" className="text-base px-3 py-1">
              {registrosAntigos.length} {registrosAntigos.length === 1 ? 'produção' : 'produções'}
            </Badge>
          </div>

          {/* Observação opcional */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação (opcional)</Label>
            <Textarea
              id="observacao"
              placeholder="Adicione uma observação sobre o cancelamento..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
          >
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              'Cancelando...'
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Confirmar Cancelamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
