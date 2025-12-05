import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { Settings, Loader2 } from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  codigo: string;
}

interface EstoqueConfig {
  produto_id: string;
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

interface Loja {
  id: string;
  nome: string;
}

interface ConfigurarEstoqueMinimoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfigurarEstoqueMinimoModal({ open, onOpenChange }: ConfigurarEstoqueMinimoModalProps) {
  const { organizationId } = useOrganization();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaSelecionada, setLojaSelecionada] = useState<string>("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [configs, setConfigs] = useState<Record<string, EstoqueConfig>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preenchimentoRapido, setPreenchimentoRapido] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchLojas();
      fetchProdutosClasseA();
    }
  }, [open]);

  useEffect(() => {
    if (lojaSelecionada) {
      fetchConfiguracoes();
    }
  }, [lojaSelecionada, produtos]);

  const fetchLojas = async () => {
    try {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome")
        .order("nome");

      if (error) throw error;
      setLojas(data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
      toast.error("Erro ao carregar lojas");
    }
  };

  const fetchProdutosClasseA = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, codigo")
        .eq("classificacao", "A")
        .order("nome");

      if (error) throw error;
      setProdutos(data || []);
      
      // Inicializar configs com valores zerados
      const initialConfigs: Record<string, EstoqueConfig> = {};
      (data || []).forEach(produto => {
        initialConfigs[produto.id] = {
          produto_id: produto.id,
          segunda: 0,
          terca: 0,
          quarta: 0,
          quinta: 0,
          sexta: 0,
          sabado: 0,
          domingo: 0
        };
      });
      setConfigs(initialConfigs);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar produtos classe A");
    } finally {
      setLoading(false);
    }
  };

  const fetchConfiguracoes = async () => {
    if (!lojaSelecionada || produtos.length === 0) return;

    try {
      const { data, error } = await supabase
        .from("produtos_estoque_minimo_semanal")
        .select("*")
        .eq("loja_id", lojaSelecionada);

      if (error) throw error;

      // Atualizar configs com dados salvos
      const updatedConfigs = { ...configs };
      (data || []).forEach(config => {
        updatedConfigs[config.produto_id] = {
          produto_id: config.produto_id,
          segunda: config.segunda,
          terca: config.terca,
          quarta: config.quarta,
          quinta: config.quinta,
          sexta: config.sexta,
          sabado: config.sabado,
          domingo: config.domingo
        };
      });
      setConfigs(updatedConfigs);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações existentes");
    }
  };

  const handleConfigChange = (produtoId: string, dia: keyof Omit<EstoqueConfig, 'produto_id'>, valor: string) => {
    const valorNumerico = parseInt(valor) || 0;
    setConfigs(prev => ({
      ...prev,
      [produtoId]: {
        ...prev[produtoId],
        [dia]: valorNumerico
      }
    }));
  };

  const aplicarPreenchimentoRapido = () => {
    const valor = parseInt(preenchimentoRapido) || 0;
    const updatedConfigs = { ...configs };
    
    Object.keys(updatedConfigs).forEach(produtoId => {
      updatedConfigs[produtoId] = {
        produto_id: produtoId,
        segunda: valor,
        terca: valor,
        quarta: valor,
        quinta: valor,
        sexta: valor,
        sabado: valor,
        domingo: valor
      };
    });
    
    setConfigs(updatedConfigs);
    toast.success(`Valor ${valor} aplicado para todos os produtos e dias`);
    setPreenchimentoRapido("");
  };

  const handleSalvar = async () => {
    if (!lojaSelecionada) {
      toast.error("Selecione uma loja");
      return;
    }

    setSaving(true);
    try {
      // Preparar dados para upsert
      const configsArray = Object.values(configs).map(config => ({
        produto_id: config.produto_id,
        loja_id: lojaSelecionada,
        segunda: config.segunda,
        terca: config.terca,
        quarta: config.quarta,
        quinta: config.quinta,
        sexta: config.sexta,
        sabado: config.sabado,
        domingo: config.domingo,
        organization_id: organizationId
      }));

      const { error } = await supabase
        .from("produtos_estoque_minimo_semanal")
        .upsert(configsArray, { 
          onConflict: 'produto_id,loja_id'
        });

      if (error) throw error;

      toast.success(`Configuração salva com sucesso para ${produtos.length} produtos!`);
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="h-5 w-5" />
            Configurar Estoque Mínimo Semanal - Produtos Classe A
          </DialogTitle>
          <DialogDescription>
            Defina as quantidades mínimas de estoque para cada dia da semana por loja
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seleção de Loja */}
          <div className="space-y-2">
            <Label htmlFor="loja">Selecione a Loja *</Label>
            <Select value={lojaSelecionada} onValueChange={setLojaSelecionada}>
              <SelectTrigger id="loja">
                <SelectValue placeholder="Escolha uma loja..." />
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

          {/* Preenchimento Rápido */}
          {lojaSelecionada && (
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label htmlFor="preenchimento-rapido">⚡ Preenchimento Rápido</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="preenchimento-rapido"
                      type="number"
                      min="0"
                      value={preenchimentoRapido}
                      onChange={(e) => setPreenchimentoRapido(e.target.value)}
                      placeholder="Digite um valor padrão"
                      className="max-w-xs"
                    />
                    <Button 
                      onClick={aplicarPreenchimentoRapido}
                      disabled={!preenchimentoRapido}
                      variant="secondary"
                    >
                      Aplicar para Todos
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabela de Produtos */}
          {lojaSelecionada && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : produtos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum produto com classificação A encontrado
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground sticky left-0 bg-muted z-10">
                            Produto
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Seg</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Ter</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Qua</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Qui</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Sex</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Sáb</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Dom</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {produtos.map(produto => (
                          <tr key={produto.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 text-sm sticky left-0 bg-background z-10">
                              <div className="font-medium">{produto.nome}</div>
                              {produto.codigo && (
                                <div className="text-xs text-muted-foreground">{produto.codigo}</div>
                              )}
                            </td>
                            {(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const).map(dia => (
                              <td key={dia} className="px-2 py-3">
                                <Input
                                  type="number"
                                  min="0"
                                  value={configs[produto.id]?.[dia] || 0}
                                  onChange={(e) => handleConfigChange(produto.id, dia, e.target.value)}
                                  className="w-16 text-center"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm text-muted-foreground">
                  💡 Dica: Finais de semana geralmente têm maior demanda. Configure valores apropriados para cada dia.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSalvar} 
            disabled={!lojaSelecionada || saving || loading}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              <>💾 Salvar Configuração</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}