import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2, ShoppingCart } from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  codigo: string | null;
  unidade_consumo: string | null;
}

interface ItemPedido {
  produto_id: string;
  produto_nome: string;
  quantidade: string;
  unidade: string | null;
}

interface ItemPrefilled {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string | null;
}

interface CriarPedidoCompraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtos: Produto[];
  onCriar: (pedido: {
    numero_pedido: string;
    fornecedor: string;
    data_prevista_entrega: string | null;
    observacao: string;
    itens: Array<{ produto_id: string; produto_nome: string; quantidade: number; unidade: string | null }>;
  }) => Promise<void>;
  saving: boolean;
  itensPrefilled?: ItemPrefilled[];
}

export function CriarPedidoCompraModal({
  open,
  onOpenChange,
  produtos,
  onCriar,
  saving,
  itensPrefilled,
}: CriarPedidoCompraModalProps) {
  const gerarNumeroPedido = () => {
    const hoje = new Date();
    const data = hoje.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PED-${data}-${random}`;
  };

  const [numeroPedido, setNumeroPedido] = useState(gerarNumeroPedido());
  const [fornecedor, setFornecedor] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState("");

  // Pré-popular itens quando modal abrir com itensPrefilled
  useEffect(() => {
    if (open && itensPrefilled && itensPrefilled.length > 0) {
      const itensIniciais = itensPrefilled.map(item => ({
        produto_id: item.id,
        produto_nome: item.nome,
        quantidade: item.quantidade.toFixed(2),
        unidade: item.unidade
      }));
      setItens(itensIniciais);
      setNumeroPedido(gerarNumeroPedido());
    }
  }, [open, itensPrefilled]);

  const handleAdicionarItem = () => {
    if (!produtoSelecionado || !quantidade) return;
    
    const produto = produtos.find(p => p.id === produtoSelecionado);
    if (!produto) return;

    const qtd = parseFloat(quantidade);
    if (isNaN(qtd) || qtd <= 0) return;

    // Verificar se já existe
    const existente = itens.find(i => i.produto_id === produtoSelecionado);
    if (existente) {
      setItens(prev => prev.map(i => 
        i.produto_id === produtoSelecionado 
          ? { ...i, quantidade: (parseFloat(i.quantidade) + qtd).toString() }
          : i
      ));
    } else {
      setItens(prev => [...prev, {
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: quantidade,
        unidade: produto.unidade_consumo,
      }]);
    }

    setProdutoSelecionado("");
    setQuantidade("");
  };

  const handleRemoverItem = (produtoId: string) => {
    setItens(prev => prev.filter(i => i.produto_id !== produtoId));
  };

  const handleCriar = async () => {
    if (!numeroPedido.trim() || !fornecedor.trim() || itens.length === 0) return;

    await onCriar({
      numero_pedido: numeroPedido.trim(),
      fornecedor: fornecedor.trim(),
      data_prevista_entrega: dataPrevista || null,
      observacao: observacao.trim(),
      itens: itens.map(i => ({
        produto_id: i.produto_id,
        produto_nome: i.produto_nome,
        quantidade: parseFloat(i.quantidade),
        unidade: i.unidade,
      })),
    });

    // Reset
    setNumeroPedido("");
    setFornecedor("");
    setDataPrevista("");
    setObservacao("");
    setItens([]);
  };

  const isValid = numeroPedido.trim() && fornecedor.trim() && itens.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Novo Pedido de Compra
          </DialogTitle>
          <DialogDescription>
            Registre um pedido enviado ao fornecedor para posterior conferência
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Dados do pedido */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="numero">Número do Pedido *</Label>
              <Input
                id="numero"
                placeholder="Ex: PED-001"
                value={numeroPedido}
                onChange={(e) => setNumeroPedido(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor *</Label>
              <Input
                id="fornecedor"
                placeholder="Nome do fornecedor"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data Prevista de Entrega</Label>
              <Input
                id="data"
                type="date"
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observação</Label>
              <Input
                id="obs"
                placeholder="Notas adicionais..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>

          {/* Adicionar itens */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <Label className="font-medium">Adicionar Produtos</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.nome} {produto.codigo ? `(${produto.codigo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Qtd"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full sm:w-24"
              />
              <Button 
                type="button" 
                onClick={handleAdicionarItem}
                disabled={!produtoSelecionado || !quantidade}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de itens */}
          {itens.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item) => (
                    <TableRow key={item.produto_id}>
                      <TableCell className="font-medium">{item.produto_nome}</TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantidade} {item.unidade || "un"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoverItem(item.produto_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {itens.length === 0 && (
            <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">
              Adicione produtos ao pedido
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Badge variant="outline">{itens.length} itens</Badge>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCriar} disabled={saving || !isValid}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Criar Pedido
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
