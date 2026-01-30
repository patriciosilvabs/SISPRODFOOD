import { useState, useMemo } from 'react';
import { Plus, Trash2, Send, Package, Store, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Loja {
  id: string;
  nome: string;
  tipo?: string;
}

interface EstoqueItemCPD {
  item_porcionado_id: string;
  item_nome: string;
  quantidade_disponivel: number;
}

interface ItemRomaneio {
  item_id: string;
  item_nome: string;
  quantidade: number;
  quantidade_maxima: number;
}

interface CriarRomaneioDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lojas: Loja[];
  estoqueCPD: EstoqueItemCPD[];
  onCriarRomaneio: (lojaId: string, lojaNome: string, itens: ItemRomaneio[]) => Promise<void>;
}

export const CriarRomaneioDrawer = ({
  open,
  onOpenChange,
  lojas,
  estoqueCPD,
  onCriarRomaneio,
}: CriarRomaneioDrawerProps) => {
  const [lojaId, setLojaId] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState('');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [itensRomaneio, setItensRomaneio] = useState<ItemRomaneio[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtrar lojas do tipo diferente de CPD
  const lojasDisponiveis = lojas.filter(l => l.tipo !== 'cpd');

  // Filtrar itens não adicionados ainda e com estoque disponível
  const itensDisponiveis = useMemo(() => {
    const idsAdicionados = itensRomaneio.map(i => i.item_id);
    return estoqueCPD.filter(
      item => !idsAdicionados.includes(item.item_porcionado_id) && item.quantidade_disponivel > 0
    );
  }, [estoqueCPD, itensRomaneio]);

  // Obter item selecionado
  const itemAtual = estoqueCPD.find(i => i.item_porcionado_id === itemSelecionado);
  const maxDisponivel = itemAtual?.quantidade_disponivel || 0;

  // Nome da loja selecionada
  const lojaNome = lojasDisponiveis.find(l => l.id === lojaId)?.nome || '';

  const handleAdicionarItem = () => {
    if (!itemSelecionado || quantidade <= 0 || !itemAtual) return;

    const qtdFinal = Math.min(quantidade, maxDisponivel);
    
    setItensRomaneio(prev => [
      ...prev,
      {
        item_id: itemAtual.item_porcionado_id,
        item_nome: itemAtual.item_nome,
        quantidade: qtdFinal,
        quantidade_maxima: maxDisponivel,
      }
    ]);

    // Limpar seleção
    setItemSelecionado('');
    setQuantidade(1);
  };

  const handleRemoverItem = (itemId: string) => {
    setItensRomaneio(prev => prev.filter(i => i.item_id !== itemId));
  };

  const handleCriar = async () => {
    if (!lojaId || itensRomaneio.length === 0) return;

    setLoading(true);
    try {
      await onCriarRomaneio(lojaId, lojaNome, itensRomaneio);
      
      // Limpar estados
      setLojaId('');
      setItemSelecionado('');
      setQuantidade(1);
      setItensRomaneio([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao criar romaneio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLojaId('');
    setItemSelecionado('');
    setQuantidade(1);
    setItensRomaneio([]);
    onOpenChange(false);
  };

  const totalItens = itensRomaneio.reduce((acc, i) => acc + i.quantidade, 0);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Criar Novo Romaneio
          </DrawerTitle>
          <DrawerDescription>
            Selecione a loja destino e adicione os itens do estoque CPD
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-hidden">
          {/* Seleção de Loja */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              Loja Destino
            </Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {lojasDisponiveis.map(loja => (
                  <SelectItem key={loja.id} value={loja.id}>
                    {loja.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Adicionar Item */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Item
            </Label>
            
            {itensDisponiveis.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {estoqueCPD.length === 0 
                  ? 'Nenhum item com estoque disponível no CPD'
                  : 'Todos os itens já foram adicionados'
                }
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Select value={itemSelecionado} onValueChange={setItemSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o item" />
                    </SelectTrigger>
                    <SelectContent>
                      {itensDisponiveis.map(item => (
                        <SelectItem key={item.item_porcionado_id} value={item.item_porcionado_id}>
                          {item.item_nome} ({item.quantidade_disponivel} un)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 items-center">
                  <div className="w-24">
                    <Input
                      type="number"
                      min={1}
                      max={maxDisponivel}
                      value={quantidade}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQuantidade(Math.min(val, maxDisponivel));
                      }}
                      placeholder="Qtd"
                      className="text-center"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">un</span>
                  <Button 
                    onClick={handleAdicionarItem} 
                    variant="outline" 
                    size="sm"
                    disabled={!itemSelecionado || quantidade <= 0}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {itemAtual && (
              <p className="text-xs text-muted-foreground">
                Estoque CPD: {maxDisponivel} un
              </p>
            )}
          </div>

          <Separator />

          {/* Lista de Itens do Romaneio */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Itens do Romaneio
              </span>
              {itensRomaneio.length > 0 && (
                <Badge variant="secondary">
                  {itensRomaneio.length} itens • {totalItens} un
                </Badge>
              )}
            </Label>

            {itensRomaneio.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-lg border-2 border-dashed">
                Nenhum item adicionado
              </div>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {itensRomaneio.map(item => (
                    <div 
                      key={item.item_id} 
                      className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.item_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Máx: {item.quantidade_maxima} un
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="font-mono">
                          {item.quantidade} un
                        </Badge>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => handleRemoverItem(item.item_id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2 pt-2">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            className="flex-1"
            disabled={loading}
          >
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
          <Button 
            onClick={handleCriar} 
            className="flex-1"
            disabled={!lojaId || itensRomaneio.length === 0 || loading}
          >
            <Send className="w-4 h-4 mr-1" />
            Criar Romaneio
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default CriarRomaneioDrawer;
