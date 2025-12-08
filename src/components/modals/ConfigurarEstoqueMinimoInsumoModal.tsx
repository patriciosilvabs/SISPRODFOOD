import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { Search, Save, Zap } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
}

interface EstoqueConfig {
  insumo_id: string;
  segunda: number;
  terca: number;
  quarta: number;
  quinta: number;
  sexta: number;
  sabado: number;
  domingo: number;
}

interface ConfigurarEstoqueMinimoInsumoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfigurarEstoqueMinimoInsumoModal({
  open,
  onOpenChange,
}: ConfigurarEstoqueMinimoInsumoModalProps) {
  const { organizationId } = useOrganization();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [estoqueConfigs, setEstoqueConfigs] = useState<Record<string, EstoqueConfig>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preenchimentoRapido, setPreenchimentoRapido] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open) {
      fetchInsumos();
      fetchEstoqueConfigs();
    }
  }, [open, organizationId]);

  const fetchInsumos = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("insumos")
        .select("id, nome, unidade_medida")
        .eq("organization_id", organizationId)
        .order("nome");

      if (error) throw error;
      setInsumos(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar insumos:", error);
      toast.error("Erro ao carregar insumos");
    } finally {
      setLoading(false);
    }
  };

  const fetchEstoqueConfigs = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from("insumos_estoque_minimo_semanal")
        .select("*")
        .eq("organization_id", organizationId);

      if (error) throw error;

      const configMap: Record<string, EstoqueConfig> = {};
      (data || []).forEach((config: any) => {
        configMap[config.insumo_id] = {
          insumo_id: config.insumo_id,
          segunda: config.segunda || 0,
          terca: config.terca || 0,
          quarta: config.quarta || 0,
          quinta: config.quinta || 0,
          sexta: config.sexta || 0,
          sabado: config.sabado || 0,
          domingo: config.domingo || 0,
        };
      });
      setEstoqueConfigs(configMap);
    } catch (error: any) {
      console.error("Erro ao buscar configurações:", error);
    }
  };

  const getConfigForInsumo = (insumoId: string): EstoqueConfig => {
    return (
      estoqueConfigs[insumoId] || {
        insumo_id: insumoId,
        segunda: 0,
        terca: 0,
        quarta: 0,
        quinta: 0,
        sexta: 0,
        sabado: 0,
        domingo: 0,
      }
    );
  };

  const updateConfig = (
    insumoId: string,
    dia: keyof Omit<EstoqueConfig, "insumo_id">,
    value: number
  ) => {
    setEstoqueConfigs((prev) => ({
      ...prev,
      [insumoId]: {
        ...getConfigForInsumo(insumoId),
        [dia]: value,
      },
    }));
  };

  const aplicarPreenchimentoRapido = () => {
    const valor = parseFloat(preenchimentoRapido) || 0;
    if (valor <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    const insumosVisiveis = insumosFiltrados;
    const newConfigs = { ...estoqueConfigs };

    insumosVisiveis.forEach((insumo) => {
      newConfigs[insumo.id] = {
        insumo_id: insumo.id,
        segunda: valor,
        terca: valor,
        quarta: valor,
        quinta: valor,
        sexta: valor,
        sabado: valor,
        domingo: valor,
      };
    });

    setEstoqueConfigs(newConfigs);
    toast.success(`Valor ${valor} aplicado para ${insumosVisiveis.length} insumos`);
    setPreenchimentoRapido("");
  };

  const handleSave = async () => {
    if (!organizationId) {
      toast.error("Organização não identificada");
      return;
    }

    setSaving(true);

    try {
      const configsToSave = Object.values(estoqueConfigs).filter(
        (config) =>
          config.segunda > 0 ||
          config.terca > 0 ||
          config.quarta > 0 ||
          config.quinta > 0 ||
          config.sexta > 0 ||
          config.sabado > 0 ||
          config.domingo > 0
      );

      if (configsToSave.length === 0) {
        toast.info("Nenhuma configuração para salvar");
        setSaving(false);
        return;
      }

      const dataToUpsert = configsToSave.map((config) => ({
        insumo_id: config.insumo_id,
        segunda: config.segunda,
        terca: config.terca,
        quarta: config.quarta,
        quinta: config.quinta,
        sexta: config.sexta,
        sabado: config.sabado,
        domingo: config.domingo,
        organization_id: organizationId,
      }));

      const { error } = await supabase
        .from("insumos_estoque_minimo_semanal")
        .upsert(dataToUpsert, {
          onConflict: "insumo_id,organization_id",
        });

      if (error) throw error;

      toast.success(`${configsToSave.length} configurações salvas com sucesso!`);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const insumosFiltrados = useMemo(() => {
    return insumos.filter((i) => {
      const matchSearch =
        searchTerm === "" ||
        i.nome.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [insumos, searchTerm]);

  const diasSemana = [
    { key: "segunda", label: "Seg" },
    { key: "terca", label: "Ter" },
    { key: "quarta", label: "Qua" },
    { key: "quinta", label: "Qui" },
    { key: "sexta", label: "Sex" },
    { key: "sabado", label: "Sáb" },
    { key: "domingo", label: "Dom" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Estoque Mínimo Semanal de Insumos</DialogTitle>
          <DialogDescription>
            Defina o estoque mínimo para cada insumo por dia da semana
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtros e Preenchimento Rápido */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar insumo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                placeholder="Valor"
                value={preenchimentoRapido}
                onChange={(e) => setPreenchimentoRapido(e.target.value)}
                className="w-24"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={aplicarPreenchimentoRapido}
              >
                <Zap className="h-4 w-4 mr-1" />
                Aplicar
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Exibindo {insumosFiltrados.length} de {insumos.length} insumos
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="border rounded-md max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="min-w-[200px]">Insumo</TableHead>
                    {diasSemana.map((dia) => (
                      <TableHead key={dia.key} className="text-center w-20">
                        {dia.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insumosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        Nenhum insumo encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    insumosFiltrados.map((insumo) => {
                      const config = getConfigForInsumo(insumo.id);
                      return (
                        <TableRow key={insumo.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{insumo.nome}</span>
                              <Badge variant="outline" className="text-xs w-fit">
                                {insumo.unidade_medida}
                              </Badge>
                            </div>
                          </TableCell>
                          {diasSemana.map((dia) => (
                            <TableCell key={dia.key} className="p-1">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={config[dia.key] || ""}
                                onChange={(e) =>
                                  updateConfig(
                                    insumo.id,
                                    dia.key,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="h-8 text-center w-16"
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
