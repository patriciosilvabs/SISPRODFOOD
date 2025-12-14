import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Package, Printer } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InsumoLog {
  id: string;
  insumo_nome: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  data: string;
  usuario_nome: string;
}

const RelatorioInsumos = () => {
  const [logs, setLogs] = useState<InsumoLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<InsumoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState('todos');

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, tipoFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('insumos_log')
        .select('*')
        .order('data', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      toast.error('Erro ao carregar dados de movimentação');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    if (tipoFilter !== 'todos') {
      filtered = filtered.filter((l) => l.tipo === tipoFilter);
    }

    setFilteredLogs(filtered);
  };

  const handlePrintAuditoria = async () => {
    try {
      // Buscar lista de insumos para auditoria
      const { data: insumos, error } = await supabase
        .from('insumos')
        .select('id, nome, quantidade_em_estoque, unidade_medida')
        .order('nome');

      if (error) throw error;

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
                <th style="width: 100px;" class="text-right">Estoque Sistema</th>
                <th style="width: 100px;" class="text-center">Contagem Física</th>
                <th style="width: 100px;" class="text-center">Diferença</th>
              </tr>
            </thead>
            <tbody>
              ${(insumos || []).map((insumo, index) => `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td>${insumo.nome}</td>
                  <td class="text-center">${insumo.unidade_medida || '-'}</td>
                  <td class="text-right">${Number(insumo.quantidade_em_estoque || 0).toFixed(2)}</td>
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

  const totalEntradas = logs.filter((l) => l.tipo === 'entrada').reduce((sum, l) => sum + Number(l.quantidade), 0);
  const totalSaidas = logs.filter((l) => l.tipo === 'saida').reduce((sum, l) => sum + Number(l.quantidade), 0);
  const saldoTotal = totalEntradas - totalSaidas;

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
            <h1 className="text-3xl font-bold">Relatório de Insumos</h1>
            <p className="text-muted-foreground">Entradas e saídas de insumos do CPD</p>
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
                  <p className="text-sm text-muted-foreground">Total de Movimentos</p>
                  <p className="text-2xl font-bold">{logs.length}</p>
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
                  <p className="text-2xl font-bold text-green-600">{totalEntradas.toFixed(2)}</p>
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
                  <p className="text-2xl font-bold text-destructive">{totalSaidas.toFixed(2)}</p>
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
                  <p className={`text-2xl font-bold ${saldoTotal >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {saldoTotal.toFixed(2)}
                  </p>
                </div>
                <Package className={`h-8 w-8 ${saldoTotal >= 0 ? 'text-green-600' : 'text-destructive'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma movimentação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {format(new Date(log.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{log.insumo_nome}</TableCell>
                      <TableCell>
                        {log.tipo === 'entrada' ? (
                          <Badge variant="default" className="bg-green-600">
                            <TrendingUp className="mr-1 h-3 w-3" />
                            Entrada
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <TrendingDown className="mr-1 h-3 w-3" />
                            Saída
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{Number(log.quantidade).toFixed(2)}</TableCell>
                      <TableCell>{log.usuario_nome}</TableCell>
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

export default RelatorioInsumos;
