import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Package } from "lucide-react";
import { useState, useEffect } from "react";

export interface InsumoParaConfirmar {
  nome: string;
  quantidade: number;
  unidade: string;
}

interface ConfirmarSeparacaoInsumosModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemNome: string;
  insumos: InsumoParaConfirmar[];
  loading?: boolean;
}

export function ConfirmarSeparacaoInsumosModal({
  open,
  onClose,
  onConfirm,
  itemNome,
  insumos,
  loading = false,
}: ConfirmarSeparacaoInsumosModalProps) {
  const [confirmado, setConfirmado] = useState(false);

  // Reset checkbox when modal opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmado(false);
    }
  }, [open]);

  const formatarQuantidade = (quantidade: number, unidade: string) => {
    if (unidade === 'kg' || unidade === 'g') {
      if (quantidade >= 1000 && unidade === 'g') {
        return `${(quantidade / 1000).toFixed(2)} kg`;
      }
      return `${quantidade.toFixed(2)} ${unidade}`;
    }
    return `${quantidade} ${unidade}`;
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <Package className="h-5 w-5" />
            Confirmar Separação de Insumos
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            Antes de iniciar o preparo de <strong className="text-foreground">"{itemNome}"</strong>, 
            confirme que você já separou corretamente os seguintes insumos:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 rounded-lg border bg-muted/50 p-3">
          {insumos.length > 0 ? (
            <ul className="space-y-2">
              {insumos.map((insumo, index) => (
                <li 
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    {insumo.nome}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatarQuantidade(insumo.quantidade, insumo.unidade)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Nenhum insumo configurado para este item.
            </p>
          )}
        </div>

        <div className="flex items-start space-x-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <Checkbox
            id="confirmar-separacao"
            checked={confirmado}
            onCheckedChange={(checked) => setConfirmado(checked === true)}
            className="mt-0.5"
          />
          <label
            htmlFor="confirmar-separacao"
            className="text-sm leading-tight cursor-pointer"
          >
            Confirmo que separei todos os insumos acima com os pesos/quantidades corretas
          </label>
        </div>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel onClick={onClose} disabled={loading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!confirmado || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? "Iniciando..." : "Confirmar e Iniciar Preparo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
