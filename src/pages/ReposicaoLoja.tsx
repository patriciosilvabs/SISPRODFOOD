import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCPDLoja } from '@/hooks/useCPDLoja';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Store, Package, Truck, AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

interface EstoqueCPD {
  produto_id: string;
  quantidade: number;
}

interface EstoqueMinimo {
  produto_id: string;
  loja_id: string;
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

interface EstoqueLoja {
  produto_id: string;
  loja_id: string;
  quantidade: number;
  data_ultima_contagem: string | null;
}

interface DemandaLoja {
  loja: Loja;
  produto: Produto;
  estoque_minimo: number;
  estoque_atual_loja: number;
  estoque_cpd: number;
  a_repor: number;
  quantidade_envio: number;
  ultima_contagem: string | null;
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;

const ReposicaoLoja = () => {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const { cpdLojaId } = useCPDLoja();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaSelecionada, setLojaSelecionada] = useState<string>('todas');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [estoqueCPD, setEstoqueCPD] = useState<EstoqueCPD[]>([]);
  const [estoquesMinimos, setEstoquesMinimos] = useState<EstoqueMinimo[]>([]);
  const [estoquesLojas, setEstoquesLojas] = useState<EstoqueLoja[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [quantidadesEnvio, setQuantidadesEnvio] = useState<{ [key: string]: number }>({});
  const [observacao, setObservacao] = useState('');

  const diaAtual = useMemo(() => {
    const dia = new Date().getDay();
    return DIAS_SEMANA[dia];
  }, []);

  // Buscar dados
  const fetchDados = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      // Buscar lojas (excluindo CPD)
      const { data: lojasData, error: lojasError } = await supabase
        .from('lojas')
        .select('id, nome')
        .neq('tipo', 'cpd')
        .order('nome');

      if (lojasError) throw lojasError;
      setLojas(lojasData || []);

      // Buscar produtos
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('id, nome, codigo, categoria, unidade_consumo')
        .eq('ativo', true)
        .order('nome');

      if (produtosError) throw produtosError;
      setProdutos(produtosData || []);

      // Buscar estoque CPD (agora da tabela unificada)
      if (cpdLojaId) {
        const { data: estoqueCPDData, error: estoqueCPDError } = await supabase
          .from('estoque_loja_produtos')
          .select('produto_id, quantidade')
          .eq('loja_id', cpdLojaId);

        if (estoqueCPDError) throw estoqueCPDError;
        setEstoqueCPD(estoqueCPDData || []);
      } else {
        setEstoqueCPD([]);
      }

      // Buscar estoques mínimos semanais
      const { data: estoquesMinimosData, error: estoquesMinimosError } = await supabase
        .from('produtos_estoque_minimo_semanal')
        .select('produto_id, loja_id, segunda, terca, quarta, quinta, sexta, sabado, domingo');

      if (estoquesMinimosError) throw estoquesMinimosError;
      setEstoquesMinimos(estoquesMinimosData || []);

      // Buscar estoques das lojas
      const { data: estoquesLojasData, error: estoquesLojasError } = await supabase
        .from('estoque_loja_produtos')
        .select('produto_id, loja_id, quantidade, data_ultima_contagem');

      if (estoquesLojasError) throw estoquesLojasError;
      setEstoquesLojas(estoquesLojasData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados de reposição');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cpdLojaId) {
      fetchDados();
    }
  }, [organizationId, cpdLojaId]);

  // Calcular demandas de reposição
  const demandas = useMemo((): DemandaLoja[] => {
    const resultado: DemandaLoja[] = [];

    const lojasParaProcessar = lojaSelecionada === 'todas' 
      ? lojas 
      : lojas.filter(l => l.id === lojaSelecionada);

    for (const loja of lojasParaProcessar) {
      for (const produto of produtos) {
        // Estoque mínimo do dia atual para esta loja/produto
        const estoqueMinConfig = estoquesMinimos.find(
          e => e.produto_id === produto.id && e.loja_id === loja.id
        );
        const estoqueMinimo = estoqueMinConfig ? estoqueMinConfig[diaAtual] : 0;

        // Estoque atual da loja
        const estoqueLoja = estoquesLojas.find(
          e => e.produto_id === produto.id && e.loja_id === loja.id
        );
        const estoqueAtualLoja = estoqueLoja?.quantidade || 0;

        // Estoque CPD
        const estoqueCPDItem = estoqueCPD.find(e => e.produto_id === produto.id);
        const estoqueAtualCPD = estoqueCPDItem?.quantidade || 0;

        // Calcular a repor
        const aRepor = Math.max(0, estoqueMinimo - estoqueAtualLoja);

        // Só incluir se há necessidade de reposição
        if (aRepor > 0) {
          resultado.push({
            loja,
            produto,
            estoque_minimo: estoqueMinimo,
            estoque_atual_loja: estoqueAtualLoja,
            estoque_cpd: estoqueAtualCPD,
            a_repor: aRepor,
            quantidade_envio: quantidadesEnvio[`${loja.id}_${produto.id}`] ?? aRepor,
            ultima_contagem: estoqueLoja?.data_ultima_contagem || null
          });
        }
      }
    }

    return resultado.sort((a, b) => {
      // Ordenar por loja, depois por produto
      const lojaCompare = a.loja.nome.localeCompare(b.loja.nome);
      if (lojaCompare !== 0) return lojaCompare;
      return a.produto.nome.localeCompare(b.produto.nome);
    });
  }, [lojas, produtos, estoqueCPD, estoquesMinimos, estoquesLojas, lojaSelecionada, diaAtual, quantidadesEnvio]);

  // Inicializar quantidades de envio
  useEffect(() => {
    const novasQuantidades: { [key: string]: number } = {};
    demandas.forEach(d => {
      const key = `${d.loja.id}_${d.produto.id}`;
      if (quantidadesEnvio[key] === undefined) {
        novasQuantidades[key] = d.a_repor;
      }
    });
    if (Object.keys(novasQuantidades).length > 0) {
      setQuantidadesEnvio(prev => ({ ...prev, ...novasQuantidades }));
    }
  }, [demandas]);

  // Atualizar quantidade de envio
  const handleQuantidadeChange = (lojaId: string, produtoId: string, valor: string) => {
    const key = `${lojaId}_${produtoId}`;
    const quantidade = valor === '' ? 0 : Number(valor);
    setQuantidadesEnvio(prev => ({ ...prev, [key]: quantidade }));
  };

  // Confirmar envio de reposição
  const handleConfirmarEnvio = async () => {
    if (!user || !organizationId) return;

    // Filtrar apenas produtos com quantidade > 0
    const itensParaEnviar = demandas.filter(d => {
      const key = `${d.loja.id}_${d.produto.id}`;
      return (quantidadesEnvio[key] || 0) > 0;
    });

    if (itensParaEnviar.length === 0) {
      toast.error('Nenhum item selecionado para envio');
      return;
    }

    // Validar estoque CPD
    const semEstoque: string[] = [];
    itensParaEnviar.forEach(item => {
      const key = `${item.loja.id}_${item.produto.id}`;
      const qtdEnvio = quantidadesEnvio[key] || 0;
      if (qtdEnvio > item.estoque_cpd) {
        semEstoque.push(`${item.produto.nome} (CPD: ${item.estoque_cpd}, Solicitado: ${qtdEnvio})`);
      }
    });

    if (semEstoque.length > 0) {
      toast.error(`Estoque CPD insuficiente para: ${semEstoque.join(', ')}`);
      return;
    }

    try {
      setSending(true);

      // Buscar nome do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      const usuarioNome = profile?.nome || user.email || 'Usuário';

      // Agrupar por loja
      const porLoja = new Map<string, typeof itensParaEnviar>();
      itensParaEnviar.forEach(item => {
        const lista = porLoja.get(item.loja.id) || [];
        lista.push(item);
        porLoja.set(item.loja.id, lista);
      });

      // Processar cada loja
      for (const [lojaId, itens] of porLoja) {
        const loja = lojas.find(l => l.id === lojaId);
        if (!loja) continue;

        // Criar romaneio de produtos
        const { data: romaneio, error: romaneioError } = await supabase
          .from('romaneios_produtos')
          .insert({
            loja_id: lojaId,
            loja_nome: loja.nome,
            usuario_id: user.id,
            usuario_nome: usuarioNome,
            status: 'enviado',
            data_criacao: new Date().toISOString(),
            data_envio: new Date().toISOString(),
            observacao: observacao || null,
            organization_id: organizationId
          })
          .select()
          .single();

        if (romaneioError) throw romaneioError;

        // Adicionar itens ao romaneio
        for (const item of itens) {
          const key = `${item.loja.id}_${item.produto.id}`;
          const qtdEnvio = quantidadesEnvio[key] || 0;

          // Inserir item do romaneio
          await supabase
            .from('romaneios_produtos_itens')
            .insert({
              romaneio_id: romaneio.id,
              produto_id: item.produto.id,
              produto_nome: item.produto.nome,
              quantidade: qtdEnvio,
              unidade: item.produto.unidade_consumo || 'un',
              organization_id: organizationId
            });

          // Debitar estoque CPD (tabela unificada)
          const novoEstoqueCPD = item.estoque_cpd - qtdEnvio;
          await supabase
            .from('estoque_loja_produtos')
            .update({ 
              quantidade: novoEstoqueCPD,
              data_ultima_atualizacao: new Date().toISOString()
            })
            .eq('loja_id', cpdLojaId)
            .eq('produto_id', item.produto.id);

          // Registrar movimentação CPD
          await supabase
            .from('movimentacoes_cpd_produtos')
            .insert({
              produto_id: item.produto.id,
              produto_nome: item.produto.nome,
              quantidade: qtdEnvio,
              quantidade_anterior: item.estoque_cpd,
              quantidade_posterior: novoEstoqueCPD,
              tipo: 'saida_romaneio',
              observacao: `Reposição para ${loja.nome}`,
              usuario_id: user.id,
              usuario_nome: usuarioNome,
              organization_id: organizationId
            });

          // Atualizar estoque loja (quantidade_ultimo_envio)
          await supabase
            .from('estoque_loja_produtos')
            .upsert({
              loja_id: lojaId,
              produto_id: item.produto.id,
              quantidade: item.estoque_atual_loja,
              quantidade_ultimo_envio: qtdEnvio,
              data_ultimo_envio: new Date().toISOString(),
              organization_id: organizationId
            }, { onConflict: 'loja_id,produto_id' });
        }
      }

      toast.success(`Reposição enviada para ${porLoja.size} loja(s) com sucesso!`);
      
      // Resetar estados
      setQuantidadesEnvio({});
      setObservacao('');
      
      // Recarregar dados
      await fetchDados();

    } catch (error) {
      console.error('Erro ao enviar reposição:', error);
      toast.error('Erro ao enviar reposição');
    } finally {
      setSending(false);
    }
  };

  // Agrupar demandas por loja para exibição
  const demandasPorLoja = useMemo(() => {
    const agrupado = new Map<string, DemandaLoja[]>();
    demandas.forEach(d => {
      const lista = agrupado.get(d.loja.id) || [];
      lista.push(d);
      agrupado.set(d.loja.id, lista);
    });
    return agrupado;
  }, [demandas]);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Store className="h-8 w-8" />
              Reposição de Loja
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize demandas consolidadas e envie reposição para as lojas
            </p>
          </div>
          <Button variant="outline" onClick={fetchDados} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Demandas de Reposição
            </CardTitle>
            <CardDescription>
              Produtos com estoque abaixo do mínimo configurado para cada loja
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtro de Loja */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Filtrar por Loja</label>
                <Select value={lojaSelecionada} onValueChange={setLojaSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as lojas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Lojas</SelectItem>
                    {lojas.map(loja => (
                      <SelectItem key={loja.id} value={loja.id}>
                        {loja.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Badge variant="secondary" className="text-sm">
                  {demandas.length} produto(s) com demanda de reposição
                </Badge>
              </div>
            </div>

            {/* Lista de Demandas */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : demandas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
                <p className="text-lg font-medium">Nenhuma demanda de reposição!</p>
                <p className="text-sm">Todas as lojas estão com estoque adequado.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(demandasPorLoja.entries()).map(([lojaId, itens]) => {
                  const loja = lojas.find(l => l.id === lojaId);
                  return (
                    <Card key={lojaId} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Store className="h-5 w-5 text-primary" />
                          {loja?.nome}
                          <Badge variant="outline" className="ml-2">
                            {itens.length} item(s)
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b text-sm">
                                <th className="text-left p-2 font-medium">Produto</th>
                                <th className="text-center p-2 font-medium">Est. Mín<br />(Hoje)</th>
                                <th className="text-center p-2 font-medium">Est. Loja</th>
                                <th className="text-center p-2 font-medium">Est. CPD</th>
                                <th className="text-center p-2 font-medium">A Repor</th>
                                <th className="text-center p-2 font-medium">Qtd Envio</th>
                                <th className="text-center p-2 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itens.map(item => {
                                const key = `${item.loja.id}_${item.produto.id}`;
                                const qtdEnvio = quantidadesEnvio[key] ?? item.a_repor;
                                const semEstoque = qtdEnvio > item.estoque_cpd;
                                
                                return (
                                  <tr key={key} className="border-b hover:bg-muted/50">
                                    <td className="p-2">
                                      <div className="font-medium">{item.produto.nome}</div>
                                      {item.produto.codigo && (
                                        <div className="text-xs text-muted-foreground">{item.produto.codigo}</div>
                                      )}
                                    </td>
                                    <td className="p-2 text-center font-medium">{item.estoque_minimo}</td>
                                    <td className="p-2 text-center">{item.estoque_atual_loja}</td>
                                    <td className="p-2 text-center">
                                      <span className={semEstoque ? 'text-destructive font-medium' : ''}>
                                        {item.estoque_cpd}
                                      </span>
                                    </td>
                                    <td className="p-2 text-center">
                                      <span className="text-primary font-semibold">{item.a_repor}</span>
                                    </td>
                                    <td className="p-2">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={qtdEnvio}
                                        onChange={(e) => handleQuantidadeChange(item.loja.id, item.produto.id, e.target.value)}
                                        className="w-20 mx-auto text-center"
                                      />
                                    </td>
                                    <td className="p-2 text-center">
                                      {semEstoque ? (
                                        <div className="flex items-center justify-center gap-1 text-destructive">
                                          <AlertCircle className="h-4 w-4" />
                                          <span className="text-xs">Insuficiente</span>
                                        </div>
                                      ) : qtdEnvio > 0 ? (
                                        <div className="flex items-center justify-center gap-1 text-green-600">
                                          <CheckCircle className="h-4 w-4" />
                                          <span className="text-xs">OK</span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Observação e Botão de Envio */}
            {demandas.length > 0 && (
              <>
                <div className="space-y-2 pt-4 border-t">
                  <label className="text-sm font-medium">Observação do Envio (opcional)</label>
                  <Textarea
                    placeholder="Adicione uma observação sobre a reposição"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleConfirmarEnvio}
                    disabled={sending || demandas.every(d => {
                      const key = `${d.loja.id}_${d.produto.id}`;
                      return (quantidadesEnvio[key] || 0) === 0;
                    })}
                    size="lg"
                    className="gap-2"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Truck className="h-4 w-4" />
                    )}
                    {sending ? 'Enviando...' : 'Confirmar Envio de Reposição'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ReposicaoLoja;
