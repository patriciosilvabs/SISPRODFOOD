import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, CheckCircle, Loader2, Store, FolderTree, Info } from 'lucide-react';
import { useCardapioCategoriaMapeamento, type CategoriaAgrupada } from '@/hooks/useCardapioCategoriaMapeamento';

interface CategoriaRegraTabProps {
  lojaId: string;
  lojasParaMapeamento: { id: string; nome: string }[];
  itensPorcionados: { id: string; nome: string }[];
  onLojaChange: (lojaId: string) => void;
}

export function CategoriaRegraTab({
  lojaId,
  lojasParaMapeamento,
  itensPorcionados,
  onLojaChange,
}: CategoriaRegraTabProps) {
  const {
    categoriasAgrupadas,
    categoriasDisponiveis,
    loadingCategorias,
    addMapeamentoCategoria,
    deleteMapeamentoCategoria,
    deleteAllMapeamentosCategorias,
  } = useCardapioCategoriaMapeamento(lojaId);

  const [novaRegraOpen, setNovaRegraOpen] = useState(false);
  const [novaRegra, setNovaRegra] = useState({
    categoria: '',
    categoriaCustom: '',
    tipo: '',
    item_porcionado_id: '',
    quantidade_consumida: '1',
  });

  const handleAddRegra = async () => {
    const categoria = novaRegra.categoria === '__custom__' 
      ? novaRegra.categoriaCustom 
      : novaRegra.categoria;
      
    if (!categoria || !novaRegra.item_porcionado_id || !lojaId) {
      return;
    }

    await addMapeamentoCategoria.mutateAsync({
      loja_id: lojaId,
      categoria,
      tipo: novaRegra.tipo || null,
      item_porcionado_id: novaRegra.item_porcionado_id,
      quantidade_consumida: parseInt(novaRegra.quantidade_consumida) || 1,
    });

    setNovaRegra({
      categoria: '',
      categoriaCustom: '',
      tipo: '',
      item_porcionado_id: '',
      quantidade_consumida: '1',
    });
    setNovaRegraOpen(false);
  };

  const handleDeleteVinculo = async (id: string) => {
    await deleteMapeamentoCategoria.mutateAsync(id);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Regras por Categoria
            </CardTitle>
            <CardDescription>
              Defina regras gerais que se aplicam a todos os produtos de uma categoria.
              Mapeamentos específicos (por produto) têm prioridade sobre regras de categoria.
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <Select value={lojaId} onValueChange={onLojaChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {lojasParaMapeamento.map(loja => (
                  <SelectItem key={loja.id} value={loja.id}>
                    {loja.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 pt-2">
          {categoriasAgrupadas.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Tudo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover todas as regras de categoria desta loja?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div>
                      Esta ação é <strong>permanente</strong>. 
                      Todas as <strong>{categoriasAgrupadas.length}</strong> regras de categoria serão excluídas.
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteAllMapeamentosCategorias.mutate(lojaId)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteAllMapeamentosCategorias.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          <Dialog open={novaRegraOpen} onOpenChange={setNovaRegraOpen}>
            <DialogTrigger asChild>
              <Button disabled={!lojaId}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Regra por Categoria</DialogTitle>
                <DialogDescription>
                  Todos os produtos desta categoria consumirão o item porcionado configurado.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={novaRegra.categoria}
                    onValueChange={(v) => setNovaRegra({ ...novaRegra, categoria: v, categoriaCustom: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione ou digite uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasDisponiveis.map(cat => (
                        <SelectItem key={cat.categoria} value={cat.categoria}>
                          {cat.categoria}
                          {cat.tipo && <span className="text-muted-foreground ml-2">({cat.tipo})</span>}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">
                        <span className="text-primary">+ Digitar categoria manualmente</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {novaRegra.categoria === '__custom__' && (
                    <Input
                      placeholder="Nome da categoria"
                      value={novaRegra.categoriaCustom}
                      onChange={(e) => setNovaRegra({ ...novaRegra, categoriaCustom: e.target.value })}
                      className="mt-2"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tipo (opcional)</Label>
                  <Select
                    value={novaRegra.tipo}
                    onValueChange={(v) => setNovaRegra({ ...novaRegra, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRODUTO">PRODUTO</SelectItem>
                      <SelectItem value="OPÇÃO">OPÇÃO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Item Porcionado</Label>
                  <Select
                    value={novaRegra.item_porcionado_id}
                    onValueChange={(v) => setNovaRegra({ ...novaRegra, item_porcionado_id: v })}
                  >
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
                  <Label>Quantidade por Venda</Label>
                  <Input
                    type="number"
                    min="1"
                    value={novaRegra.quantidade_consumida}
                    onChange={(e) => setNovaRegra({ ...novaRegra, quantidade_consumida: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNovaRegraOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddRegra}
                  disabled={
                    addMapeamentoCategoria.isPending || 
                    (!novaRegra.categoria && !novaRegra.categoriaCustom) || 
                    !novaRegra.item_porcionado_id
                  }
                >
                  {addMapeamentoCategoria.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Criar Regra
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Info box */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Como funciona:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Quando um pedido chega, o sistema primeiro busca um mapeamento <strong>específico</strong> para o item.</li>
              <li>Se não encontrar, busca uma <strong>regra por categoria</strong> como fallback.</li>
              <li>Exemplo: Se "Pizzas" está vinculada a "MASSA", toda pizza sem mapeamento específico consumirá MASSA.</li>
            </ul>
          </div>
        </div>

        {loadingCategorias ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : categoriasAgrupadas.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma regra por categoria configurada</p>
            <p className="text-sm">Adicione regras para aplicar vínculos a categorias inteiras</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item Porcionado</TableHead>
                  <TableHead className="w-20">Qtd</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoriasAgrupadas.map((cat) => (
                  cat.vinculos.map((vinculo, idx) => (
                    <TableRow key={vinculo.id}>
                      {idx === 0 ? (
                        <TableCell rowSpan={cat.vinculos.length} className="font-medium align-top">
                          {cat.categoria}
                        </TableCell>
                      ) : null}
                      {idx === 0 ? (
                        <TableCell rowSpan={cat.vinculos.length} className="align-top">
                          {cat.tipo && (
                            <Badge variant={cat.tipo === 'PRODUTO' ? 'default' : 'secondary'} className="text-xs">
                              {cat.tipo}
                            </Badge>
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          <span>{vinculo.item_porcionado_nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{vinculo.quantidade_consumida}x</Badge>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover regra?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A categoria "{cat.categoria}" não consumirá mais "{vinculo.item_porcionado_nome}" automaticamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteVinculo(vinculo.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
