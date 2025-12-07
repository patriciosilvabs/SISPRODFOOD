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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, AlertTriangle } from 'lucide-react';

interface RegistrarPerdaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemNome: string;
  unidadesProgramadas: number | null;
  pesoProgramadoKg: number | null;
  onConfirm: (data: {
    tipo_perda: string;
    quantidade_perdida: number;
    peso_perdido_kg: number | null;
    motivo: string;
  }) => Promise<void>;
}

const TIPOS_PERDA = [
  { value: 'queimado', label: '🔥 Queimado' },
  { value: 'contaminado', label: '⚠️ Contaminado' },
  { value: 'erro_preparo', label: '❌ Erro de preparo' },
  { value: 'equipamento', label: '🔧 Falha de equipamento' },
  { value: 'queda', label: '💥 Queda/Acidente' },
  { value: 'outro', label: '📋 Outro' },
];

export function RegistrarPerdaModal({
  open,
  onOpenChange,
  itemNome,
  unidadesProgramadas,
  pesoProgramadoKg,
  onConfirm,
}: RegistrarPerdaModalProps) {
  const [tipPerda, setTipoPerda] = useState('');
  const [quantidadePerdida, setQuantidadePerdida] = useState('');
  const [pesoPerdido, setPesoPerdido] = useState('');
  const [motivo, setMotivo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!tipPerda || !quantidadePerdida || !motivo) return;

    setIsSubmitting(true);
    try {
      await onConfirm({
        tipo_perda: tipPerda,
        quantidade_perdida: parseFloat(quantidadePerdida),
        peso_perdido_kg: pesoPerdido ? parseFloat(pesoPerdido) : null,
        motivo,
      });
      // Reset form
      setTipoPerda('');
      setQuantidadePerdida('');
      setPesoPerdido('');
      setMotivo('');
    } catch (error) {
      console.error('Erro ao registrar perda:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setTipoPerda('');
      setQuantidadePerdida('');
      setPesoPerdido('');
      setMotivo('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Registrar Perda
          </DialogTitle>
          <DialogDescription>
            Registro de perda real de <strong>{itemNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Aviso CRÍTICO - Estoque NÃO será estornado */}
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 dark:text-red-300">
              <p className="font-bold">⚠️ ATENÇÃO: Perda Real</p>
              <p className="text-xs mt-1">
                O estoque <strong>NÃO será estornado</strong>. Este registro contabiliza prejuízo financeiro real.
                O item será removido da fila de produção.
              </p>
            </div>
          </div>

          {/* Informações do item */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg text-sm">
            <div>
              <span className="text-muted-foreground">Programado:</span>
              <span className="ml-2 font-medium">{unidadesProgramadas || 0} un</span>
            </div>
            <div>
              <span className="text-muted-foreground">Peso:</span>
              <span className="ml-2 font-medium">{pesoProgramadoKg || 0} kg</span>
            </div>
          </div>

          {/* Tipo de Perda */}
          <div className="space-y-2">
            <Label htmlFor="tipo_perda">Tipo de Perda *</Label>
            <Select value={tipPerda} onValueChange={setTipoPerda}>
              <SelectTrigger id="tipo_perda">
                <SelectValue placeholder="Selecione o tipo de perda" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PERDA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade e Peso */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantidade_perdida">Quantidade Perdida (un) *</Label>
              <Input
                id="quantidade_perdida"
                type="number"
                min="1"
                max={unidadesProgramadas || undefined}
                value={quantidadePerdida}
                onChange={(e) => setQuantidadePerdida(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="peso_perdido">Peso Perdido (kg)</Label>
              <Input
                id="peso_perdido"
                type="number"
                step="0.001"
                min="0"
                value={pesoPerdido}
                onChange={(e) => setPesoPerdido(e.target.value)}
                placeholder="0.000"
              />
            </div>
          </div>

          {/* Motivo Detalhado */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Descrição da Perda *</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva em detalhes o que aconteceu e causou a perda..."
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Este registro será usado para auditoria e análise de prejuízos.
            </p>
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
            variant="destructive"
            onClick={handleSubmit}
            disabled={!tipPerda || !quantidadePerdida || !motivo || isSubmitting}
          >
            {isSubmitting ? 'Registrando...' : 'Registrar Perda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
