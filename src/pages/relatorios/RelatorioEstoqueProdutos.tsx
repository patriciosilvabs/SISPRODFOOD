import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle, CheckCircle, History, User, Clock, Printer } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EstoqueProduto {
  produto_id: string;
  produto_nome: string;
  codigo: string | null;
  categoria: string;
  loja_nome: string;
  quantidade: number;
  estoque_minimo: number;
  status: 'critico' | 'alerta' | 'normal';
  data_ultima_atualizacao: string | null;
  usuario_nome: string | null;
}

interface Movimentacao {
  id: string;
  produto_nome: string;
  tipo: string;
  quantidade: number;
  quantidade_anterior: number;
  quantidade_posterior: number;
  usuario_nome: string;
  created_at: string;
  observacao: string | null;
}

const RelatorioEstoqueProdutos = () => {
  const [estoques, setEstoques] = useState<EstoqueProduto[]>([]);
  const [filteredEstoques, setFilteredEstoques] = useState<EstoqueProduto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
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
        .select('produto_id, loja_id, quantidade, data_ultima_atualizacao, usuario_nome');

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

      // Buscar últimas movimentações
      const { data: movData, error: movError } = await supabase
        .from('movimentacoes_cpd_produtos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (movError) throw movError;

      setMovimentacoes(movData || []);

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
            data_ultima_atualizacao: estoque.data_ultima_atualizacao,
            usuario_nome: estoque.usuario_nome,
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

  const handlePrintAuditoria = async () => {
    try {
      // Buscar produtos para auditoria
      const { data: produtos, error } = await supabase
        .from('produtos')
        .select('id, nome, codigo, categoria')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      // Buscar estoque CPD para cada produto
      const { data: estoqueCPD } = await supabase
        .from('estoque_cpd_produtos')
        .select('produto_id, quantidade');

      const estoqueMap = new Map(
        (estoqueCPD || []).map(e => [e.produto_id, e.quantidade])
      );

      const dataAtual = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Bloqueador de pop-up ativo. Permita pop-ups para imprimir.');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Folha de Auditoria - Produtos</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header h1 { font-size: 18px; margin-bottom: 5px; }
            .header-info { display: flex; justify-content: space-between; margin-top: 10px; }
            .field { border-bottom: 1px solid #000; min-width: 200px; display: inline-block; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .campo-vazio { width: 80px; }
            .footer { margin-top: 30px; }
            .footer-line { display: flex; justify-content: space-between; margin-top: 40px; }
            .signature { border-top: 1px solid #000; width: 250px; text-align: center; padding-top: 5px; }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📋 FOLHA DE AUDITORIA DE ESTOQUE - PRODUTOS CPD</h1>
            <p>Conferência Semanal de Estoque</p>
            <div class="header-info">
              <div>Data: <span class="field">${dataAtual}</span></div>
              <div>Conferente: <span class="field" style="min-width: 250px;"></span></div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Nome do Produto</th>
                <th style="width: 100px;">Código</th>
                <th style="width: 100px;">Categoria</th>
                <th style="width: 100px;" class="text-right">Estoque Sistema</th>
                <th style="width: 100px;" class="text-center">Contagem Física</th>
                <th style="width: 100px;" class="text-center">Diferença</th>
              </tr>
            </thead>
            <tbody>
              ${(produtos || []).map((produto, index) => `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td>${produto.nome}</td>
                  <td class="text-center">${produto.codigo || '-'}</td>
                  <td class="text-center">${produto.categoria.replace('_', ' ')}</td>
                  <td class="text-right">${Number(estoqueMap.get(produto.id) || 0).toFixed(2)}</td>
                  <td class="campo-vazio"></td>
                  <td class="campo-vazio"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p><strong>Observações:</strong></p>
            <div style="border: 1px solid #000; height: 60px; margin-top: 5px;"></div>
            
            <div class="footer-line">
              <div class="signature">Assinatura do Conferente</div>
              <div class="signature">Data: ____/____/________</div>
              <div class="signature">Visto do Supervisor</div>
            </div>
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
    } catch (error) {
      console.error('Erro ao gerar folha de auditoria:', error);
      toast.error('Erro ao gerar folha de auditoria');
    }
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

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'entrada':
        return <Badge variant="default" className="bg-green-600">Entrada</Badge>;
      case 'saida':
        return <Badge variant="destructive">Saída</Badge>;
      case 'ajuste':
        return <Badge variant="secondary">Ajuste</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatório de Estoque de Produtos</h1>
            <p className="text-muted-foreground">Visualize o estoque atual dos produtos gerais</p>
          </div>
          <Button onClick={handlePrintAuditoria} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir Auditoria
          </Button>
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
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Última Atualização
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Usuário
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstoques.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
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
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(estoque.data_ultima_atualizacao)}
                      </TableCell>
                      <TableCell className="text-sm">{estoque.usuario_nome || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Últimas Movimentações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Últimas Movimentações do CPD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Data/Hora
                    </div>
                  </TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Posterior</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Usuário
                    </div>
                  </TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhuma movimentação registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  movimentacoes.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="text-sm">{formatDateTime(mov.created_at)}</TableCell>
                      <TableCell className="font-medium">{mov.produto_nome}</TableCell>
                      <TableCell>{getTipoBadge(mov.tipo)}</TableCell>
                      <TableCell className="text-right font-medium">{mov.quantidade}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{mov.quantidade_anterior}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{mov.quantidade_posterior}</TableCell>
                      <TableCell className="text-sm">{mov.usuario_nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{mov.observacao || '-'}</TableCell>
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