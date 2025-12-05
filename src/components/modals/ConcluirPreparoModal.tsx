import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package } from 'lucide-react';
import { WeightInput } from '@/components/ui/weight-input';
import { rawToKg } from '@/lib/weightUtils';

interface ConcluirPreparoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemNome: string;
  onConfirm: (data: {
    peso_preparo_kg: number;
    sobra_preparo_kg: number;
    observacao_preparo: string;
  }) => void;
}

export function ConcluirPreparoModal({
  open,
  onOpenChange,
  itemNome,
  onConfirm,
}: ConcluirPreparoModalProps) {
  const [pesoPreparo, setPesoPreparo] = useState('');
  const [sobraPreparo, setSobraPreparo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const pesoKg = rawToKg(pesoPreparo);
    const sobraKg = rawToKg(sobraPreparo);
    
    if (pesoKg <= 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        peso_preparo_kg: pesoKg,
        sobra_preparo_kg: sobraKg,
        observacao_preparo: observacao,
      });
      
      // Reset form
      setPesoPreparo('');
      setSobraPreparo('');
      setObservacao('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Concluir Etapa de Preparo</DialogTitle>
          <DialogDescription>
            Registre o peso total e perdas da etapa de preparo
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Package className="h-5 w-5 text-primary" />
            <span className="font-semibold">{itemNome}</span>
          </div>

          <WeightInput
            value={pesoPreparo}
            onChange={setPesoPreparo}
            label="PESO TOTAL"
            required
            placeholder="Ex: 2400 (gramas)"
            helperText="Peso total depois da fatiação/ralação/cozimento/assamento"
          />

          <WeightInput
            value={sobraPreparo}
            onChange={setSobraPreparo}
            label="SOBRA/PERDA"
            required
            placeholder="Ex: 100 (gramas)"
            helperText="Pedaços não aproveitados, estragados, etc"
          />

          <div className="space-y-2">
            <Label htmlFor="observacao" className="text-base">
              OBSERVAÇÃO
            </Label>
            <Textarea
              id="observacao"
              placeholder="Registrar detalhes importantes..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !pesoPreparo}>
              {isSubmitting ? 'Avançando...' : 'Avançar para Porcionamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
