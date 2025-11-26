import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Package, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Loja {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  codigo: string | null;
  categoria: string;
  unidade_consumo: string | null;
}

interface EstoqueMinimo {
  produto_id: string;
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

interface EstoqueAtual {
  produto_id: string;
  quantidade: number;
}

interface ProdutoEstoque extends Produto {
  estoque_minimo: number;
  estoque_atual: number;
  a_enviar: number;
  status: 'critico' | 'atencao' | 'ok';
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;

const EstoqueDiario = () => {
  const { user } = useAuth();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaSelecionada, setLojaSelecionada] = useState<string>('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [estoquesMinimos, setEstoquesMinimos] = useState<EstoqueMinimo[]>([]);
  const [estoquesAtuais, setEstoquesAtuais] = useState<EstoqueAtual[]>([]);
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>('');

  // Obter dia da semana atual
  const diaAtual = useMemo(() => {
    const dia = new Date().getDay();
    return DIAS_SEMANA[dia];
  }, []);

  // Buscar lojas do usuário
  useEffect(() => {
    const fetchLojas = async () => {
      if (!user) return;

      try {
        // Buscar lojas_acesso do usuário
        const { data: lojasAcesso, error: acessoError } = await supabase
          .from('lojas_acesso')
          .select('loja_id')
          .eq('user_id', user.id);

        if (acessoError) throw acessoError;

        if (!lojasAcesso || lojasAcesso.length === 0) {
          setLojas([]);
          return;
        }

        // Buscar detalhes das lojas
        const lojasIds = lojasAcesso.map(la => la.loja_id);
        const { data: lojasData, error: lojasError } = await supabase
          .from('lojas')
          .select('id, nome')
          .in('id', lojasIds);

        if (lojasError) throw lojasError;

        setLojas(lojasData || []);
        if (lojasData && lojasData.length > 0) {
          setLojaSelecionada(lojasData[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar lojas:', error);
        toast.error('Erro ao carregar lojas');
      }
    };

    fetchLojas();
  }, [user]);

  // Buscar produtos, estoques mínimos e atuais
  useEffect(() => {
    const fetchDados = async () => {
      if (!lojaSelecionada) return;

      try {
        setLoading(true);

        // Buscar produtos
        const { data: produtosData, error: produtosError } = await supabase
          .from('produtos')
          .select('id, nome, codigo, categoria, unidade_consumo')
          .order('nome');

        if (produtosError) throw produtosError;
        setProdutos(produtosData || []);

        // Buscar estoques mínimos configurados para a loja
        const { data: estoquesMinimosData, error: estoquesMinimosError } = await supabase
          .from('produtos_estoque_minimo_semanal')
          .select('produto_id, segunda, terca, quarta, quinta, sexta, sabado, domingo')
          .eq('loja_id', lojaSelecionada);

        if (estoquesMinimosError) throw estoquesMinimosError;
        setEstoquesMinimos(estoquesMinimosData || []);

        // Buscar estoques atuais da loja
        const { data: estoquesAtuaisData, error: estoquesAtuaisError } = await supabase
          .from('estoque_loja_produtos')
          .select('produto_id, quantidade, data_ultima_atualizacao, usuario_nome')
          .eq('loja_id', lojaSelecionada);

        if (estoquesAtuaisError) throw estoquesAtuaisError;
        
        // Converter para o formato esperado
        const estoquesMap = (estoquesAtuaisData || []).map(e => ({
          produto_id: e.produto_id,
          quantidade: Number(e.quantidade)
        }));
        setEstoquesAtuais(estoquesMap);

        // Pegar última atualização
        if (estoquesAtuaisData && estoquesAtuaisData.length > 0) {
          const maisRecente = estoquesAtuaisData.reduce((prev, current) => 
            new Date(current.data_ultima_atualizacao) > new Date(prev.data_ultima_atualizacao) 
              ? current 
              : prev
          );
          const data = new Date(maisRecente.data_ultima_atualizacao);
          setUltimaAtualizacao(
            `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por ${maisRecente.usuario_nome || 'Usuário'}`
          );
        } else {
          setUltimaAtualizacao('');
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchDados();
  }, [lojaSelecionada]);

  // Calcular produtos com estoque
  const produtosComEstoque = useMemo((): ProdutoEstoque[] => {
    return produtos.map(produto => {
      // Buscar estoque mínimo do dia atual
      const estoqueMinimo = estoquesMinimos.find(e => e.produto_id === produto.id);
      const minimoHoje = estoqueMinimo ? estoqueMinimo[diaAtual] : 0;

      // Buscar estoque atual
      const estoqueAtualObj = estoquesAtuais.find(e => e.produto_id === produto.id);
      const estoqueAtual = estoqueAtualObj ? estoqueAtualObj.quantidade : 0;

      // Calcular a enviar
      const aEnviar = Math.max(0, minimoHoje - estoqueAtual);

      // Determinar status
      let status: 'critico' | 'atencao' | 'ok' = 'ok';
      if (minimoHoje > 0) {
        const percentual = (estoqueAtual / minimoHoje) * 100;
        if (percentual < 50) status = 'critico';
        else if (percentual < 100) status = 'atencao';
      }

      return {
        ...produto,
        estoque_minimo: minimoHoje,
        estoque_atual: estoqueAtual,
        a_enviar: aEnviar,
        status
      };
    });
  }, [produtos, estoquesMinimos, estoquesAtuais, diaAtual]);

  // Filtrar por categoria
  const produtosFiltrados = useMemo(() => {
    if (categoriaFilter === 'todas') return produtosComEstoque;
    return produtosComEstoque.filter(p => p.categoria === categoriaFilter);
  }, [produtosComEstoque, categoriaFilter]);

  // Categorias únicas
  const categorias = useMemo(() => {
    const cats = [...new Set(produtos.map(p => p.categoria))];
    return cats.sort();
  }, [produtos]);

  // Atualizar estoque atual de um produto
  const handleEstoqueChange = (produtoId: string, valor: string) => {
    const quantidade = valor === '' ? 0 : Number(valor);
    
    setEstoquesAtuais(prev => {
      const existente = prev.find(e => e.produto_id === produtoId);
      if (existente) {
        return prev.map(e => 
          e.produto_id === produtoId 
            ? { ...e, quantidade } 
            : e
        );
      } else {
        return [...prev, { produto_id: produtoId, quantidade }];
      }
    });
  };

  // Salvar estoques
  const handleSalvar = async () => {
    if (!user || !lojaSelecionada) return;

    try {
      setSaving(true);

      // Buscar nome do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      const usuarioNome = profile?.nome || user.email || 'Usuário';

      // Preparar dados para upsert
      const dados = estoquesAtuais.map(e => ({
        loja_id: lojaSelecionada,
        produto_id: e.produto_id,
        quantidade: e.quantidade,
        usuario_id: user.id,
        usuario_nome: usuarioNome,
        data_ultima_atualizacao: new Date().toISOString()
      }));

      // Fazer upsert (insert or update)
      const { error } = await supabase
        .from('estoque_loja_produtos')
        .upsert(dados, {
          onConflict: 'loja_id,produto_id'
        });

      if (error) throw error;

      toast.success('Estoque atualizado com sucesso!');
      
      // Atualizar última atualização
      const agora = new Date();
      setUltimaAtualizacao(
        `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por ${usuarioNome}`
      );
    } catch (error) {
      console.error('Erro ao salvar estoque:', error);
      toast.error('Erro ao salvar estoque');
    } finally {
      setSaving(false);
    }
  };

  // Renderizar indicador de status
  const StatusIcon = ({ status }: { status: 'critico' | 'atencao' | 'ok' }) => {
    switch (status) {
      case 'critico':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'atencao':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Faça login para acessar esta página.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Estoque da Loja</h1>
          <p className="text-muted-foreground mt-1">
            Controle o estoque de produtos na loja
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Estoque de Produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Selecione a Loja</label>
                <Select value={lojaSelecionada} onValueChange={setLojaSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.map(loja => (
                      <SelectItem key={loja.id} value={loja.id}>
                        {loja.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Filtrar por Categoria</label>
                <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as categorias</SelectItem>
                    {categorias.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabela de Produtos */}
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Produto</th>
                      <th className="text-left p-3 font-medium">Código</th>
                      <th className="text-left p-3 font-medium">Unid.</th>
                      <th className="text-center p-3 font-medium">Est. Mín.<br />(Hoje)</th>
                      <th className="text-center p-3 font-medium">Est. Atual</th>
                      <th className="text-center p-3 font-medium">A Enviar</th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map(produto => (
                      <tr key={produto.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">{produto.nome}</td>
                        <td className="p-3 text-muted-foreground">{produto.codigo || '-'}</td>
                        <td className="p-3 text-muted-foreground">{produto.unidade_consumo || 'unid.'}</td>
                        <td className="p-3 text-center font-medium">{produto.estoque_minimo}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={produto.estoque_atual}
                            onChange={(e) => handleEstoqueChange(produto.id, e.target.value)}
                            className="w-24 mx-auto text-center"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <span className={`font-semibold ${produto.a_enviar > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {produto.a_enviar.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center">
                            <StatusIcon status={produto.status} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rodapé */}
            {!loading && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {ultimaAtualizacao ? (
                    <>Última atualização: {ultimaAtualizacao}</>
                  ) : (
                    <>Nenhuma atualização registrada</>
                  )}
                </div>
                <Button 
                  onClick={handleSalvar} 
                  disabled={saving || produtosFiltrados.length === 0}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Salvando...' : 'Salvar Estoque'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EstoqueDiario;
