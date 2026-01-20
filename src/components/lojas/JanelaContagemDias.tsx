import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Clock, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface JanelaDia {
  id?: string;
  loja_id: string;
  dia_semana: number;
  janela_inicio: string;
  janela_fim: string;
  ativo: boolean;
  organization_id?: string;
}

interface JanelaContagemDiasProps {
  lojaId: string;
  organizationId: string;
  defaultInicio?: string;
  defaultFim?: string;
}

const DIAS_SEMANA = [
  { dia: 0, nome: 'Domingo', abrev: 'Dom' },
  { dia: 1, nome: 'Segunda', abrev: 'Seg' },
  { dia: 2, nome: 'Terça', abrev: 'Ter' },
  { dia: 3, nome: 'Quarta', abrev: 'Qua' },
  { dia: 4, nome: 'Quinta', abrev: 'Qui' },
  { dia: 5, nome: 'Sexta', abrev: 'Sex' },
  { dia: 6, nome: 'Sábado', abrev: 'Sáb' },
];

export const JanelaContagemDias = ({
  lojaId,
  organizationId,
  defaultInicio = '22:00',
  defaultFim = '00:00',
}: JanelaContagemDiasProps) => {
  const [janelas, setJanelas] = useState<JanelaDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lojaId) {
      fetchJanelas();
    }
  }, [lojaId]);

  const fetchJanelas = async () => {
    try {
      const { data, error } = await supabase
        .from('janelas_contagem_por_dia')
        .select('*')
        .eq('loja_id', lojaId)
        .order('dia_semana');

      if (error) throw error;

      // Se não há dados, criar registros padrão para todos os dias
      if (!data || data.length === 0) {
        const novasJanelas: JanelaDia[] = DIAS_SEMANA.map((d) => ({
          loja_id: lojaId,
          dia_semana: d.dia,
          janela_inicio: defaultInicio,
          janela_fim: defaultFim,
          ativo: true,
          organization_id: organizationId,
        }));
        setJanelas(novasJanelas);
      } else {
        // Mapear dados existentes
        const janelasCompletas: JanelaDia[] = DIAS_SEMANA.map((d) => {
          const existente = data.find((j) => j.dia_semana === d.dia);
          return existente
            ? {
                id: existente.id,
                loja_id: existente.loja_id,
                dia_semana: existente.dia_semana,
                janela_inicio: existente.janela_inicio?.slice(0, 5) || defaultInicio,
                janela_fim: existente.janela_fim?.slice(0, 5) || defaultFim,
                ativo: existente.ativo ?? true,
                organization_id: existente.organization_id,
              }
            : {
                loja_id: lojaId,
                dia_semana: d.dia,
                janela_inicio: defaultInicio,
                janela_fim: defaultFim,
                ativo: true,
                organization_id: organizationId,
              };
        });
        setJanelas(janelasCompletas);
      }
    } catch (error) {
      console.error('Erro ao buscar janelas:', error);
      toast.error('Erro ao carregar configurações de janela');
    } finally {
      setLoading(false);
    }
  };

  const updateJanela = (diaSemana: number, field: keyof JanelaDia, value: any) => {
    setJanelas((prev) =>
      prev.map((j) => (j.dia_semana === diaSemana ? { ...j, [field]: value } : j))
    );
  };

  const aplicarParaTodos = () => {
    // Usar o primeiro dia (domingo) como referência
    const referencia = janelas[0];
    if (!referencia) return;

    setJanelas((prev) =>
      prev.map((j) => ({
        ...j,
        janela_inicio: referencia.janela_inicio,
        janela_fim: referencia.janela_fim,
        ativo: referencia.ativo,
      }))
    );
    toast.success('Horário aplicado para todos os dias');
  };

  const salvarJanelas = async () => {
    setSaving(true);
    try {
      // Upsert todas as janelas
      for (const janela of janelas) {
        const dataToSave = {
          loja_id: janela.loja_id,
          dia_semana: janela.dia_semana,
          janela_inicio: janela.janela_inicio + ':00',
          janela_fim: janela.janela_fim + ':00',
          ativo: janela.ativo,
          organization_id: organizationId,
        };

        if (janela.id) {
          // Atualizar existente
          const { error } = await supabase
            .from('janelas_contagem_por_dia')
            .update(dataToSave)
            .eq('id', janela.id);

          if (error) throw error;
        } else {
          // Inserir novo
          const { error } = await supabase
            .from('janelas_contagem_por_dia')
            .insert(dataToSave);

          if (error) throw error;
        }
      }

      toast.success('Janelas de contagem salvas com sucesso!');
      fetchJanelas(); // Recarregar para obter IDs
    } catch (error: any) {
      console.error('Erro ao salvar janelas:', error);
      toast.error(error.message || 'Erro ao salvar janelas');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 bg-accent/30 rounded-lg border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Carregando configurações...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-accent/30 rounded-lg border">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1 font-semibold">
          <Clock className="h-3.5 w-3.5" />
          Janela de Contagem por Dia
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={aplicarParaTodos}
          className="text-xs h-7"
        >
          <Copy className="h-3 w-3 mr-1" />
          Copiar domingo para todos
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Configure horários diferentes para cada dia da semana. Fora da janela, apenas Produção Extra é permitida.
      </p>

      <div className="space-y-2">
        {janelas.map((janela) => {
          const diaInfo = DIAS_SEMANA.find((d) => d.dia === janela.dia_semana);
          return (
            <div
              key={janela.dia_semana}
              className={`grid grid-cols-[80px_1fr_1fr_50px] gap-2 items-center p-2 rounded ${
                janela.ativo ? 'bg-background' : 'bg-muted/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium w-12">{diaInfo?.abrev}</span>
              </div>

              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground w-10">Início</Label>
                <Input
                  type="time"
                  value={janela.janela_inicio}
                  onChange={(e) =>
                    updateJanela(janela.dia_semana, 'janela_inicio', e.target.value)
                  }
                  disabled={!janela.ativo}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground w-10">Fim</Label>
                <Input
                  type="time"
                  value={janela.janela_fim}
                  onChange={(e) =>
                    updateJanela(janela.dia_semana, 'janela_fim', e.target.value)
                  }
                  disabled={!janela.ativo}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex justify-center">
                <Switch
                  checked={janela.ativo}
                  onCheckedChange={(checked) =>
                    updateJanela(janela.dia_semana, 'ativo', checked)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={salvarJanelas}
          disabled={saving}
          size="sm"
        >
          {saving ? 'Salvando...' : 'Salvar Horários'}
        </Button>
      </div>
    </div>
  );
};
