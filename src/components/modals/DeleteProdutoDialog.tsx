import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface Produto {
  id: string;
  nome: string;
  codigo: string | null;
}

interface DeleteProdutoDialogProps {
  produto: Produto | null;
  onClose: (success?: boolean) => void;
}

export function DeleteProdutoDialog({ produto, onClose }: DeleteProdutoDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!produto) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', produto.id);

      if (error) throw error;

      toast.success('Produto excluído com sucesso');
      onClose(true);
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast.error('Erro ao excluir produto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={!!produto} onOpenChange={() => onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o produto{' '}
            <strong>{produto?.nome}</strong>
            {produto?.codigo && ` (${produto.codigo})`}?
            <br />
            <br />
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
