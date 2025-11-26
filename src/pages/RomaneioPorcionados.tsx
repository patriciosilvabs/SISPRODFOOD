import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, ClipboardList, RefreshCw, Search, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepIndicator } from '@/components/romaneio/StepIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface Loja {
  id: string;
  nome: string;
  responsavel: string;
}

interface ItemDisponivel {
  item_id: string;
  item_nome: string;
  quantidade_disponivel: number;
  data_producao: string;
  producao_registro_ids: string[];
}

interface ItemSelecionado {
  item_id: string;
  item_nome: string;
  quantidade: number;
  producao_registro_ids: string[];
}

const RomaneioPorcionados = () => {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedLoja, setSelectedLoja] = useState<string>('');
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemDisponivel[]>([]);
  const [itensSelecionados, setItensSelecionados] = useState<ItemSelecionado[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLojas();
    fetchItensDisponiveis();
  }, []);

  const fetchLojas = async () => {
    const { data, error } = await supabase
      .from('lojas')
      .select('*')
      .order('nome');
    
    if (error) {
      toast.error('Erro ao carregar lojas');
      return;
    }
    
    setLojas(data || []);
  };

  const fetchItensDisponiveis = async () => {
    const { data, error } = await supabase
      .from('producao_registros')
      .select('id, item_id, item_nome, unidades_reais, data_fim')
      .eq('status', 'finalizado')
      .order('data_fim', { ascending: false });
    
    if (error) {
      toast.error('Erro ao carregar itens disponíveis');
      return;
    }

    // Agrupar por item_id
    const agrupado = data.reduce((acc: Record<string, ItemDisponivel>, reg) => {
      if (!acc[reg.item_id]) {
        acc[reg.item_id] = {
          item_id: reg.item_id,
          item_nome: reg.item_nome,
          quantidade_disponivel: 0,
          data_producao: reg.data_fim,
          producao_registro_ids: []
        };
      }
      acc[reg.item_id].quantidade_disponivel += reg.unidades_reais || 0;
      acc[reg.item_id].producao_registro_ids.push(reg.id);
      return acc;
    }, {});

    setItensDisponiveis(Object.values(agrupado));
  };

  const addItem = (item: ItemDisponivel) => {
    const jaAdicionado = itensSelecionados.find(i => i.item_id === item.item_id);
    if (jaAdicionado) {
      toast.error('Item já adicionado ao romaneio');
      return;
    }

    setItensSelecionados([
      ...itensSelecionados,
      {
        item_id: item.item_id,
        item_nome: item.item_nome,
        quantidade: item.quantidade_disponivel,
        producao_registro_ids: item.producao_registro_ids
      }
    ]);
    toast.success(`${item.item_nome} adicionado`);
  };

  const removeItem = (item_id: string) => {
    setItensSelecionados(itensSelecionados.filter(i => i.item_id !== item_id));
  };

  const updateQuantidade = (item_id: string, quantidade: number) => {
    setItensSelecionados(
      itensSelecionados.map(i =>
        i.item_id === item_id ? { ...i, quantidade } : i
      )
    );
  };

  const handleProximoPasso = () => {
    if (currentStep === 1 && !selectedLoja) {
      toast.error('Selecione uma loja de destino');
      return;
    }
    if (currentStep === 2 && itensSelecionados.length === 0) {
      toast.error('Adicione pelo menos um item ao romaneio');
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  const handleVoltarPasso = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFinalizarRomaneio = async () => {
    if (!user || !profile) {
      toast.error('Usuário não autenticado');
      return;
    }

    setLoading(true);

    try {
      const lojaSelecionada = lojas.find(l => l.id === selectedLoja);
      
      // Criar romaneio
      const { data: romaneio, error: romaneioError } = await supabase
        .from('romaneios')
        .insert({
          loja_id: selectedLoja,
          loja_nome: lojaSelecionada?.nome || '',
          usuario_id: user.id,
          usuario_nome: profile.nome,
          observacao: observacao || null,
          status: 'pendente'
        })
        .select()
        .single();

      if (romaneioError) throw romaneioError;

      // Criar itens do romaneio
      const itensParaInserir = itensSelecionados.map(item => ({
        romaneio_id: romaneio.id,
        item_porcionado_id: item.item_id,
        item_nome: item.item_nome,
        quantidade: item.quantidade,
        producao_registro_id: item.producao_registro_ids[0] // Simplificado
      }));

      const { error: itensError } = await supabase
        .from('romaneio_itens')
        .insert(itensParaInserir);

      if (itensError) throw itensError;

      toast.success('Romaneio criado com sucesso!');
      
      // Reset
      setCurrentStep(1);
      setSelectedLoja('');
      setItensSelecionados([]);
      setObservacao('');
      fetchItensDisponiveis();
      
    } catch (error) {
      console.error('Erro ao criar romaneio:', error);
      toast.error('Erro ao criar romaneio');
    } finally {
      setLoading(false);
    }
  };

  const itensFiltrados = itensDisponiveis.filter(item =>
    item.item_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Romaneio</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie romaneios de envio, recebimento e reposição de estoque das lojas
          </p>
        </div>

        <Tabs defaultValue="romaneio" className="w-full">
          <TabsList>
            <TabsTrigger value="romaneio" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Criar Romaneio
            </TabsTrigger>
            <TabsTrigger value="receber" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Receber Porcionados
            </TabsTrigger>
            <TabsTrigger value="reposicao" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reposição de Estoque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="romaneio" className="space-y-6">
            {/* Stepper */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-0">
                  <StepIndicator step={1} current={currentStep} label="Selecionar loja" />
                  <StepIndicator step={2} current={currentStep} label="Escolher Itens" />
                  <StepIndicator step={3} current={currentStep} label="Conferir e Enviar" />
                </div>
              </CardContent>
            </Card>

            {/* Passo 1: Selecionar Loja */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Selecionar Loja de Destino</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Loja de Destino</Label>
                    <Select value={selectedLoja} onValueChange={setSelectedLoja}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma loja" />
                      </SelectTrigger>
                      <SelectContent>
                        {lojas.map(loja => (
                          <SelectItem key={loja.id} value={loja.id}>
                            {loja.nome} - {loja.responsavel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">Data:</span>
                    <span>{format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleProximoPasso} disabled={!selectedLoja}>
                      Próximo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Passo 2: Escolher Itens */}
            {currentStep === 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna Esquerda: Itens Disponíveis */}
                <div className="lg:col-span-2 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Itens Disponíveis para Envio</CardTitle>
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar itens..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {itensFiltrados.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhum item disponível para envio
                        </p>
                      ) : (
                        itensFiltrados.map(item => (
                          <Card key={item.item_id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="font-semibold">{item.item_nome}</p>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span>Disponível: {item.quantidade_disponivel} un</span>
                                  <span>•</span>
                                  <span>Produzido: {format(new Date(item.data_producao), 'dd/MM/yyyy')}</span>
                                </div>
                              </div>
                              <Button
                                onClick={() => addItem(item)}
                                size="sm"
                                disabled={itensSelecionados.some(i => i.item_id === item.item_id)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Adicionar
                              </Button>
                            </div>
                          </Card>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Coluna Direita: Itens Selecionados */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        ITENS SELECIONADOS PARA ENVIO
                      </CardTitle>
                      <Badge variant="secondary" className="w-fit">
                        {itensSelecionados.length} {itensSelecionados.length === 1 ? 'item' : 'itens'}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {itensSelecionados.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhum item selecionado
                        </p>
                      ) : (
                        itensSelecionados.map(item => (
                          <div key={item.item_id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.item_nome}</p>
                              <p className="text-xs text-muted-foreground">{item.quantidade} unidades</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.item_id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleVoltarPasso} className="flex-1">
                      Voltar
                    </Button>
                    <Button onClick={handleProximoPasso} className="flex-1" disabled={itensSelecionados.length === 0}>
                      Próximo
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Passo 3: Conferir e Enviar */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Conferir e Finalizar Romaneio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Loja de Destino</p>
                      <p className="font-semibold">{lojas.find(l => l.id === selectedLoja)?.nome}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data</p>
                      <p className="font-semibold">{format(new Date(), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Itens do Romaneio ({itensSelecionados.length})</Label>
                    <div className="border rounded-lg divide-y">
                      {itensSelecionados.map(item => (
                        <div key={item.item_id} className="p-3 flex justify-between">
                          <span className="font-medium">{item.item_nome}</span>
                          <span className="text-muted-foreground">{item.quantidade} un</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      placeholder="Adicione observações sobre este romaneio..."
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleVoltarPasso} className="flex-1">
                      Voltar
                    </Button>
                    <Button onClick={handleFinalizarRomaneio} className="flex-1" disabled={loading}>
                      {loading ? 'Finalizando...' : 'Finalizar Romaneio'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="receber">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Recebimento de Porcionados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Módulo em desenvolvimento. Confirme e registre o recebimento de porcionados.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reposicao">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Reposição de Estoque das Lojas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Módulo em desenvolvimento. Gerencie os pedidos de reposição de estoque das lojas.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default RomaneioPorcionados;
