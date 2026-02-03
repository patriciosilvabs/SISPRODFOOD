import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Search, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { type MapeamentoCardapioItemAgrupado } from '@/hooks/useCardapioWebIntegracao';

interface MapearPorInsumoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itensPorcionados: { id: string; nome: string }[];
  produtosDisponiveis: MapeamentoCardapioItemAgrupado[];
  lojaId: string;
  onConfirm: (data: {
    item_porcionado_id: string;
    produtos: Array<{
      cardapio_item_id: number;
      cardapio_item_nome: string;
      tipo: string | null;
      categoria: string | null;
      quantidade_consumida: number;
    }>;
  }) => Promise<void>;
  isLoading?: boolean;
}

interface ProdutoSelecionado {
  cardapio_item_id: number;
  cardapio_item_nome: string;
  tipo: string | null;
  categoria: string | null;
  quantidade_consumida: number;
}

export function MapearPorInsumoModal({
  open,
  onOpenChange,
  itensPorcionados,
  produtosDisponiveis,
  onConfirm,
  isLoading = false,
}: MapearPorInsumoModalProps) {
  const [itemPorcionadoSelecionado, setItemPorcionadoSelecionado] = useState<string>('');
  const [termoBusca, setTermoBusca] = useState('');
  // Map: cardapio_item_id -> quantidade
  const [produtosSelecionados, setProdutosSelecionados] = useState<Map<number, ProdutoSelecionado>>(new Map());

  // Filter products by search term (minimum 2 characters)
  const produtosFiltrados = useMemo(() => {
    if (termoBusca.trim().length < 2) return [];
    
    const termo = termoBusca.toLowerCase().trim();
    const filtrados = produtosDisponiveis.filter(p => 
      p.cardapio_item_nome.toLowerCase().includes(termo)
    );
    
    // Limit to 50 items for performance
    return filtrados.slice(0, 50);
  }, [produtosDisponiveis, termoBusca]);

  // Check if a product is already linked to the selected item
  const produtoJaVinculado = (produto: MapeamentoCardapioItemAgrupado): boolean => {
    if (!itemPorcionadoSelecionado) return false;
    return produto.vinculos.some(v => v.item_porcionado_id === itemPorcionadoSelecionado);
  };

  // Get name of the item that the product is already linked to (if any)
  const getVinculoExistente = (produto: MapeamentoCardapioItemAgrupado): string | null => {
    const vinculosComItem = produto.vinculos.filter(v => v.item_porcionado_nome);
    if (vinculosComItem.length === 0) return null;
    return vinculosComItem.map(v => v.item_porcionado_nome).join(', ');
  };

  const toggleProduto = (produto: MapeamentoCardapioItemAgrupado, checked: boolean | 'indeterminate') => {
    setProdutosSelecionados(prev => {
      const novo = new Map(prev);
      if (checked === true) {
        novo.set(produto.cardapio_item_id, {
          cardapio_item_id: produto.cardapio_item_id,
          cardapio_item_nome: produto.cardapio_item_nome,
          tipo: produto.tipo,
          categoria: produto.categoria,
          quantidade_consumida: 1,
        });
      } else {
        novo.delete(produto.cardapio_item_id);
      }
      return novo;
    });
  };

  const updateQuantidade = (cardapioItemId: number, quantidade: number) => {
    setProdutosSelecionados(prev => {
      const novo = new Map(prev);
      const produto = novo.get(cardapioItemId);
      if (produto && quantidade > 0) {
        novo.set(cardapioItemId, { ...produto, quantidade_consumida: quantidade });
      }
      return novo;
    });
  };

  const selecionarTodos = () => {
    const novaSeleção = new Map(produtosSelecionados);
    produtosFiltrados
      .filter(p => !produtoJaVinculado(p))
      .forEach(p => {
        if (!novaSeleção.has(p.cardapio_item_id)) {
          novaSeleção.set(p.cardapio_item_id, {
            cardapio_item_id: p.cardapio_item_id,
            cardapio_item_nome: p.cardapio_item_nome,
            tipo: p.tipo,
            categoria: p.categoria,
            quantidade_consumida: 1,
          });
        }
      });
    setProdutosSelecionados(novaSeleção);
  };

  const desmarcarTodos = () => {
    const novaSeleção = new Map(produtosSelecionados);
    produtosFiltrados.forEach(p => novaSeleção.delete(p.cardapio_item_id));
    setProdutosSelecionados(novaSeleção);
  };

  const handleConfirm = async () => {
    if (!itemPorcionadoSelecionado || produtosSelecionados.size === 0) return;
    
    const produtos = Array.from(produtosSelecionados.values());
    
    await onConfirm({
      item_porcionado_id: itemPorcionadoSelecionado,
      produtos,
    });
    
    // Reset state on success
    setItemPorcionadoSelecionado('');
    setTermoBusca('');
    setProdutosSelecionados(new Map());
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setItemPorcionadoSelecionado('');
      setTermoBusca('');
      setProdutosSelecionados(new Map());
    }
    onOpenChange(newOpen);
  };

  // Get selected item name for display
  const itemPorcionadoNome = itensPorcionados.find(i => i.id === itemPorcionadoSelecionado)?.nome || '';

  // Count how many filtered products are already selected
  const todosFiltradosSelecionados = produtosFiltrados
    .filter(p => !produtoJaVinculado(p))
    .every(p => produtosSelecionados.has(p.cardapio_item_id));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Mapear por Insumo
          </DialogTitle>
          <DialogDescription>
            Selecione um item porcionado e vincule múltiplos produtos do cardápio de uma só vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
          {/* Select Item Porcionado */}
          <div className="space-y-2">
            <Label>Item Porcionado</Label>
            <Select value={itemPorcionadoSelecionado} onValueChange={setItemPorcionadoSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o item a vincular..." />
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

          {/* Search Products */}
          <div className="space-y-2">
            <Label>Buscar produtos</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite pelo menos 2 caracteres..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="pl-9"
                disabled={!itemPorcionadoSelecionado}
              />
            </div>
            {termoBusca.length > 0 && termoBusca.length < 2 && (
              <p className="text-xs text-muted-foreground">Digite pelo menos 2 caracteres para buscar</p>
            )}
          </div>

          {/* Products List */}
          {termoBusca.length >= 2 && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Produtos encontrados ({produtosFiltrados.length})
                  {produtosFiltrados.length === 50 && (
                    <span className="text-xs text-muted-foreground ml-1">(limitado a 50)</span>
                  )}
                </Label>
                {produtosFiltrados.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={todosFiltradosSelecionados ? desmarcarTodos : selecionarTodos}
                    className="h-7 text-xs"
                  >
                    {todosFiltradosSelecionados ? (
                      <>
                        <Square className="h-3.5 w-3.5 mr-1.5" />
                        Desmarcar Todos
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                        Selecionar Todos
                      </>
                    )}
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 border rounded-md max-h-[300px]">
                <div className="p-2 space-y-1">
                  {produtosFiltrados.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum produto encontrado com "{termoBusca}"
                    </p>
                  ) : (
                    produtosFiltrados.map(produto => {
                      const isSelected = produtosSelecionados.has(produto.cardapio_item_id);
                      const jaVinculado = produtoJaVinculado(produto);
                      const vinculoExistente = getVinculoExistente(produto);
                      const quantidade = produtosSelecionados.get(produto.cardapio_item_id)?.quantidade_consumida || 1;
                      
                      return (
                        <div 
                          key={produto.cardapio_item_id}
                          className={`flex items-center gap-3 p-2 rounded transition-colors ${
                            jaVinculado 
                              ? 'bg-muted/30 opacity-60' 
                              : isSelected 
                                ? 'bg-primary/10' 
                                : 'hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleProduto(produto, checked)}
                            disabled={jaVinculado}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" title={produto.cardapio_item_nome}>
                              {produto.cardapio_item_nome}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">#{produto.cardapio_item_id}</span>
                              {vinculoExistente && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <AlertCircle className="h-3 w-3" />
                                  {jaVinculado ? 'Já vinculado' : vinculoExistente}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && !jaVinculado && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-muted-foreground">Qtd:</span>
                              <Input
                                type="number"
                                min="0.1"
                                step="0.1"
                                className="w-16 h-7 text-center"
                                value={quantidade}
                                onChange={(e) => updateQuantidade(
                                  produto.cardapio_item_id, 
                                  parseFloat(e.target.value) || 1
                                )}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Summary */}
          {produtosSelecionados.size > 0 && itemPorcionadoSelecionado && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                {produtosSelecionados.size} produto(s) serão vinculados a:
              </p>
              <Badge variant="secondary" className="mt-1">
                {itemPorcionadoNome}
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!itemPorcionadoSelecionado || produtosSelecionados.size === 0 || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar {produtosSelecionados.size} Vínculos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
