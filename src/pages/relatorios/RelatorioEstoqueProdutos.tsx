import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EstoqueProduto {
  produto_id: string;
  produto_nome: string;
  codigo: string | null;
  categoria: string;
  loja_nome: string;
  quantidade: number;
  estoque_minimo: number;
  status: 'critico' | 'alerta' | 'normal';
}

const RelatorioEstoqueProdutos = () => {
  const [estoques, setEstoques] = useState<EstoqueProduto[]>([]);
  const [filteredEstoques, setFilteredEstoques] = useState<EstoqueProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaFilter, setCategoriaFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  useEffect(() => {
    loadEstoques();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [estoques, categoriaFilter, statusFilter]);

  const loadEstoques = async () => {
    try {
      setLoading(true);

      const { data: produtos, error: produtosError } = await supabase
        .from('produtos')
        .select('id, nome, codigo, categoria');

      if (produtosError) throw produtosError;

      const { data: estoquesData, error: estoquesError } = await supabase
        .from('estoque_loja_produtos')
        .select('produto_id, loja_id, quantidade');

      if (estoquesError) throw estoquesError;

      const { data: lojas, error: lojasError } = await supabase
        .from('lojas')
        .select('id, nome');

      if (lojasError) throw lojasError;

      // Buscar estoques mínimos (simplificado - pegar o valor da segunda-feira)
      const { data: minimos, error: minimosError } = await supabase
        .from('produtos_estoque_minimo_semanal')
        .select('produto_id, loja_id, segunda');

      if (minimosError) throw minimosError;

      // Montar dados consolidados
      const estoquesCompletos: EstoqueProduto[] = [];

      estoquesData?.forEach((estoque) => {
        const produto = produtos?.find((p) => p.id === estoque.produto_id);
        const loja = lojas?.find((l) => l.id === estoque.loja_id);
        const minimo = minimos?.find(
          (m) => m.produto_id === estoque.produto_id && m.loja_id === estoque.loja_id
        );

        if (produto && loja) {
          const quantidade = Number(estoque.quantidade);
          const estoqueMinimo = Number(minimo?.segunda || 0);
          
          let status: 'critico' | 'alerta' | 'normal' = 'normal';
          if (quantidade === 0) {
            status = 'critico';
          } else if (quantidade < estoqueMinimo) {
            status = 'alerta';
          }

          estoquesCompletos.push({
            produto_id: produto.id,
            produto_nome: produto.nome,
            codigo: produto.codigo,
            categoria: produto.categoria,
            loja_nome: loja.nome,
            quantidade,
            estoque_minimo: estoqueMinimo,
            status,
          });
        }
      });

      setEstoques(estoquesCompletos);
    } catch (error) {
      console.error('Erro ao carregar estoques:', error);
      toast.error('Erro ao carregar dados de estoque');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...estoques];

    if (categoriaFilter !== 'todos') {
      filtered = filtered.filter((e) => e.categoria === categoriaFilter);
    }

    if (statusFilter !== 'todos') {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }

    setFilteredEstoques(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critico':
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Crítico</Badge>;
      case 'alerta':
        return <Badge variant="secondary"><AlertTriangle className="mr-1 h-3 w-3" />Alerta</Badge>;
      case 'normal':
        return <Badge variant="default"><CheckCircle className="mr-1 h-3 w-3" />Normal</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const totalCriticos = estoques.filter((e) => e.status === 'critico').length;
  const totalAlertas = estoques.filter((e) => e.status === 'alerta').length;
  const totalNormal = estoques.filter((e) => e.status === 'normal').length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando relatório...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Relatório de Estoque de Produtos</h1>
          <p className="text-muted-foreground">Visualize o estoque atual dos produtos gerais</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Produtos</p>
                  <p className="text-2xl font-bold">{estoques.length}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status Crítico</p>
                  <p className="text-2xl font-bold text-destructive">{totalCriticos}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Alerta</p>
                  <p className="text-2xl font-bold text-secondary">{totalAlertas}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Normal</p>
                  <p className="text-2xl font-bold text-green-600">{totalNormal}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Categorias</SelectItem>
                  <SelectItem value="congelado">Congelado</SelectItem>
                  <SelectItem value="refrigerado">Refrigerado</SelectItem>
                  <SelectItem value="ambiente">Ambiente</SelectItem>
                  <SelectItem value="diversos">Diversos</SelectItem>
                  <SelectItem value="material_escritorio">Material Escritório</SelectItem>
                  <SelectItem value="material_limpeza">Material Limpeza</SelectItem>
                  <SelectItem value="embalagens">Embalagens</SelectItem>
                  <SelectItem value="descartaveis">Descartáveis</SelectItem>
                  <SelectItem value="equipamentos">Equipamentos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                  <SelectItem value="alerta">Alerta</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Estoque de Produtos por Loja</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-right">Qtd Atual</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstoques.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEstoques.map((estoque, index) => (
                    <TableRow key={`${estoque.produto_id}-${estoque.loja_nome}-${index}`}>
                      <TableCell className="font-medium">{estoque.produto_nome}</TableCell>
                      <TableCell>{estoque.codigo || '-'}</TableCell>
                      <TableCell className="capitalize">{estoque.categoria.replace('_', ' ')}</TableCell>
                      <TableCell>{estoque.loja_nome}</TableCell>
                      <TableCell className="text-right">{estoque.quantidade}</TableCell>
                      <TableCell className="text-right">{estoque.estoque_minimo}</TableCell>
                      <TableCell>{getStatusBadge(estoque.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RelatorioEstoqueProdutos;
