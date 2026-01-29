import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Search, Settings2, Package } from 'lucide-react';
import { AjustarEstoquePorcionadoModal } from '@/components/modals/AjustarEstoquePorcionadoModal';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ItemPorcionado {
  id: string;
  nome: string;
  peso_unitario_g: number;
  ativo: boolean;
}

interface ContagemCPD {
  id: string;
  item_porcionado_id: string;
  final_sobra: number;
  updated_at: string;
  usuario_nome: string;
}

interface AjusteEstoquePorcionadosCPDProps {
  cpdLojaId: string;
  cpdLojaNome: string;
}

export function AjusteEstoquePorcionadosCPD({ cpdLojaId, cpdLojaNome }: AjusteEstoquePorcionadosCPDProps) {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<ItemPorcionado[]>([]);
  const [contagens, setContagens] = useState<Map<string, ContagemCPD>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<ItemPorcionado | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (cpdLojaId && organizationId) {
      loadData();
    }
  }, [cpdLojaId, organizationId]);

  const loadData = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      // Carregar itens porcionados ativos
      const { data: itensData, error: itensError } = await supabase
        .from('itens_porcionados')
        .select('id, nome, peso_unitario_g, ativo')
        .eq('ativo', true)
        .order('nome');

      if (itensError) throw itensError;

      // Buscar data do servidor
      const { data: dataServidor } = await supabase.rpc('get_current_date');
      const today = dataServidor || new Date().toISOString().split('T')[0];

      // Carregar contagens do CPD para hoje
      const { data: contagensData, error: contagensError } = await supabase
        .from('contagem_porcionados')
        .select('id, item_porcionado_id, final_sobra, updated_at, usuario_nome')
        .eq('loja_id', cpdLojaId)
        .eq('dia_operacional', today);

      if (contagensError) throw contagensError;

      // Criar mapa de contagens por item
      const contagensMap = new Map<string, ContagemCPD>();
      (contagensData || []).forEach((c) => {
        contagensMap.set(c.item_porcionado_id, c);
      });

      setItens(itensData || []);
      setContagens(contagensMap);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar itens');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAjuste = (item: ItemPorcionado) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  const handleAjusteSuccess = () => {
    loadData();
    toast.success('Estoque ajustado com sucesso!');
  };

  // Filtrar itens pela busca
  const filteredItens = itens.filter((item) =>
    item.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Ajuste de Estoque - {cpdLojaNome}
            </CardTitle>
            <CardDescription>
              Realize ajustes de auditoria, perdas ou correções de inventário nos porcionados do CPD
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar item porcionado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabela de Itens */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Estoque Atual</TableHead>
                <TableHead className="text-center">Última Atualização</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhum item encontrado' : 'Nenhum item cadastrado'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItens.map((item) => {
                  const contagem = contagens.get(item.id);
                  const estoque = contagem?.final_sobra ?? 0;
                  const lastUpdate = contagem?.updated_at;
                  const lastUser = contagem?.usuario_nome;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{item.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={estoque > 0 ? 'default' : 'secondary'} className="text-sm">
                          {estoque} un
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {lastUpdate ? (
                          <div className="text-sm">
                            <div className="text-foreground">
                              {format(new Date(lastUpdate), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                            <div className="text-xs text-muted-foreground">{lastUser}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAjuste(item)}
                        >
                          <Settings2 className="h-4 w-4 mr-1" />
                          Ajustar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Info */}
        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p>
            <strong>Importante:</strong> Todos os ajustes são registrados no log de movimentações 
            para auditoria. Inclua sempre um motivo detalhado para cada ajuste.
          </p>
        </div>
      </CardContent>

      {/* Modal de Ajuste */}
      {selectedItem && (
        <AjustarEstoquePorcionadoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          item={selectedItem}
          estoqueAtual={contagens.get(selectedItem.id)?.final_sobra ?? 0}
          lojaId={cpdLojaId}
          lojaNome={cpdLojaNome}
          onSuccess={handleAjusteSuccess}
        />
      )}
    </Card>
  );
}
