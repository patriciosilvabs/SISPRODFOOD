import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { numberToWords } from '@/lib/numberToWords';

interface SolicitarProducaoExtraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    nome: string;
  };
  loja: {
    id: string;
    nome: string;
  };
  diaOperacional: string;
  demandaAtual: number;
  producaoAtual: number;
  organizationId: string;
  userId: string;
  onSuccess: () => void;
}

const MOTIVOS_PRODUCAO_EXTRA = [
  { value: 'pedido_extra', label: 'Pedido extra' },
  { value: 'erro_calculo', label: 'Erro de cálculo' },
  { value: 'evento_especial', label: 'Evento especial' },
  { value: 'reposicao_emergencia', label: 'Reposição de emergência' },
  { value: 'outro', label: 'Outro' },
];

export function SolicitarProducaoExtraModal({
  open,
  onOpenChange,
  item,
  loja,
  diaOperacional,
  demandaAtual,
  producaoAtual,
  organizationId,
  userId,
  onSuccess,
}: SolicitarProducaoExtraModalProps) {
  const [quantidadeExtra, setQuantidadeExtra] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quantidadeExtraNum = parseInt(quantidadeExtra) || 0;
  const novaDemandaTotal = demandaAtual + quantidadeExtraNum;
  const demandaCoberta = producaoAtual >= novaDemandaTotal;
  const lotesExtrasEstimados = demandaCoberta ? 0 : Math.ceil((novaDemandaTotal - producaoAtual) / 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quantidadeExtraNum <= 0) {
      toast.error('Informe uma quantidade válida maior que zero');
      return;
    }

    if (!motivo) {
      toast.error('Selecione um motivo para a produção extra');
      return;
    }

    setIsSubmitting(true);

    try {
      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', userId)
        .single();

      const usuarioNome = profile?.nome || 'Usuário';

      // Registrar a solicitação na tabela contagem_porcionados como incremento
      const { error: contagemError } = await supabase
        .from('contagem_porcionados')
        .upsert({
          loja_id: loja.id,
          item_porcionado_id: item.id,
          dia_operacional: diaOperacional,
          final_sobra: 0, // Não altera a sobra, apenas registra o incremento
          peso_total_g: null,
          ideal_amanha: novaDemandaTotal,
          a_produzir: quantidadeExtraNum,
          usuario_id: userId,
          usuario_nome: usuarioNome,
          organization_id: organizationId,
          is_incremento: true,
          motivo_incremento: `${MOTIVOS_PRODUCAO_EXTRA.find(m => m.value === motivo)?.label || motivo}${observacao ? `: ${observacao}` : ''}`,
        }, {
          onConflict: 'loja_id,item_porcionado_id,dia_operacional',
        });

      if (contagemError) {
        console.error('Erro ao registrar incremento:', contagemError);
      }

      // Chamar RPC para criar/atualizar lotes de produção
      const { data: rpcResult, error: rpcError } = await supabase.rpc('criar_ou_atualizar_producao_registro', {
        p_item_id: item.id,
        p_organization_id: organizationId,
        p_usuario_id: userId,
        p_usuario_nome: usuarioNome,
        p_dia_operacional: diaOperacional,
      });

      if (rpcError) {
        console.error('Erro ao atualizar produção:', rpcError);
        toast.error('Erro ao processar solicitação. Tente novamente.');
        setIsSubmitting(false);
        return;
      }

      // Verificar resultado
      if (demandaCoberta) {
        toast.success(
          `Solicitação registrada! A produção atual (${producaoAtual} un) já cobre a nova demanda (${novaDemandaTotal} un).`,
          { duration: 5000 }
        );
      } else {
        toast.success(
          `✅ Produção extra de +${quantidadeExtraNum} unidades solicitada! Lotes adicionais serão criados.`,
          { duration: 5000 }
        );
      }

      // Reset form e fechar
      setQuantidadeExtra('');
      setMotivo('');
      setObservacao('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao solicitar produção extra:', error);
      toast.error('Erro ao processar solicitação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Solicitar Produção Extra
          </DialogTitle>
          <DialogDescription>
            Adicione demanda incremental sem alterar os valores de contagem
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Info do Item */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <span className="font-semibold">{item.nome}</span>
              <span className="text-sm text-muted-foreground ml-2">• {loja.nome}</span>
            </div>
          </div>

          {/* Resumo da Produção Atual */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground">Demanda Atual</p>
              <p className="text-xl font-bold text-foreground">{demandaAtual} un</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground">Produção Programada</p>
              <p className="text-xl font-bold text-primary">{producaoAtual} un</p>
            </div>
          </div>

          {/* Campo de Quantidade Extra */}
          <div className="space-y-2">
            <Label htmlFor="quantidade-extra" className="text-base font-medium">
              Quantidade Adicional <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quantidade-extra"
              type="number"
              placeholder="Ex: 20"
              value={quantidadeExtra}
              onChange={(e) => setQuantidadeExtra(e.target.value)}
              required
              min="1"
              className="text-lg"
            />
            {quantidadeExtraNum > 0 && (
              <p className="text-sm font-medium text-primary">
                +{numberToWords(quantidadeExtra, 'unidade')}
              </p>
            )}
          </div>

          {/* Prévia da Nova Demanda */}
          {quantidadeExtraNum > 0 && (
            <div className={`p-3 rounded-lg border-2 ${
              demandaCoberta 
                ? 'bg-green-50 dark:bg-green-950 border-green-500' 
                : 'bg-amber-50 dark:bg-amber-950 border-amber-500'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Prévia</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nova Demanda Total:</span>
                  <p className="font-bold text-lg">{novaDemandaTotal} un</p>
                </div>
                <div>
                  {demandaCoberta ? (
                    <>
                      <span className="text-green-600 dark:text-green-400">Demanda coberta!</span>
                      <p className="text-sm text-muted-foreground">
                        Folga: {producaoAtual - novaDemandaTotal} un
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-amber-600 dark:text-amber-400">Lotes extras:</span>
                      <p className="font-bold">~{lotesExtrasEstimados} lote(s)</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo" className="text-base font-medium">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger id="motivo">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_PRODUCAO_EXTRA.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao" className="text-base font-medium">
              Observação <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="observacao"
              placeholder="Detalhes adicionais sobre a solicitação..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>

          {/* Alerta informativo */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Esta solicitação não altera os valores de contagem já registrados. 
              Lotes adicionais serão criados automaticamente se a produção atual não cobrir a nova demanda.
            </p>
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
            <Button 
              type="submit" 
              disabled={isSubmitting || quantidadeExtraNum <= 0 || !motivo}
            >
              {isSubmitting ? 'Processando...' : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Solicitar +{quantidadeExtraNum || 0} un
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
