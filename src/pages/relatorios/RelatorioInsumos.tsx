import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Package, Printer, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOrganization } from '@/contexts/OrganizationContext';

interface MovimentacaoInsumo {
  id: string;
  entidade_nome: string;
  tipo_movimentacao: string;
  quantidade: number;
  estoque_anterior: number;
  estoque_resultante: number;
  created_at: string;
  usuario_nome: string;
  observacao: string | null;
  unidade_origem: string | null;
}

interface InsumoAtual {
  id: string;
  nome: string;
  quantidade_em_estoque: number | null;
  unidade_medida: string;
  estoque_minimo: number | null;
  data_ultima_movimentacao: string | null;
}

// Mapeamento de tipos de movimentação com cores e labels
const TIPOS_MOVIMENTACAO: Record<string, { label: string; isEntrada: boolean; cor: string }> = {
  'compra': { label: 'Compra', isEntrada: true, cor: 'bg-green-600' },
  'producao': { label: 'Produção', isEntrada: true, cor: 'bg-blue-600' },
  'ajuste_positivo': { label: 'Ajuste (+)', isEntrada: true, cor: 'bg-orange-500' },
  'transferencia_entrada': { label: 'Transf. Entrada', isEntrada: true, cor: 'bg-purple-500' },
  'cancelamento_preparo': { label: 'Cancelamento', isEntrada: true, cor: 'bg-yellow-600' },
  'romaneio_recebimento': { label: 'Romaneio Receb.', isEntrada: true, cor: 'bg-teal-600' },
  'consumo_producao': { label: 'Consumo Produção', isEntrada: false, cor: 'bg-slate-600' },
  'ajuste_negativo': { label: 'Ajuste (-)', isEntrada: false, cor: 'bg-red-600' },
  'perda': { label: 'Perda', isEntrada: false, cor: 'bg-red-800' },
  'transferencia_saida': { label: 'Transf. Saída', isEntrada: false, cor: 'bg-purple-800' },
  'romaneio_envio': { label: 'Romaneio Envio', isEntrada: false, cor: 'bg-indigo-600' },
};

const RelatorioInsumos = () => {
  const { organizationId } = useOrganization();
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoInsumo[]>([]);
  const [estoqueAtual, setEstoqueAtual] = useState<InsumoAtual[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState('todos');

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadMovimentacoes(), loadEstoqueAtual()]);
    setLoading(false);
  };

  const loadMovimentacoes = async () => {
    try {
      const { data, error } = await supabase
        .from('movimentacoes_estoque_log')
        .select('id, entidade_nome, tipo_movimentacao, quantidade, estoque_anterior, estoque_resultante, created_at, usuario_nome, observacao, unidade_origem')
        .eq('entidade_tipo', 'insumo')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setMovimentacoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
      toast.error('Erro ao carregar movimentações');
    }
  };

  const loadEstoqueAtual = async () => {
    try {
      const { data, error } = await supabase
        .from('insumos')
        .select('id, nome, quantidade_em_estoque, unidade_medida, estoque_minimo, data_ultima_movimentacao')
        .order('nome');

      if (error) throw error;
      setEstoqueAtual(data || []);
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
      toast.error('Erro ao carregar estoque atual');
    }
  };

  // Filtrar movimentações
  const movimentacoesFiltradas = useMemo(() => {
    if (tipoFilter === 'todos') return movimentacoes;
    if (tipoFilter === 'entradas') {
      return movimentacoes.filter(m => TIPOS_MOVIMENTACAO[m.tipo_movimentacao]?.isEntrada === true);
    }
    if (tipoFilter === 'saidas') {
      return movimentacoes.filter(m => TIPOS_MOVIMENTACAO[m.tipo_movimentacao]?.isEntrada === false);
    }
    return movimentacoes.filter(m => m.tipo_movimentacao === tipoFilter);
  }, [movimentacoes, tipoFilter]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const entradas = movimentacoes.filter(m => TIPOS_MOVIMENTACAO[m.tipo_movimentacao]?.isEntrada === true);
    const saidas = movimentacoes.filter(m => TIPOS_MOVIMENTACAO[m.tipo_movimentacao]?.isEntrada === false);
    
    const totalEntradas = entradas.reduce((sum, m) => sum + Number(m.quantidade), 0);
    const totalSaidas = saidas.reduce((sum, m) => sum + Number(m.quantidade), 0);
    
    return {
      totalMovimentos: movimentacoes.length,
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas
    };
  }, [movimentacoes]);

  // Estatísticas do estoque atual
  const statsEstoque = useMemo(() => {
    const itensAbaixoMinimo = estoqueAtual.filter(i => 
      i.estoque_minimo != null && 
      (i.quantidade_em_estoque || 0) <= i.estoque_minimo
    ).length;
    
    return {
      totalItens: estoqueAtual.length,
      itensAbaixoMinimo,
      itensOk: estoqueAtual.length - itensAbaixoMinimo
    };
  }, [estoqueAtual]);

  const handlePrintAuditoria = async () => {
    try {
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
          <title>Folha de Auditoria - Insumos</title>
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
            .alerta { background-color: #fee2e2; }
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
            <h1>📋 FOLHA DE AUDITORIA DE ESTOQUE - INSUMOS</h1>
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
                <th>Nome do Insumo</th>
                <th style="width: 80px;">Unidade</th>
                <th style="width: 80px;" class="text-right">Est. Mín.</th>
                <th style="width: 100px;" class="text-right">Estoque Sistema</th>
                <th style="width: 100px;" class="text-center">Contagem Física</th>
                <th style="width: 100px;" class="text-center">Diferença</th>
              </tr>
            </thead>
            <tbody>
              ${estoqueAtual.map((insumo, index) => {
                const abaixoMinimo = insumo.estoque_minimo != null && 
                  (insumo.quantidade_em_estoque || 0) <= insumo.estoque_minimo;
                return `
                  <tr class="${abaixoMinimo ? 'alerta' : ''}">
                    <td class="text-center">${index + 1}</td>
                    <td>${insumo.nome}</td>
                    <td class="text-center">${insumo.unidade_medida || '-'}</td>
                    <td class="text-right">${insumo.estoque_minimo != null ? Number(insumo.estoque_minimo).toFixed(2) : '-'}</td>
                    <td class="text-right">${Number(insumo.quantidade_em_estoque || 0).toFixed(2)}</td>
                    <td class="campo-vazio"></td>
                    <td class="campo-vazio"></td>
                  </tr>
                `;
              }).join('')}
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

  const renderBadgeTipo = (tipo: string) => {
    const config = TIPOS_MOVIMENTACAO[tipo] || { label: tipo, isEntrada: false, cor: 'bg-gray-500' };
    return (
      <Badge className={`${config.cor} text-white`}>
        {config.isEntrada ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatório de Insumos</h1>
            <p className="text-muted-foreground">Entradas, saídas e estoque atual de insumos do CPD</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handlePrintAuditoria} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir Auditoria
            </Button>
          </div>
        </div>

        <Tabs defaultValue="movimentacoes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="movimentacoes">Histórico de Movimentações</TabsTrigger>
            <TabsTrigger value="estoque">Estoque Atual</TabsTrigger>
          </TabsList>

          {/* Aba de Movimentações */}
          <TabsContent value="movimentacoes" className="space-y-4">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Movimentos</p>
                      <p className="text-2xl font-bold">{stats.totalMovimentos}</p>
                    </div>
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Entradas</p>
                      <p className="text-2xl font-bold text-green-600">{stats.totalEntradas.toFixed(2)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Saídas</p>
                      <p className="text-2xl font-bold text-destructive">{stats.totalSaidas.toFixed(2)}</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo</p>
                      <p className={`text-2xl font-bold ${stats.saldo >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {stats.saldo.toFixed(2)}
                      </p>
                    </div>
                    <Package className={`h-8 w-8 ${stats.saldo >= 0 ? 'text-green-600' : 'text-destructive'}`} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <Select value={tipoFilter} onValueChange={setTipoFilter}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Tipos</SelectItem>
                      <SelectItem value="entradas">📈 Apenas Entradas</SelectItem>
                      <SelectItem value="saidas">📉 Apenas Saídas</SelectItem>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem value="consumo_producao">Consumo Produção</SelectItem>
                      <SelectItem value="ajuste_positivo">Ajuste Positivo</SelectItem>
                      <SelectItem value="ajuste_negativo">Ajuste Negativo</SelectItem>
                      <SelectItem value="perda">Perda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Movimentações */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Movimentações ({movimentacoesFiltradas.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Insumo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Est. Anterior</TableHead>
                        <TableHead className="text-right">Est. Resultante</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Observação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimentacoesFiltradas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>Nenhuma movimentação encontrada</p>
                            <p className="text-sm">As movimentações de insumos aparecerão aqui</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        movimentacoesFiltradas.map((mov) => (
                          <TableRow key={mov.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(mov.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-medium">{mov.entidade_nome}</TableCell>
                            <TableCell>{renderBadgeTipo(mov.tipo_movimentacao)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {Number(mov.quantidade).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {Number(mov.estoque_anterior).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {Number(mov.estoque_resultante).toFixed(2)}
                            </TableCell>
                            <TableCell>{mov.usuario_nome}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {mov.observacao || '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba de Estoque Atual */}
          <TabsContent value="estoque" className="space-y-4">
            {/* Cards de Resumo do Estoque */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Insumos</p>
                      <p className="text-2xl font-bold">{statsEstoque.totalItens}</p>
                    </div>
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Estoque OK</p>
                      <p className="text-2xl font-bold text-green-600">{statsEstoque.itensOk}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Abaixo do Mínimo</p>
                      <p className="text-2xl font-bold text-destructive">{statsEstoque.itensAbaixoMinimo}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Estoque Atual */}
            <Card>
              <CardHeader>
                <CardTitle>Estoque Atual de Insumos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Insumo</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Estoque Atual</TableHead>
                        <TableHead className="text-right">Estoque Mínimo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Última Movimentação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estoqueAtual.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>Nenhum insumo cadastrado</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        estoqueAtual.map((insumo) => {
                          const abaixoMinimo = insumo.estoque_minimo != null && 
                            (insumo.quantidade_em_estoque || 0) <= insumo.estoque_minimo;
                          return (
                            <TableRow key={insumo.id} className={abaixoMinimo ? 'bg-destructive/10' : ''}>
                              <TableCell className="font-medium">{insumo.nome}</TableCell>
                              <TableCell>{insumo.unidade_medida}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {Number(insumo.quantidade_em_estoque || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                {insumo.estoque_minimo != null ? Number(insumo.estoque_minimo).toFixed(2) : '-'}
                              </TableCell>
                              <TableCell>
                                {abaixoMinimo ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Baixo
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-600 gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    OK
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {insumo.data_ultima_movimentacao 
                                  ? format(new Date(insumo.data_ultima_movimentacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default RelatorioInsumos;
