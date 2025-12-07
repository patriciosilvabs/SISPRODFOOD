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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Undo2, AlertCircle } from 'lucide-react';

interface CancelarPreparoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemNome: string;
  onConfirm: (data: {
    motivo: string;
    observacao: string;
  }) => Promise<void>;
}

const MOTIVOS_CANCELAMENTO = [
  { value: 'falta_energia', label: 'Falta de energia' },
  { value: 'equipamento_quebrado', label: 'Equipamento quebrou' },
  { value: 'interrupcao_programada', label: 'Interrupção programada' },
  { value: 'falta_insumo', label: 'Falta de insumo' },
  { value: 'erro_quantidade', label: 'Erro na quantidade programada' },
  { value: 'outro', label: 'Outro' },
];

export function CancelarPreparoModal({
  open,
  onOpenChange,
  itemNome,
  onConfirm,
}: CancelarPreparoModalProps) {
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!motivo) return;

    setIsSubmitting(true);
    try {
      await onConfirm({
        motivo,
        observacao,
      });
      // Reset form
      setMotivo('');
      setObservacao('');
    } catch (error) {
      console.error('Erro ao cancelar preparo:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setMotivo('');
      setObservacao('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-orange-500" />
            Cancelar Preparo
          </DialogTitle>
          <DialogDescription>
            Cancelamento técnico de <strong>{itemNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Aviso de estorno */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">O estoque será estornado</p>
              <p className="text-xs mt-1">
                O insumo consumido será devolvido ao estoque e o item retornará para "A Produzir".
              </p>
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo do Cancelamento *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger id="motivo">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_CANCELAMENTO.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação (opcional)</Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes adicionais sobre o cancelamento..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
          >
            Voltar
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={!motivo || isSubmitting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSubmitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
