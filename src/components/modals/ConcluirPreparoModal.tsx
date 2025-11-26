import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package } from 'lucide-react';
import { numberToWords } from '@/lib/numberToWords';

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
  const [sobraPreparo, setSobraPreparo] = useState('0');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const pesoNum = parseFloat(pesoPreparo);
    const sobraNum = parseFloat(sobraPreparo);
    
    if (isNaN(pesoNum) || pesoNum <= 0) {
      return;
    }
    if (isNaN(sobraNum) || sobraNum < 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        peso_preparo_kg: pesoNum,
        sobra_preparo_kg: parseFloat(sobraPreparo) || 0,
        observacao_preparo: observacao,
      });
      
      // Reset form
      setPesoPreparo('');
      setSobraPreparo('0');
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
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Package className="h-5 w-5 text-primary" />
            <span className="font-semibold">{itemNome}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="peso-preparo" className="text-base">
              PESO TOTAL (kg) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="peso-preparo"
              type="number"
              step="0.001"
              placeholder="Ex: 2.4"
              value={pesoPreparo}
              onChange={(e) => setPesoPreparo(e.target.value)}
              required
              className="text-lg"
            />
            {pesoPreparo && parseFloat(pesoPreparo) > 0 && (
              <p className="text-sm font-medium text-primary">
                {numberToWords(pesoPreparo, 'kg')}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Peso total depois da fatiação/ralação/cozimento/assamento
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sobra-preparo" className="text-base">
              SOBRA/PERDA (kg) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sobra-preparo"
              type="number"
              step="0.001"
              placeholder="Ex: 0.1"
              value={sobraPreparo}
              onChange={(e) => setSobraPreparo(e.target.value)}
              required
              className="text-lg"
            />
            {sobraPreparo && parseFloat(sobraPreparo) > 0 && (
              <p className="text-sm font-medium text-primary">
                {numberToWords(sobraPreparo, 'kg')}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Pedaços não aproveitados, estragados, etc
            </p>
          </div>

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
            <Button type="submit" disabled={isSubmitting || !pesoPreparo || sobraPreparo === ''}>
              {isSubmitting ? 'Avançando...' : 'Avançar para Porcionamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
