import { useState, useEffect, useMemo } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Plus, Minus, AlertTriangle } from 'lucide-react';
import { useMovimentacaoEstoque, TipoMovimentacao, CORES_MOVIMENTACAO } from '@/hooks/useMovimentacaoEstoque';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

interface AjustarEstoquePorcionadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    nome: string;
    peso_unitario_g?: number;
  };
  estoqueAtual: number;
  lojaId: string;
  lojaNome: string;
  onSuccess?: () => void;
}

type TipoAjuste = 'ajuste_positivo' | 'ajuste_negativo' | 'perda';

export function AjustarEstoquePorcionadoModal({
  open,
  onOpenChange,
  item,
  estoqueAtual,
  lojaId,
  lojaNome,
  onSuccess,
}: AjustarEstoquePorcionadoModalProps) {
  const { user, profile } = useAuth();
  const { organizationId } = useOrganization();
  const { registrarMovimentacao, isProcessing } = useMovimentacaoEstoque();

  const [tipoAjuste, setTipoAjuste] = useState<TipoAjuste>('ajuste_negativo');
  const [quantidade, setQuantidade] = useState<number>(0);
  const [observacao, setObservacao] = useState('');

  // Reset form quando o modal abre
  useEffect(() => {
    if (open) {
      setTipoAjuste('ajuste_negativo');
      setQuantidade(0);
      setObservacao('');
    }
  }, [open]);

  // Calcular estoque resultante
  const estoqueResultante = useMemo(() => {
    if (tipoAjuste === 'ajuste_positivo') {
      return estoqueAtual + quantidade;
    }
    return estoqueAtual - quantidade;
  }, [estoqueAtual, quantidade, tipoAjuste]);

  // Validações
  const validacoes = useMemo(() => {
    const erros: string[] = [];
    
    if (quantidade <= 0) {
      erros.push('Quantidade deve ser maior que zero');
    }
    
    if (observacao.trim().length < 10) {
      erros.push('Motivo deve ter pelo menos 10 caracteres');
    }
    
    if (tipoAjuste !== 'ajuste_positivo' && estoqueResultante < 0) {
      erros.push('Estoque resultante não pode ser negativo');
    }
    
    return erros;
  }, [quantidade, observacao, tipoAjuste, estoqueResultante]);

  const podeConfirmar = validacoes.length === 0 && !isProcessing;

  const handleConfirmar = async () => {
    if (!podeConfirmar || !user || !organizationId) return;

    try {
      // 1. Registrar movimentação no log
      const result = await registrarMovimentacao({
        entidadeTipo: 'porcionado',
        entidadeId: item.id,
        entidadeNome: item.nome,
        tipoMovimentacao: tipoAjuste as TipoMovimentacao,
        quantidade,
        unidadeOrigem: lojaNome,
        observacao: observacao.trim(),
      });

      if (!result.success) {
        return; // Toast já foi exibido pelo hook
      }

      // 2. Atualizar o estoque físico na contagem_porcionados
      const { data: dataServidor } = await supabase.rpc('get_current_date');
      const diaOperacional = dataServidor || new Date().toISOString().split('T')[0];

      // Buscar contagem existente
      const { data: contagemExistente, error: fetchError } = await supabase
        .from('contagem_porcionados')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('item_porcionado_id', item.id)
        .eq('dia_operacional', diaOperacional)
        .maybeSingle();

      if (fetchError) {
        console.error('Erro ao buscar contagem:', fetchError);
        toast.error('Erro ao atualizar estoque');
        return;
      }

      const novoEstoque = estoqueResultante;

      if (contagemExistente) {
        // Atualizar registro existente
        const { error: updateError } = await supabase
          .from('contagem_porcionados')
          .update({
            final_sobra: novoEstoque,
            updated_at: new Date().toISOString(),
            usuario_id: user.id,
            usuario_nome: profile?.nome || user.email || 'Usuário',
          })
          .eq('id', contagemExistente.id);

        if (updateError) {
          console.error('Erro ao atualizar contagem:', updateError);
          toast.error('Erro ao atualizar estoque');
          return;
        }
      } else {
        // Criar novo registro
        const { error: insertError } = await supabase
          .from('contagem_porcionados')
          .insert({
            loja_id: lojaId,
            item_porcionado_id: item.id,
            dia_operacional: diaOperacional,
            final_sobra: novoEstoque,
            ideal_amanha: 0,
            usuario_id: user.id,
            usuario_nome: profile?.nome || user.email || 'Usuário',
            organization_id: organizationId,
          });

        if (insertError) {
          console.error('Erro ao criar contagem:', insertError);
          toast.error('Erro ao atualizar estoque');
          return;
        }
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast.error('Erro inesperado ao processar ajuste');
    }
  };

  const ajusteInfo = CORES_MOVIMENTACAO[tipoAjuste];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Ajustar Estoque: {item.nome}
          </DialogTitle>
          <DialogDescription>
            Registre ajustes de auditoria, perdas ou correções de inventário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Estoque Atual */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium text-muted-foreground">Estoque Atual</span>
            <span className="text-xl font-bold">{estoqueAtual} unidades</span>
          </div>

          {/* Tipo de Ajuste */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de Ajuste</Label>
            <RadioGroup
              value={tipoAjuste}
              onValueChange={(v) => setTipoAjuste(v as TipoAjuste)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="ajuste_positivo" id="ajuste_positivo" />
                <Label htmlFor="ajuste_positivo" className="flex items-center gap-2 cursor-pointer">
                  <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Ajuste Positivo (+)</span>
                  <span className="text-xs text-muted-foreground">Encontrado a mais</span>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="ajuste_negativo" id="ajuste_negativo" />
                <Label htmlFor="ajuste_negativo" className="flex items-center gap-2 cursor-pointer">
                  <Minus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Ajuste Negativo (-)</span>
                  <span className="text-xs text-muted-foreground">Encontrado a menos</span>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="perda" id="perda" />
                <Label htmlFor="perda" className="flex items-center gap-2 cursor-pointer">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span>Registrar Perda</span>
                  <span className="text-xs text-muted-foreground">Quebra, vencimento, etc</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Quantidade */}
          <div className="space-y-2">
            <Label htmlFor="quantidade" className="text-sm font-medium">
              Quantidade (unidades)
            </Label>
            <Input
              id="quantidade"
              type="number"
              min={1}
              value={quantidade || ''}
              onChange={(e) => setQuantidade(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="Digite a quantidade"
              className="text-lg"
            />
          </div>

          {/* Motivo/Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao" className="text-sm font-medium">
              Motivo (obrigatório) <span className="text-muted-foreground text-xs">mínimo 10 caracteres</span>
            </Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Descreva o motivo do ajuste (ex: Contagem de auditoria, produto vencido, etc)"
              rows={3}
              className="resize-none"
            />
            <div className="text-xs text-muted-foreground text-right">
              {observacao.trim().length} / 10 caracteres mínimos
            </div>
          </div>

          {/* Estoque Resultante */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${ajusteInfo.bg}`}>
            <span className={`text-sm font-medium ${ajusteInfo.text}`}>Estoque Resultante</span>
            <span className={`text-xl font-bold ${ajusteInfo.text}`}>
              {estoqueResultante} unidades
            </span>
          </div>

          {/* Erros de Validação */}
          {validacoes.length > 0 && quantidade > 0 && (
            <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <ul className="text-sm text-destructive space-y-1">
                {validacoes.map((erro, i) => (
                  <li key={i}>• {erro}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!podeConfirmar}
            className={tipoAjuste === 'perda' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Ajuste'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
