import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Link2 } from 'lucide-react';

interface VincularEmLoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quantidadeSelecionados: number;
  itensPorcionados: { id: string; nome: string }[];
  onConfirm: (vinculos: { itemPorcionadoId: string; quantidade: number }[]) => Promise<void>;
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
  // Map: itemPorcionadoId -> quantidade
  const [selecoes, setSelecoes] = useState<Map<string, number>>(new Map());

  const toggleItem = (id: string, checked: boolean | 'indeterminate') => {
    setSelecoes(prev => {
      const novo = new Map(prev);
      if (checked === true) {
        novo.set(id, 1); // Default quantidade = 1
      } else {
        novo.delete(id);
      }
      return novo;
    });
  };

  const updateQuantidade = (id: string, quantidade: number) => {
    setSelecoes(prev => {
      const novo = new Map(prev);
      if (quantidade > 0) {
        novo.set(id, quantidade);
      }
      return novo;
    });
  };

  const handleConfirm = async () => {
    if (selecoes.size === 0) return;
    
    const vinculos = Array.from(selecoes.entries()).map(([id, qtd]) => ({
      itemPorcionadoId: id,
      quantidade: qtd
    }));
    
    await onConfirm(vinculos);
    setSelecoes(new Map());
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelecoes(new Map());
    }
    onOpenChange(newOpen);
  };

  // Get selected items for summary
  const itensSelecionados = itensPorcionados.filter(item => selecoes.has(item.id));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular em Lote
          </DialogTitle>
          <DialogDescription>
            Vincule <strong>{quantidadeSelecionados}</strong> produto(s) selecionado(s) aos itens porcionados abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Itens Porcionados</Label>
            <ScrollArea className="h-[280px] border rounded-md">
              <div className="p-2 space-y-1">
                {itensPorcionados.map(item => {
                  const isSelected = selecoes.has(item.id);
                  const quantidade = selecoes.get(item.id) || 1;
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`flex items-center gap-3 p-2 rounded transition-colors ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => toggleItem(item.id, checked)}
                      />
                      <span className="flex-1 text-sm truncate" title={item.nome}>
                        {item.nome}
                      </span>
                      {isSelected && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">Qtd:</span>
                          <Input
                            type="number"
                            min="1"
                            className="w-16 h-7 text-center"
                            value={quantidade}
                            onChange={(e) => updateQuantidade(item.id, parseInt(e.target.value) || 1)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {itensSelecionados.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium mb-1">Resumo:</p>
              <p className="text-muted-foreground mb-2">
                {quantidadeSelecionados} produto(s) serão vinculados a:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {itensSelecionados.map(item => (
                  <li key={item.id}>
                    {item.nome} ({selecoes.get(item.id)}x)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={selecoes.size === 0 || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vincular {quantidadeSelecionados} Produtos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
