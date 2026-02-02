import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Link2 } from 'lucide-react';

interface VincularEmLoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quantidadeSelecionados: number;
  itensPorcionados: { id: string; nome: string }[];
  onConfirm: (itemPorcionadoId: string, quantidade: number) => Promise<void>;
  isLoading?: boolean;
}

export function VincularEmLoteModal({
  open,
  onOpenChange,
  quantidadeSelecionados,
  itensPorcionados,
  onConfirm,
  isLoading = false,
}: VincularEmLoteModalProps) {
  const [itemPorcionadoId, setItemPorcionadoId] = useState('');
  const [quantidade, setQuantidade] = useState('1');

  const handleConfirm = async () => {
    if (!itemPorcionadoId) return;
    await onConfirm(itemPorcionadoId, parseInt(quantidade) || 1);
    setItemPorcionadoId('');
    setQuantidade('1');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setItemPorcionadoId('');
      setQuantidade('1');
    }
    onOpenChange(newOpen);
  };

  const itemSelecionado = itensPorcionados.find(i => i.id === itemPorcionadoId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular em Lote
          </DialogTitle>
          <DialogDescription>
            Vincule <strong>{quantidadeSelecionados}</strong> produto(s) selecionado(s) ao mesmo item porcionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Item Porcionado</Label>
            <Select value={itemPorcionadoId} onValueChange={setItemPorcionadoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o item porcionado" />
              </SelectTrigger>
              <SelectContent>
                {itensPorcionados.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantidade Consumida</Label>
            <Input
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Quantos itens porcionados são consumidos por unidade vendida
            </p>
          </div>

          {itemPorcionadoId && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium">Resumo:</p>
              <p className="text-muted-foreground">
                {quantidadeSelecionados} produto(s) serão vinculados a "{itemSelecionado?.nome}" 
                com consumo de {quantidade}x por unidade vendida.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!itemPorcionadoId || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vincular {quantidadeSelecionados} Produtos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
