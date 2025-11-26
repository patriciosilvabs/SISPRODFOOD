import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Sparkles, Pencil, Trash2, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProdutoFormModal } from '@/components/modals/ProdutoFormModal';
import { DeleteProdutoDialog } from '@/components/modals/DeleteProdutoDialog';
import { ImportarProdutosIAModal } from '@/components/modals/ImportarProdutosIAModal';
import { ConfigurarEstoqueMinimoModal } from '@/components/modals/ConfigurarEstoqueMinimoModal';

interface Produto {
  id: string;
  nome: string;
  codigo: string | null;
  categoria: string;
  unidade_consumo: string | null;
  classificacao: string | null;
  created_at: string;
  updated_at: string | null;
}

const categoriaLabels: Record<string, string> = {
  'congelado': 'Congelado',
  'refrigerado': 'Refrigerado',
  'ambiente': 'Ambiente',
  'diversos': 'Diversos',
  'material_escritorio': 'Mat. Escritório',
  'material_limpeza': 'Mat. Limpeza',
  'embalagens': 'Embalagens',
  'descartaveis': 'Descartáveis',
  'equipamentos': 'Equipamentos',
};

const GerenciarProdutos = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [deletingProduto, setDeletingProduto] = useState<Produto | null>(null);
  const [importarIAOpen, setImportarIAOpen] = useState(false);
  const [estoqueModalOpen, setEstoqueModalOpen] = useState(false);

  useEffect(() => {
    fetchProdutos();
  }, []);

  useEffect(() => {
    filterProdutos();
  }, [produtos, categoriaFilter, searchQuery]);

  const fetchProdutos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const filterProdutos = () => {
    let filtered = produtos;

    if (categoriaFilter !== 'todas') {
      filtered = filtered.filter(p => p.categoria === categoriaFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.nome.toLowerCase().includes(query) ||
        (p.codigo && p.codigo.toLowerCase().includes(query))
      );
    }

    setFilteredProdutos(filtered);
  };

  const handleAddProduto = () => {
    setEditingProduto(null);
    setIsModalOpen(true);
  };

  const handleEditProduto = (produto: Produto) => {
    setEditingProduto(produto);
    setIsModalOpen(true);
  };

  const handleDeleteProduto = (produto: Produto) => {
    setDeletingProduto(produto);
  };

  const handleModalClose = (success?: boolean) => {
    setIsModalOpen(false);
    setEditingProduto(null);
    if (success) {
      fetchProdutos();
    }
  };

  const handleDeleteClose = (success?: boolean) => {
    setDeletingProduto(null);
    if (success) {
      fetchProdutos();
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Produtos</h1>
            <p className="text-muted-foreground mt-1">
              Cadastre e gerencie produtos de estoque das lojas
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setEstoqueModalOpen(true)}
            >
              ⚙️ Configurar Estoque Mínimo Classe A
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportarIAOpen(true)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Adicionar em Lote com IA
            </Button>
            <Button onClick={handleAddProduto}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Produto
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou código..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Categorias</SelectItem>
                  {Object.entries(categoriaLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando produtos...
              </div>
            ) : filteredProdutos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || categoriaFilter !== 'todas'
                  ? 'Nenhum produto encontrado com os filtros aplicados'
                  : 'Nenhum produto cadastrado. Clique em "Adicionar Produto" para começar.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Produto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unid. Consumo</TableHead>
                      <TableHead className="text-center">Classificação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProdutos.map((produto) => (
                      <TableRow key={produto.id}>
                        <TableCell className="font-medium">{produto.nome}</TableCell>
                        <TableCell>{produto.codigo || '-'}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs">
                            {categoriaLabels[produto.categoria] || produto.categoria}
                          </span>
                        </TableCell>
                        <TableCell>{produto.unidade_consumo || '-'}</TableCell>
                        <TableCell className="text-center">
                          {produto.classificacao ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                              {produto.classificacao}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditProduto(produto)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProduto(produto)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ProdutoFormModal
        open={isModalOpen}
        onClose={handleModalClose}
        produto={editingProduto}
      />

      <DeleteProdutoDialog
        produto={deletingProduto}
        onClose={handleDeleteClose}
      />

      <ImportarProdutosIAModal
        open={importarIAOpen}
        onClose={() => setImportarIAOpen(false)}
        onSuccess={fetchProdutos}
      />

      <ConfigurarEstoqueMinimoModal
        open={estoqueModalOpen}
        onOpenChange={setEstoqueModalOpen}
      />
    </Layout>
  );
};

export default GerenciarProdutos;
