import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, CheckCircle2, Pencil, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Produto {
  nome: string;
  codigo: string;
  categoria: string;
  unidade_consumo: string;
  classificacao: string;
  selecionado?: boolean;
  editando?: boolean;
}

interface ImportarProdutosIAModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const categoriaLabels: Record<string, string> = {
  congelado: "Congelado",
  refrigerado: "Refrigerado",
  ambiente: "Ambiente",
  diversos: "Diversos",
  material_escritorio: "Material de Escritório",
  material_limpeza: "Material de Limpeza",
  embalagens: "Embalagens",
  descartaveis: "Descartáveis",
  equipamentos: "Equipamentos",
};

export function ImportarProdutosIAModal({ open, onClose, onSuccess }: ImportarProdutosIAModalProps) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [texto, setTexto] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const handleClose = () => {
    setEtapa(1);
    setTexto("");
    setProdutos([]);
    onClose();
  };

  const handleProcessar = async () => {
    if (!texto.trim()) {
      toast({
        title: "Erro",
        description: "Digite ou cole uma lista de produtos para processar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('processar-produtos-ia', {
        body: { texto }
      });

      if (error) throw error;

      if (!data?.produtos || data.produtos.length === 0) {
        toast({
          title: "Nenhum produto identificado",
          description: "A IA não conseguiu identificar produtos no texto fornecido",
          variant: "destructive",
        });
        return;
      }

      const produtosComSelecao = data.produtos.map((p: Produto) => ({
        ...p,
        selecionado: true,
        editando: false,
      }));

      setProdutos(produtosComSelecao);
      setEtapa(2);
      
      toast({
        title: "Produtos identificados!",
        description: `${data.produtos.length} produtos foram extraídos pela IA`,
      });
    } catch (error: any) {
      console.error('Erro ao processar com IA:', error);
      toast({
        title: "Erro ao processar",
        description: error.message || "Não foi possível processar o texto com IA",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    const produtosSelecionados = produtos.filter(p => p.selecionado);
    
    if (produtosSelecionados.length === 0) {
      toast({
        title: "Nenhum produto selecionado",
        description: "Selecione ao menos um produto para salvar",
        variant: "destructive",
      });
      return;
    }

    setSalvando(true);
    try {
      const produtosParaInserir = produtosSelecionados.map(p => ({
        nome: p.nome,
        codigo: p.codigo,
        categoria: p.categoria as any,
        unidade_consumo: p.unidade_consumo,
        classificacao: p.classificacao,
      }));

      const { error } = await supabase
        .from('produtos')
        .insert(produtosParaInserir);

      if (error) throw error;

      setEtapa(3);
      onSuccess();
      
      toast({
        title: "Produtos salvos!",
        description: `${produtosSelecionados.length} produtos foram adicionados com sucesso`,
      });

      // Fechar modal após 2 segundos
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error: any) {
      console.error('Erro ao salvar produtos:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar os produtos",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  const toggleSelecao = (index: number) => {
    setProdutos(produtos.map((p, i) => 
      i === index ? { ...p, selecionado: !p.selecionado } : p
    ));
  };

  const toggleSelecionarTodos = () => {
    const todosSelecionados = produtos.every(p => p.selecionado);
    setProdutos(produtos.map(p => ({ ...p, selecionado: !todosSelecionados })));
  };

  const toggleEdicao = (index: number) => {
    setProdutos(produtos.map((p, i) => 
      i === index ? { ...p, editando: !p.editando } : p
    ));
  };

  const atualizarProduto = (index: number, campo: keyof Produto, valor: string) => {
    setProdutos(produtos.map((p, i) => 
      i === index ? { ...p, [campo]: valor } : p
    ));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Adicionar Produtos em Lote com IA
          </DialogTitle>
        </DialogHeader>

        {/* ETAPA 1: ENTRADA DE TEXTO */}
        {etapa === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Cole ou digite a lista de produtos:
              </label>
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Exemplo:&#10;Bobina térmica 80mm - material escritório&#10;Detergente 5L - limpeza - código DET-001&#10;Caixa hamburguer kraft - embalagem - A&#10;Luva descartável M - descartáveis"
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
            
            <div className="bg-muted/50 p-3 rounded-md text-sm text-muted-foreground">
              💡 <strong>Dica:</strong> Você pode colar de uma planilha ou lista. A IA identificará automaticamente os produtos e seus atributos.
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleProcessar} disabled={loading || !texto.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Processar com IA
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 2: REVISÃO DOS PRODUTOS */}
        {etapa === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                ✅ {produtos.length} produtos identificados pela IA
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={produtos.every(p => p.selecionado)}
                  onCheckedChange={toggleSelecionarTodos}
                />
                <span className="text-sm">Selecionar todos</span>
              </div>
            </div>

            <ScrollArea className="h-[400px] border rounded-md">
              <div className="p-4 space-y-2">
                {produtos.map((produto, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={produto.selecionado}
                        onCheckedChange={() => toggleSelecao(index)}
                        className="mt-1"
                      />
                      
                      {produto.editando ? (
                        <div className="flex-1 grid grid-cols-5 gap-2">
                          <Input
                            value={produto.nome}
                            onChange={(e) => atualizarProduto(index, 'nome', e.target.value)}
                            placeholder="Nome"
                            className="col-span-2"
                          />
                          <Input
                            value={produto.codigo}
                            onChange={(e) => atualizarProduto(index, 'codigo', e.target.value)}
                            placeholder="Código"
                          />
                          <Select
                            value={produto.categoria}
                            onValueChange={(value) => atualizarProduto(index, 'categoria', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(categoriaLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={produto.unidade_consumo}
                            onChange={(e) => atualizarProduto(index, 'unidade_consumo', e.target.value)}
                            placeholder="Unidade"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 grid grid-cols-5 gap-2 text-sm">
                          <div className="col-span-2 font-medium">{produto.nome}</div>
                          <div className="text-muted-foreground">{produto.codigo}</div>
                          <div className="text-muted-foreground">{categoriaLabels[produto.categoria]}</div>
                          <div className="text-muted-foreground">{produto.unidade_consumo}</div>
                        </div>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleEdicao(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {produto.editando && (
                      <div className="flex gap-2 items-center pl-9">
                        <label className="text-sm text-muted-foreground">Classificação:</label>
                        <Select
                          value={produto.classificacao}
                          onValueChange={(value) => atualizarProduto(index, 'classificacao', value)}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                            <SelectItem value="C">C</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-md text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Revise os dados antes de confirmar. Você pode editar qualquer informação clicando no ícone de lápis.
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setEtapa(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button 
                onClick={handleSalvar} 
                disabled={salvando || produtos.filter(p => p.selecionado).length === 0}
              >
                {salvando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  `Salvar ${produtos.filter(p => p.selecionado).length} Produtos`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 3: SUCESSO */}
        {etapa === 3 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">
                {produtos.filter(p => p.selecionado).length} produtos adicionados com sucesso!
              </h3>
              <p className="text-sm text-muted-foreground">
                A janela será fechada automaticamente
              </p>
            </div>
            <Button onClick={handleClose}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}