import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, Eye, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { numberToWords } from '@/lib/numberToWords';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Loja {
  id: string;
  nome: string;
  responsavel: string;
}

interface ItemPorcionado {
  id: string;
  nome: string;
  peso_unitario_g: number;
}

interface Contagem {
  id: string;
  loja_id: string;
  item_porcionado_id: string;
  final_sobra: number;
  peso_total_g: number | null;
  ideal_amanha: number;
  a_produzir: number;
  usuario_nome: string;
  updated_at: string;
  item_nome?: string;
}

interface EstoqueIdeal {
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

const ContagemPorcionados = () => {
  const { user } = useAuth();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [itens, setItens] = useState<ItemPorcionado[]>([]);
  const [contagens, setContagens] = useState<Record<string, Contagem[]>>({});
  const [openLojas, setOpenLojas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ lojaId: string; itemId: string; itemNome: string } | null>(null);
  const [estoquesIdeais, setEstoquesIdeais] = useState<EstoqueIdeal>({
    segunda: 200,
    terca: 200,
    quarta: 200,
    quinta: 200,
    sexta: 200,
    sabado: 200,
    domingo: 200,
  });
  const [estoquesIdeaisMap, setEstoquesIdeaisMap] = useState<Record<string, EstoqueIdeal>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carregar lojas
      const { data: lojasData, error: lojasError } = await supabase
        .from('lojas')
        .select('*')
        .order('nome');
      
      if (lojasError) throw lojasError;

      // Carregar itens porcionados
      const { data: itensData, error: itensError } = await supabase
        .from('itens_porcionados')
        .select('id, nome, peso_unitario_g')
        .order('nome');
      
      if (itensError) throw itensError;

      // Carregar contagens
      const { data: contagensData, error: contagensError } = await supabase
        .from('contagem_porcionados')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (contagensError) throw contagensError;

      // Carregar estoques ideais semanais
      const { data: estoquesData, error: estoquesError } = await supabase
        .from('estoques_ideais_semanais')
        .select('*');
      
      if (estoquesError) throw estoquesError;

      // Criar mapa de estoques ideais por loja e item
      const estoquesMap: Record<string, EstoqueIdeal> = {};
      (estoquesData || []).forEach((estoque: any) => {
        const key = `${estoque.loja_id}-${estoque.item_porcionado_id}`;
        estoquesMap[key] = {
          segunda: estoque.segunda,
          terca: estoque.terca,
          quarta: estoque.quarta,
          quinta: estoque.quinta,
          sexta: estoque.sexta,
          sabado: estoque.sabado,
          domingo: estoque.domingo,
        };
      });
      setEstoquesIdeaisMap(estoquesMap);

      setLojas(lojasData || []);
      setItens(itensData || []);

      // Organizar contagens por loja
      const contagensPorLoja: Record<string, Contagem[]> = {};
      (contagensData || []).forEach((contagem: any) => {
        const item = itensData?.find(i => i.id === contagem.item_porcionado_id);
        const contagemComNome = {
          ...contagem,
          item_nome: item?.nome || 'Item desconhecido',
        };
        
        if (!contagensPorLoja[contagem.loja_id]) {
          contagensPorLoja[contagem.loja_id] = [];
        }
        contagensPorLoja[contagem.loja_id].push(contagemComNome);
      });

      setContagens(contagensPorLoja);
      
      // Abrir todas as lojas por padrão
      setOpenLojas(new Set(lojasData?.map(l => l.id) || []));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const toggleLoja = (lojaId: string) => {
    setOpenLojas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lojaId)) {
        newSet.delete(lojaId);
      } else {
        newSet.add(lojaId);
      }
      return newSet;
    });
  };

  const handleValueChange = (lojaId: string, itemId: string, field: string, value: string) => {
    const key = `${lojaId}-${itemId}`;
    setEditingValues(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleSave = async (lojaId: string, itemId: string) => {
    const key = `${lojaId}-${itemId}`;
    const values = editingValues[key];

    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      // Buscar informações do item
      const { data: itemData } = await supabase
        .from('itens_porcionados')
        .select('nome, peso_unitario_g')
        .eq('id', itemId)
        .single();

      const finalSobra = parseInt(values?.final_sobra) || 0;
      
      // Se o usuário não editou ideal_amanha, buscar dos estoques ideais semanais
      let idealAmanha = 0;
      if (values?.ideal_amanha !== undefined) {
        idealAmanha = parseInt(values.ideal_amanha) || 0;
      } else {
        // Buscar do mapa de estoques ideais
        const estoqueKey = `${lojaId}-${itemId}`;
        const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
        if (estoqueSemanal) {
          const tomorrowDay = getTomorrowDayKey();
          idealAmanha = estoqueSemanal[tomorrowDay] || 0;
        }
      }
      
      const aProduzir = Math.max(0, idealAmanha - finalSobra);

      const dataToSave = {
        loja_id: lojaId,
        item_porcionado_id: itemId,
        final_sobra: finalSobra,
        peso_total_g: values?.peso_total_g ? parseFloat(values.peso_total_g) : null,
        ideal_amanha: idealAmanha,
        a_produzir: aProduzir,
        usuario_id: user.id,
        usuario_nome: profile?.nome || user.email || 'Usuário',
      };

      const { error } = await supabase
        .from('contagem_porcionados')
        .upsert(dataToSave, {
          onConflict: 'loja_id,item_porcionado_id',
        });

      if (error) throw error;

      // Atualizar registro de produção agregando TODAS as lojas
      if (itemData) {
        // 1. Buscar TODAS as contagens de TODAS as lojas para este item (apenas do dia atual)
        const hoje = new Date().toISOString().split('T')[0];
        const { data: todasContagens } = await supabase
          .from('contagem_porcionados')
          .select('loja_id, a_produzir, ideal_amanha, final_sobra')
          .eq('item_porcionado_id', itemId)
          .gt('a_produzir', 0)
          .gte('updated_at', `${hoje}T00:00:00`)
          .lte('updated_at', `${hoje}T23:59:59`);

        if (todasContagens && todasContagens.length > 0) {
          // 2. Buscar nomes das lojas
          const lojasIds = todasContagens.map(c => c.loja_id);
          const { data: lojasData } = await supabase
            .from('lojas')
            .select('id, nome')
            .in('id', lojasIds);

          // 3. Calcular TOTAL e construir detalhes
          const detalhesLojas = todasContagens.map(c => ({
            loja_id: c.loja_id,
            loja_nome: lojasData?.find(l => l.id === c.loja_id)?.nome || 'Loja',
            quantidade: c.a_produzir,
          }));

          const totalAProduzir = todasContagens.reduce((sum, c) => sum + c.a_produzir, 0);
          const pesoUnitarioKg = (itemData.peso_unitario_g || 0) / 1000;
          const pesoProgramadoTotal = totalAProduzir * pesoUnitarioKg;

          // 4. Verificar se já existe registro "a_produzir" para este item
          const { data: registroExistente } = await supabase
            .from('producao_registros')
            .select('id')
            .eq('item_id', itemId)
            .eq('status', 'a_produzir')
            .maybeSingle();

          const producaoData = {
            item_id: itemId,
            item_nome: itemData.nome,
            status: 'a_produzir',
            unidades_programadas: totalAProduzir,
            peso_programado_kg: pesoProgramadoTotal,
            detalhes_lojas: detalhesLojas,
            usuario_id: user.id,
            usuario_nome: profile?.nome || user.email || 'Usuário',
          };

          if (registroExistente) {
            // Atualizar registro existente
            const { error: updateError } = await supabase
              .from('producao_registros')
              .update(producaoData)
              .eq('id', registroExistente.id);

            if (updateError) {
              console.error('Erro ao atualizar registro de produção:', updateError);
            }
          } else {
            // Criar novo registro
            const { error: insertError } = await supabase
              .from('producao_registros')
              .insert(producaoData);

            if (insertError) {
              console.error('Erro ao criar registro de produção:', insertError);
            }
          }
        }
      }

      toast.success('Contagem salva com sucesso');
      loadData();
      
      // Limpar valores editados
      setEditingValues(prev => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar contagem');
    }
  };

  // Obter o dia da semana de amanhã em português
  const getTomorrowDayKey = (): keyof EstoqueIdeal => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayIndex = tomorrow.getDay(); // 0 = Domingo, 1 = Segunda, etc.
    
    const days: (keyof EstoqueIdeal)[] = [
      'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'
    ];
    
    return days[dayIndex];
  };

  const getEditingValue = (lojaId: string, itemId: string, field: string, defaultValue: any) => {
    const key = `${lojaId}-${itemId}`;
    
    // Se há valor editado manualmente, use-o
    if (editingValues[key]?.[field] !== undefined) {
      return editingValues[key][field];
    }
    
    // Para ideal_amanha, SEMPRE buscar dos estoques ideais semanais primeiro
    if (field === 'ideal_amanha') {
      const estoqueKey = `${lojaId}-${itemId}`;
      const estoqueSemanal = estoquesIdeaisMap[estoqueKey];
      
      if (estoqueSemanal) {
        const tomorrowDay = getTomorrowDayKey();
        const idealValue = estoqueSemanal[tomorrowDay];
        // Se o valor do estoque ideal é válido (> 0), use-o
        if (idealValue > 0) {
          return idealValue;
        }
      }
    }
    
    return defaultValue;
  };

  const openEstoquesDialog = async (lojaId: string, itemId: string, itemNome: string) => {
    setSelectedItem({ lojaId, itemId, itemNome });
    
    // Carregar estoques ideais existentes
    const { data, error } = await supabase
      .from('estoques_ideais_semanais')
      .select('*')
      .eq('loja_id', lojaId)
      .eq('item_porcionado_id', itemId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao carregar estoques ideais:', error);
      toast.error('Erro ao carregar estoques ideais');
      return;
    }
    
    if (data) {
      setEstoquesIdeais({
        segunda: data.segunda,
        terca: data.terca,
        quarta: data.quarta,
        quinta: data.quinta,
        sexta: data.sexta,
        sabado: data.sabado,
        domingo: data.domingo,
      });
    } else {
      // Valores padrão
      setEstoquesIdeais({
        segunda: 200,
        terca: 200,
        quarta: 200,
        quinta: 200,
        sexta: 200,
        sabado: 200,
        domingo: 200,
      });
    }
    
    setDialogOpen(true);
  };

  const handleSaveEstoquesIdeais = async () => {
    if (!selectedItem) return;

    try {
      const { error } = await supabase
        .from('estoques_ideais_semanais')
        .upsert({
          loja_id: selectedItem.lojaId,
          item_porcionado_id: selectedItem.itemId,
          ...estoquesIdeais,
        }, {
          onConflict: 'loja_id,item_porcionado_id',
        });

      if (error) throw error;

      toast.success('Estoques ideais salvos com sucesso');
      setDialogOpen(false);
      loadData(); // Recarregar dados para atualizar os ideais
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar estoques ideais');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Gerenciamento de Contagem de Porcionados</h1>
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Sparkles className="mr-2 h-4 w-4" />
            Otimizar com IA
          </Button>
        </div>

        <div className="space-y-4">
          {lojas.map((loja) => {
            const contagensLoja = contagens[loja.id] || [];
            const isOpen = openLojas.has(loja.id);

            return (
              <Collapsible
                key={loja.id}
                open={isOpen}
                onOpenChange={() => toggleLoja(loja.id)}
                className="bg-card rounded-lg border shadow-sm"
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <div className="text-left">
                        <h2 className="text-xl font-semibold">{loja.nome}</h2>
                        <p className="text-sm text-muted-foreground">
                          Responsável: {loja.responsavel}
                        </p>
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="p-4 border-t">
                    {/* Cabeçalho da tabela */}
                    <div className="grid grid-cols-12 gap-4 mb-4 text-sm font-medium text-muted-foreground">
                      <div className="col-span-2">Item</div>
                      <div className="col-span-2 text-center">Final (sobra)</div>
                      <div className="col-span-2 text-center">Peso Total</div>
                      <div className="col-span-2 text-center">Ideal (Amanhã)</div>
                      <div className="col-span-2 text-center">A Produzir</div>
                      <div className="col-span-2 text-center">Ações</div>
                    </div>

                    {/* Linhas de itens */}
                    {itens.map((item) => {
                      const contagem = contagensLoja.find(c => c.item_porcionado_id === item.id);
                      const finalSobra = getEditingValue(loja.id, item.id, 'final_sobra', contagem?.final_sobra || 0);
                      const pesoTotal = getEditingValue(loja.id, item.id, 'peso_total_g', contagem?.peso_total_g || '');
                      // Buscar ideal_amanha dos estoques ideais semanais, não da contagem salva
                      const idealAmanha = getEditingValue(loja.id, item.id, 'ideal_amanha', 0);
                      const aProduzir = Math.max(0, Number(idealAmanha) - Number(finalSobra));

                      return (
                        <div key={item.id} className="mb-6">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-2">
                              <div className="font-medium">{item.nome}</div>
                            </div>

                            <div className="col-span-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Final (sobra)</Label>
                                <div className="flex gap-1 items-center">
                                  <Input
                                    type="number"
                                    value={finalSobra}
                                    onChange={(e) => handleValueChange(loja.id, item.id, 'final_sobra', e.target.value)}
                                    className="text-center"
                                  />
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">unidade</span>
                                </div>
                                {finalSobra > 0 && (
                                  <p className="text-xs text-muted-foreground italic">
                                    {numberToWords(finalSobra, 'unidade')}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="col-span-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Peso Total</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={pesoTotal}
                                  onChange={(e) => handleValueChange(loja.id, item.id, 'peso_total_g', e.target.value)}
                                  placeholder="em gramas"
                                  className="text-center"
                                />
                                {pesoTotal > 0 && (
                                  <p className="text-xs text-muted-foreground italic">
                                    {numberToWords(pesoTotal, 'g')}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="col-span-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Ideal p/ Quarta</Label>
                                <Input
                                  type="number"
                                  value={idealAmanha}
                                  onChange={(e) => handleValueChange(loja.id, item.id, 'ideal_amanha', e.target.value)}
                                  className="text-center font-medium"
                                />
                                {idealAmanha > 0 && (
                                  <p className="text-xs text-muted-foreground italic">
                                    {numberToWords(idealAmanha, 'unidade')}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="col-span-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Necessidade Prod.</Label>
                                <div className="bg-orange-500 text-white font-bold rounded-md py-2 px-3 text-center">
                                  {aProduzir} unidade
                                </div>
                              </div>
                            </div>

                            <div className="col-span-2 flex gap-2 justify-center">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openEstoquesDialog(loja.id, item.id, item.nome)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => handleSave(loja.id, item.id)}
                                className="min-w-[80px]"
                              >
                                Salvar
                              </Button>
                            </div>
                          </div>

                          {contagem && (
                            <div className="text-xs text-muted-foreground mt-2 ml-2">
                              Última contagem: {format(new Date(contagem.updated_at), "dd/MM/yyyy, HH:mm:ss", { locale: ptBR })}
                              {' '}por {contagem.usuario_nome}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Dialog de Estoques Ideais */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Definir Estoques Ideais para {selectedItem?.itemNome}
              </DialogTitle>
              <DialogDescription>
                Defina a meta de estoque para o início de cada dia da semana.
                (Unidade: unidade)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="segunda">Segunda</Label>
                  <Input
                    id="segunda"
                    type="number"
                    value={estoquesIdeais.segunda}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, segunda: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terca">Terça</Label>
                  <Input
                    id="terca"
                    type="number"
                    value={estoquesIdeais.terca}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, terca: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quarta">Quarta</Label>
                  <Input
                    id="quarta"
                    type="number"
                    value={estoquesIdeais.quarta}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, quarta: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quinta">Quinta</Label>
                  <Input
                    id="quinta"
                    type="number"
                    value={estoquesIdeais.quinta}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, quinta: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sexta">Sexta</Label>
                  <Input
                    id="sexta"
                    type="number"
                    value={estoquesIdeais.sexta}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, sexta: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sabado">Sábado</Label>
                  <Input
                    id="sabado"
                    type="number"
                    value={estoquesIdeais.sabado}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, sabado: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="domingo">Domingo</Label>
                  <Input
                    id="domingo"
                    type="number"
                    value={estoquesIdeais.domingo}
                    onChange={(e) => setEstoquesIdeais({ ...estoquesIdeais, domingo: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEstoquesIdeais}>
                Salvar Estoques Ideais
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ContagemPorcionados;
