import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package, CheckCircle2 } from 'lucide-react';
import { numberToWords } from '@/lib/numberToWords';
import { WeightInput } from '@/components/ui/weight-input';
import { rawToKg } from '@/lib/weightUtils';

interface FinalizarProducaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemNome: string;
  unidadesProgramadas: number | null;
  onConfirm: (data: {
    unidades_reais: number;
    peso_final_kg: number;
    sobra_kg: number;
    observacao_porcionamento: string;
  }) => void;
}

export function FinalizarProducaoModal({
  open,
  onOpenChange,
  itemNome,
  unidadesProgramadas,
  onConfirm,
}: FinalizarProducaoModalProps) {
  const [unidadesReais, setUnidadesReais] = useState(unidadesProgramadas?.toString() || '');
  const [pesoFinal, setPesoFinal] = useState('');
  const [sobra, setSobra] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const unidadesNum = parseInt(unidadesReais);
    const pesoFinalKg = rawToKg(pesoFinal);
    const sobraKg = rawToKg(sobra);
    
    if (isNaN(unidadesNum) || unidadesNum <= 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        unidades_reais: unidadesNum,
        peso_final_kg: pesoFinalKg,
        sobra_kg: sobraKg,
        observacao_porcionamento: observacao,
      });
      
      // Reset form
      setUnidadesReais('');
      setPesoFinal('');
      setSobra('');
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
          <DialogTitle className="text-xl flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Finalizar Produção
          </DialogTitle>
          <DialogDescription>
            Registre a quantidade real produzida, peso final e perdas
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Package className="h-5 w-5 text-primary" />
            <span className="font-semibold">{itemNome}</span>
          </div>

          {unidadesProgramadas && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">
                Quantidade Esperada
              </p>
              <p className="text-2xl font-bold text-primary">
                {unidadesProgramadas} un
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="unidades-reais" className="text-base">
              QUANTIDADE REAL PRODUZIDA <span className="text-destructive">*</span>
            </Label>
            <Input
              id="unidades-reais"
              type="number"
              placeholder="Ex: 148"
              value={unidadesReais}
              onChange={(e) => setUnidadesReais(e.target.value)}
              required
              className="text-lg"
            />
            {unidadesReais && parseInt(unidadesReais) > 0 && (
              <p className="text-sm font-medium text-primary">
                {numberToWords(unidadesReais, 'unidade')}
              </p>
            )}
          </div>

          <WeightInput
            value={pesoFinal}
            onChange={setPesoFinal}
            label="PESO FINAL"
            required
            placeholder="Ex: 2300 (gramas)"
            helperText="Peso total dos itens embalados"
          />

          <WeightInput
            value={sobra}
            onChange={setSobra}
            label="SOBRA/PERDA"
            required
            placeholder="Ex: 200 (gramas)"
            helperText="Restos do processo de porcionamento"
          />

          <div className="space-y-2">
            <Label htmlFor="observacao-final" className="text-base">
              OBSERVAÇÃO
            </Label>
            <Textarea
              id="observacao-final"
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
            <Button type="submit" disabled={isSubmitting || !unidadesReais || !pesoFinal || !sobra}>
              {isSubmitting ? 'Finalizando...' : '✅ Finalizar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
