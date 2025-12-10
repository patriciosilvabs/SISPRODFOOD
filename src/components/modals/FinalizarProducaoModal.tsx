import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Package, CheckCircle2, AlertTriangle, Scale } from 'lucide-react';
import { numberToWords } from '@/lib/numberToWords';
import { WeightInput } from '@/components/ui/weight-input';
import { rawToKg } from '@/lib/weightUtils';
import { useMediaMovelMassa } from '@/hooks/useMediaMovelMassa';

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
    // Dados de calibragem LOTE_MASSEIRA
    peso_medio_real_bolinha_g?: number;
    status_calibracao?: string;
  }) => void;
  // Props para LOTE_MASSEIRA
  itemId?: string;
  producaoRegistroId?: string;
  unidadeMedida?: string;
  lotesProducidos?: number;
  pesoMinimoBolinhaG?: number;
  pesoMaximoBolinhaG?: number;
  pesoAlvoBolinhaG?: number;
  farinhaPorLoteKg?: number;
  massaGeradaPorLoteKg?: number;
}

export function FinalizarProducaoModal({
  open,
  onOpenChange,
  itemNome,
  unidadesProgramadas,
  onConfirm,
  // Props LOTE_MASSEIRA
  itemId,
  producaoRegistroId,
  unidadeMedida,
  lotesProducidos,
  pesoMinimoBolinhaG,
  pesoMaximoBolinhaG,
  pesoAlvoBolinhaG,
  farinhaPorLoteKg,
  massaGeradaPorLoteKg,
}: FinalizarProducaoModalProps) {
  const [unidadesReais, setUnidadesReais] = useState(unidadesProgramadas?.toString() || '');
  const [pesoFinal, setPesoFinal] = useState('');
  const [sobra, setSobra] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { calcularCalibragem, registrarFinalizacaoMasseira } = useMediaMovelMassa();

  const isLoteMasseira = unidadeMedida === 'lote_masseira';

  // Cálculo de calibragem em tempo real para LOTE_MASSEIRA
  // Prévia só aparece quando TODOS os 3 campos estão preenchidos (Quantidade, Peso Final, Sobra)
  const calibragemPrevia = useMemo(() => {
    if (!isLoteMasseira || !pesoMinimoBolinhaG || !pesoMaximoBolinhaG) return null;
    
    const pesoFinalKg = rawToKg(pesoFinal);
    const sobraKg = rawToKg(sobra);
    const unidadesNum = parseInt(unidadesReais);
    
    // Exigir todos os 3 campos preenchidos (sobra pode ser 0, mas precisa ter valor)
    if (!pesoFinalKg || pesoFinalKg <= 0 || 
        !unidadesNum || unidadesNum <= 0 || 
        sobra === '' || sobra === undefined) {
      return null;
    }
    
    // CRÍTICO: Converter kg para gramas antes de passar para calcularCalibragem
    // rawToKg retorna valor em kg, mas calcularCalibragem espera gramas
    return calcularCalibragem(
      pesoFinalKg * 1000,  // kg → g
      sobraKg * 1000,      // kg → g
      unidadesNum,
      pesoMinimoBolinhaG,
      pesoMaximoBolinhaG
    );
  }, [isLoteMasseira, pesoFinal, sobra, unidadesReais, pesoMinimoBolinhaG, pesoMaximoBolinhaG, calcularCalibragem]);

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
      let pesoMedioRealBolinhaG: number | undefined;
      let statusCalibracao: string | undefined;

      // Se for LOTE_MASSEIRA, registrar calibragem
      if (isLoteMasseira && itemId && lotesProducidos && producaoRegistroId) {
        const resultado = await registrarFinalizacaoMasseira({
          itemId,
          producaoRegistroId,
          lotesProducidos,
          quantidadeEsperada: unidadesProgramadas || unidadesNum,
          quantidadeRealProduzida: unidadesNum,
          pesoFinalG: pesoFinalKg * 1000,
          sobraPerdaG: sobraKg * 1000,
        });

        if (resultado.success && resultado.calibragem) {
          pesoMedioRealBolinhaG = resultado.calibragem.pesoMedioRealBolinhaG;
          statusCalibracao = resultado.calibragem.statusCalibracao;
        }
      }

      await onConfirm({
        unidades_reais: unidadesNum,
        peso_final_kg: pesoFinalKg,
        sobra_kg: sobraKg,
        observacao_porcionamento: observacao,
        peso_medio_real_bolinha_g: pesoMedioRealBolinhaG,
        status_calibracao: statusCalibracao,
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

          {/* Informações LOTE_MASSEIRA */}
          {isLoteMasseira && lotesProducidos && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Lotes Produzidos</p>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                  {lotesProducidos} {lotesProducidos === 1 ? 'lote' : 'lotes'}
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Faixa Padrão</p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                  {pesoMinimoBolinhaG}g - {pesoMaximoBolinhaG}g
                </p>
                {pesoAlvoBolinhaG && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Alvo: {pesoAlvoBolinhaG}g
                  </p>
                )}
              </div>
            </div>
          )}

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

          {/* Prévia de Calibragem LOTE_MASSEIRA */}
          {isLoteMasseira && calibragemPrevia && (
            <div className={`p-3 rounded-lg border-2 ${
              calibragemPrevia.dentroDoLimite 
                ? 'bg-green-50 dark:bg-green-950 border-green-500' 
                : 'bg-red-50 dark:bg-red-950 border-red-500'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Scale className="h-4 w-4" />
                <span className="text-sm font-medium">Prévia de Calibragem</span>
                <Badge variant={calibragemPrevia.dentroDoLimite ? 'default' : 'destructive'}>
                  {calibragemPrevia.dentroDoLimite ? '✅ Dentro do Padrão' : '⚠️ Fora do Padrão'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Peso Médio Real:</span>
                  <p className="font-bold text-lg">{calibragemPrevia.pesoMedioRealBolinhaG.toFixed(1)}g</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Massa Utilizada:</span>
                  <p className="font-bold">{(calibragemPrevia.massaTotalUtilizadaG / 1000).toFixed(2)} kg</p>
                </div>
              </div>
              {!calibragemPrevia.dentroDoLimite && (
                <div className="flex items-center gap-2 mt-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">
                    Desvio de {calibragemPrevia.desvioG.toFixed(1)}g do limite. Verificar porcionadora!
                  </span>
                </div>
              )}
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
