import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { Loader2, Calendar } from 'lucide-react';

interface ItemPorcionado {
  id: string;
  nome: string;
}

interface ReservaDiaria {
  id?: string;
  item_porcionado_id: string;
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

interface ConfigurarReservaDiariaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const diasSemana = [
  { key: 'segunda' as const, label: 'Segunda' },
  { key: 'terca' as const, label: 'Terça' },
  { key: 'quarta' as const, label: 'Quarta' },
  { key: 'quinta' as const, label: 'Quinta' },
  { key: 'sexta' as const, label: 'Sexta' },
  { key: 'sabado' as const, label: 'Sábado' },
  { key: 'domingo' as const, label: 'Domingo' }
];

export function ConfigurarReservaDiariaModal({ open, onOpenChange }: ConfigurarReservaDiariaModalProps) {
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itens, setItens] = useState<ItemPorcionado[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [reserva, setReserva] = useState<ReservaDiaria>({
    item_porcionado_id: '',
    segunda: 0,
    terca: 0,
    quarta: 0,
    quinta: 0,
    sexta: 0,
    sabado: 0,
    domingo: 0
  });

  useEffect(() => {
    if (open) {
      loadItens();
    }
  }, [open]);

  useEffect(() => {
    if (selectedItemId) {
      loadReserva(selectedItemId);
    }
  }, [selectedItemId]);

  const loadItens = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('itens_porcionados')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setItens(data || []);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      toast.error('Erro ao carregar itens porcionados');
    } finally {
      setLoading(false);
    }
  };

  const loadReserva = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('itens_reserva_diaria')
        .select('*')
        .eq('item_porcionado_id', itemId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setReserva(data);
      } else {
        setReserva({
          item_porcionado_id: itemId,
          segunda: 0,
          terca: 0,
          quarta: 0,
          quinta: 0,
          sexta: 0,
          sabado: 0,
          domingo: 0
        });
      }
    } catch (error) {
      console.error('Erro ao carregar reserva:', error);
      toast.error('Erro ao carregar configuração de reserva');
    }
  };

  const handleSave = async () => {
    if (!selectedItemId) {
      toast.error('Selecione um item');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        item_porcionado_id: selectedItemId,
        segunda: reserva.segunda,
        terca: reserva.terca,
        quarta: reserva.quarta,
        quinta: reserva.quinta,
        sexta: reserva.sexta,
        sabado: reserva.sabado,
        domingo: reserva.domingo,
        organization_id: organizationId
      };

      const { error } = await supabase
        .from('itens_reserva_diaria')
        .upsert(dataToSave, {
          onConflict: 'item_porcionado_id'
        });

      if (error) throw error;

      toast.success('Reserva configurada com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar reserva:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleDiaChange = (dia: keyof Omit<ReservaDiaria, 'id' | 'item_porcionado_id'>, value: string) => {
    const numValue = parseInt(value) || 0;
    setReserva(prev => ({ ...prev, [dia]: numValue }));
  };

  const aplicarParaTodos = (valor: number) => {
    setReserva(prev => ({
      ...prev,
      segunda: valor,
      terca: valor,
      quarta: valor,
      quinta: valor,
      sexta: valor,
      sabado: valor,
      domingo: valor
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Configurar Reserva Mínima por Dia
          </DialogTitle>
          <DialogDescription>
            Configure a reserva mínima que deve ficar no CPD para cada dia da semana
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seleção de Item */}
          <div className="space-y-2">
            <Label>Item Porcionado</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um item..." />
              </SelectTrigger>
              <SelectContent>
                {itens.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItemId && (
            <>
              {/* Aplicar para Todos */}
              <div className="flex items-end gap-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label>Aplicar valor para todos os dias</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Quantidade padrão"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        aplicarParaTodos(parseInt(input.value) || 0);
                      }
                    }}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling?.querySelector('input') as HTMLInputElement);
                    aplicarParaTodos(parseInt(input?.value) || 0);
                  }}
                >
                  Aplicar
                </Button>
              </div>

              {/* Configuração por Dia */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Reserva Mínima por Dia da Semana</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {diasSemana.map(dia => (
                    <div key={dia.key} className="space-y-2">
                      <Label className="text-sm">{dia.label}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={reserva[dia.key]}
                        onChange={(e) => handleDiaChange(dia.key, e.target.value)}
                        className="text-center font-medium"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedItemId || saving}
              className="flex-1"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Reserva
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
