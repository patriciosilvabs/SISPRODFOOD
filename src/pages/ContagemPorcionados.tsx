import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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

const ContagemPorcionados = () => {
  const { user } = useAuth();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [itens, setItens] = useState<ItemPorcionado[]>([]);
  const [contagens, setContagens] = useState<Record<string, Contagem[]>>({});
  const [openLojas, setOpenLojas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});

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

    if (!values || !user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      const dataToSave = {
        loja_id: lojaId,
        item_porcionado_id: itemId,
        final_sobra: parseInt(values.final_sobra) || 0,
        peso_total_g: values.peso_total_g ? parseFloat(values.peso_total_g) : null,
        ideal_amanha: parseInt(values.ideal_amanha) || 0,
        usuario_id: user.id,
        usuario_nome: profile?.nome || user.email || 'Usuário',
      };

      const { error } = await supabase
        .from('contagem_porcionados')
        .upsert(dataToSave, {
          onConflict: 'loja_id,item_porcionado_id',
        });

      if (error) throw error;

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

  const getEditingValue = (lojaId: string, itemId: string, field: string, defaultValue: any) => {
    const key = `${lojaId}-${itemId}`;
    return editingValues[key]?.[field] ?? defaultValue;
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
                      const idealAmanha = getEditingValue(loja.id, item.id, 'ideal_amanha', contagem?.ideal_amanha || 0);
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
                              <Button variant="ghost" size="icon">
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
      </div>
    </Layout>
  );
};

export default ContagemPorcionados;
