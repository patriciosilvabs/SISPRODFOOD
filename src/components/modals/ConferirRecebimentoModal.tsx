import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle2, AlertTriangle, Package, XCircle } from "lucide-react";

interface ItemPedido {
  id: string;
  produto_id: string;
  produto_nome: string;
  quantidade_solicitada: number;
  quantidade_recebida: number | null;
  unidade: string | null;
}

interface Pedido {
  id: string;
  numero_pedido: string;
  fornecedor: string;
  status: string;
  data_pedido: string;
  data_prevista_entrega: string | null;
  observacao: string | null;
}

interface ConferirRecebimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: Pedido | null;
  itens: ItemPedido[];
  onConfirmar: (
    itensConferidos: Array<{ id: string; quantidade_recebida: number; divergencia: boolean; observacao_divergencia?: string }>,
    observacaoGeral: string
  ) => Promise<void>;
  saving: boolean;
}

interface ItemConferencia {
  id: string;
  produto_nome: string;
  quantidade_solicitada: number;
  quantidade_recebida: string;
  unidade: string | null;
  observacao: string;
}

export function ConferirRecebimentoModal({
  open,
  onOpenChange,
  pedido,
  itens,
  onConfirmar,
  saving,
}: ConferirRecebimentoModalProps) {
  const [itensConferencia, setItensConferencia] = useState<ItemConferencia[]>([]);
  const [observacaoGeral, setObservacaoGeral] = useState("");

  useEffect(() => {
    if (itens.length > 0) {
      setItensConferencia(
        itens.map((item) => ({
          id: item.id,
          produto_nome: item.produto_nome,
          quantidade_solicitada: item.quantidade_solicitada,
          quantidade_recebida: item.quantidade_solicitada.toString(),
          unidade: item.unidade,
          observacao: "",
        }))
      );
    }
  }, [itens]);

  const handleQuantidadeChange = (id: string, value: string) => {
    setItensConferencia((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantidade_recebida: value } : item
      )
    );
  };

  const handleObservacaoItemChange = (id: string, value: string) => {
    setItensConferencia((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, observacao: value } : item
      )
    );
  };

  const getStatusItem = (solicitada: number, recebidaStr: string) => {
    const recebida = parseFloat(recebidaStr) || 0;
    if (recebida === solicitada) {
      return { status: "ok", label: "OK", variant: "default" as const, icon: CheckCircle2 };
    }
    if (recebida === 0) {
      return { status: "nao_entregue", label: "Não entregue", variant: "destructive" as const, icon: XCircle };
    }
    if (recebida < solicitada) {
      return { status: "falta", label: `Falta ${solicitada - recebida}`, variant: "secondary" as const, icon: AlertTriangle };
    }
    return { status: "excesso", label: `Excesso +${recebida - solicitada}`, variant: "outline" as const, icon: Package };
  };

  const handleConfirmar = async () => {
    const itensParaSalvar = itensConferencia.map((item) => {
      const recebida = parseFloat(item.quantidade_recebida) || 0;
      const divergencia = recebida !== item.quantidade_solicitada;
      return {
        id: item.id,
        quantidade_recebida: recebida,
        divergencia,
        observacao_divergencia: divergencia ? item.observacao || undefined : undefined,
      };
    });

    await onConfirmar(itensParaSalvar, observacaoGeral);
  };

  const estatisticas = {
    total: itensConferencia.length,
    ok: itensConferencia.filter((i) => parseFloat(i.quantidade_recebida) === i.quantidade_solicitada).length,
    divergentes: itensConferencia.filter((i) => parseFloat(i.quantidade_recebida) !== i.quantidade_solicitada).length,
  };

  const allValid = itensConferencia.every((i) => i.quantidade_recebida !== "" && !isNaN(parseFloat(i.quantidade_recebida)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Conferência de Recebimento
          </DialogTitle>
          <DialogDescription>
            {pedido && (
              <span className="flex flex-wrap gap-2 mt-1">
                <Badge variant="outline">Pedido #{pedido.numero_pedido}</Badge>
                <Badge variant="secondary">{pedido.fornecedor}</Badge>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Resumo */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{estatisticas.total} itens</Badge>
            <Badge className="bg-green-500">{estatisticas.ok} OK</Badge>
            {estatisticas.divergentes > 0 && (
              <Badge variant="destructive">{estatisticas.divergentes} divergentes</Badge>
            )}
          </div>

          {/* Tabela de conferência */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Produto</TableHead>
                  <TableHead className="text-right w-[15%]">Solicitado</TableHead>
                  <TableHead className="text-right w-[20%]">Recebido</TableHead>
                  <TableHead className="text-center w-[15%]">Status</TableHead>
                  <TableHead className="w-[15%]">Obs. Divergência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensConferencia.map((item) => {
                  const statusInfo = getStatusItem(item.quantidade_solicitada, item.quantidade_recebida);
                  const StatusIcon = statusInfo.icon;
                  const hasDivergencia = parseFloat(item.quantidade_recebida) !== item.quantidade_solicitada;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.produto_nome}</TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantidade_solicitada} {item.unidade || "un"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantidade_recebida}
                          onChange={(e) => handleQuantidadeChange(item.id, e.target.value)}
                          className="w-24 ml-auto text-right font-mono"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={statusInfo.variant}
                          className={
                            statusInfo.status === "ok"
                              ? "bg-green-500 text-white"
                              : statusInfo.status === "falta"
                              ? "bg-amber-500 text-white"
                              : statusInfo.status === "excesso"
                              ? "bg-blue-500 text-white"
                              : ""
                          }
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasDivergencia && (
                          <Input
                            type="text"
                            placeholder="Motivo..."
                            value={item.observacao}
                            onChange={(e) => handleObservacaoItemChange(item.id, e.target.value)}
                            className="text-sm"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Observação Geral */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Observação Geral (opcional)</label>
            <Textarea
              placeholder="Notas sobre o recebimento, condições da mercadoria..."
              value={observacaoGeral}
              onChange={(e) => setObservacaoGeral(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={saving || !allValid}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar Recebimento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
