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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface ItemPorcionado {
  id: string;
  nome: string;
}

interface AdicionarVinculoCardapioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoNome: string;
  itensPorcionados: ItemPorcionado[];
  onConfirm: (itemPorcionadoId: string, quantidade: number) => Promise<void>;
  isLoading?: boolean;
}

export function AdicionarVinculoCardapioModal({
  open,
  onOpenChange,
  produtoNome,
  itensPorcionados,
  onConfirm,
  isLoading = false,
}: AdicionarVinculoCardapioModalProps) {
  const [itemPorcionadoId, setItemPorcionadoId] = useState('');
  const [quantidade, setQuantidade] = useState('1');

  const handleConfirm = async () => {
    if (!itemPorcionadoId) return;
    await onConfirm(itemPorcionadoId, parseInt(quantidade) || 1);
    setItemPorcionadoId('');
    setQuantidade('1');
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setItemPorcionadoId('');
      setQuantidade('1');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Item Vinculado</DialogTitle>
          <DialogDescription>
            Adicionar um item porcionado ao produto <strong>{produtoNome}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Item Porcionado</Label>
            <Select value={itemPorcionadoId} onValueChange={setItemPorcionadoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o item" />
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
              Quantos itens porcionados são consumidos por unidade do produto
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!itemPorcionadoId || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
