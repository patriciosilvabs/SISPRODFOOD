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
import { useCanDelete } from '@/hooks/useCanDelete';

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
  const { canDelete } = useCanDelete();

  const handleDelete = async () => {
    if (!produto) return;

    if (!canDelete) {
      toast.error('Você não tem permissão para excluir produtos.');
      onClose();
      return;
    }

    try {
      setLoading(true);

      // 1. Deletar estoque_cpd_produtos
      await supabase
        .from('estoque_cpd_produtos')
        .delete()
        .eq('produto_id', produto.id);

      // 2. Deletar estoque_loja_produtos
      await supabase
        .from('estoque_loja_produtos')
        .delete()
        .eq('produto_id', produto.id);

      // 3. Deletar pedidos_compra_itens
      await supabase
        .from('pedidos_compra_itens')
        .delete()
        .eq('produto_id', produto.id);

      // 4. Deletar movimentacoes_cpd_produtos
      await supabase
        .from('movimentacoes_cpd_produtos')
        .delete()
        .eq('produto_id', produto.id);

      // 5. Finalmente deletar o produto
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', produto.id);

      if (error) throw error;

      toast.success('Produto excluído permanentemente!');
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
          <AlertDialogTitle className="text-destructive">⚠️ Exclusão Permanente</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja <strong>EXCLUIR PERMANENTEMENTE</strong> o produto{' '}
            <strong>{produto?.nome}</strong>
            {produto?.codigo && ` (${produto.codigo})`}?
            <br />
            <br />
            <span className="text-destructive font-medium">
              Esta ação é IRREVERSÍVEL e todos os dados relacionados (estoques, movimentações) serão perdidos.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
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
